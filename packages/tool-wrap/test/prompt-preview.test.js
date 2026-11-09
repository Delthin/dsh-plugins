import test from 'node:test';
import assert from 'node:assert/strict';
import { Readable } from 'node:stream';
import { sourceId } from '../prompt-composition.js';
import { registeredPromptSources } from '../prompt-origins.js';
import { hostFixture, fixturePlugin, pluginIds } from './fixture.js';

async function getStatus(host) {
  const req = Readable.from([]);
  req.method = 'GET'; req.headers = {};
  const res = { setHeader() {}, end(body) { this.body = JSON.parse(body); } };
  await host.routes.get('/api/tool-discovery/prompt-composition')(req, res);
  assert.equal(res.statusCode, 200);
  return res.body;
}

// The preview is the entire registered literal, not a rendered/truncated session prompt.
test('global section and context previews preserve full static text and unresolved variables', async t => {
  const host = await hostFixture(t);
  const owner = await fixturePlugin(host.ctx, pluginIds.browser);
  const section = '静态全文\n' + 'long body\n'.repeat(1000) + '{{private_variable}}\nEND';
  const context = '静态上下文\n{{private_variable}}';
  owner.systemPrompt.section({ name: 'preview:section', order: 100, text: section });
  owner.systemPrompt.context({ name: 'preview:context', order: 100, text: context, required: true });
  owner.systemPrompt.section({ name: 'preview:empty', order: 101, text: '' });
  owner.systemPrompt.variable('private_variable', () => { assert.fail('preview must not resolve variables'); });
  const status = await getStatus(host);
  for (const [kind, name, text] of [['section', 'preview:section', section], ['context', 'preview:context', context], ['section', 'preview:empty', '']]) {
    const source = status.sources.find(item => item.id === sourceId(kind, pluginIds.browser, name));
    assert.deepEqual(source.preview, { kind: 'static', text });
  }
});

// Listing status must not run providers (including an accidental getter) or expose their source.
test('GET and runtime status mark dynamic providers without invoking them', async t => {
  const host = await hostFixture(t);
  const owner = await fixturePlugin(host.ctx, pluginIds.browser);
  let calls = 0;
  const provider = () => { calls++; return 'DYNAMIC_PROVIDER_PRIVATE_BODY'; };
  provider.toString = () => { assert.fail('preview must not stringify a provider'); };
  owner.systemPrompt.section({ name: 'preview:dynamic-section', order: 100, text: provider });
  owner.systemPrompt.context({ name: 'preview:dynamic-context', order: 100, text: provider, required: true });
  owner.systemPrompt.context({ name: 'preview:accessor', order: 101, get text() { calls++; return 'GETTER_PRIVATE_BODY'; } });
  const composition = host.ctx.get('toolWrapPromptComposition');
  for (const status of [composition.status(), await getStatus(host)]) {
    for (const name of ['preview:dynamic-section', 'preview:dynamic-context']) {
      const { preview } = status.sources.find(source => source.name === name);
      assert.equal(preview.kind, 'dynamic');
      assert.equal(preview.reason, 'session-context-required');
      assert.match(preview.message, /会话上下文动态生成/);
      assert.equal(Object.hasOwn(preview, 'text'), false);
    }
    const { preview } = status.sources.find(source => source.name === 'preview:accessor');
    assert.equal(preview.kind, 'unavailable');
    assert.equal(preview.reason, 'static-text-unavailable');
    assert.doesNotMatch(JSON.stringify(status), /DYNAMIC_PROVIDER_PRIVATE_BODY|GETTER_PRIVATE_BODY/);
  }
  assert.equal(calls, 0);
});

// Scoped shadows and final assembly observations must never replace the global preview.
test('scoped and observed prompt bodies do not escape into global previews or status', async t => {
  const host = await hostFixture(t);
  const owner = await fixturePlugin(host.ctx, pluginIds.browser);
  owner.systemPrompt.section({ name: 'preview:shared', order: 100, text: 'GLOBAL_REGISTRATION_BODY' });
  const composition = host.ctx.get('toolWrapPromptComposition');
  for (const id of ['a', 'b']) {
    const agent = host.agent('preview-' + id);
    const scoped = await fixturePlugin(agent.ctx, pluginIds.browser);
    scoped.systemPrompt.section({ name: 'preview:shared', order: 100, text: 'SCOPED_PRIVATE_BODY_' + id });
    scoped.systemPrompt.context({ name: 'preview:scoped-' + id, order: 100, text: () => { assert.fail('global status must not execute scoped providers'); } });
    composition.collectAssembly({ sections: [{ name: 'preview:observed-' + id, text: 'OBSERVED_PRIVATE_BODY_' + id }], contexts: [], variables: {} });
    // Even a caller-supplied preview must be stripped by the identity-only observer.
    composition.observe({ id: sourceId('section', pluginIds.browser, 'preview:shared'), owner: pluginIds.browser, kind: 'section', name: 'preview:shared', text: 'OBSERVED_PRIVATE_BODY_' + id, preview: { kind: 'static', text: 'OBSERVED_PRIVATE_PREVIEW_' + id } });
  }
  const registered = registeredPromptSources(host.ctx.systemPrompt);
  assert.equal(registered.some(source => source.name.startsWith('preview:scoped-')), false);
  const status = await getStatus(host);
  assert.deepEqual(status.sources.find(source => source.name === 'preview:shared').preview, { kind: 'static', text: 'GLOBAL_REGISTRATION_BODY' });
  assert.doesNotMatch(JSON.stringify([registered, status, [...composition.observed.values()]]), /SCOPED_PRIVATE|OBSERVED_PRIVATE/);
  for (const source of status.sources.filter(source => source.name?.startsWith('preview:observed-'))) assert.equal(Object.hasOwn(source, 'preview'), false);
});
