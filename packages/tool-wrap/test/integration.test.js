import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { renderPrompt } from '@deepseek-ai/dsh-system-prompt';
import { sdkSchemas, renderSdk, digest } from '../core.js';
import { assemble, enabledConfig, fixturePlugin, fixtureTool, hostFixture, sdkSection, success, tsRuntime } from './fixture.js';

const sha256 = text => createHash('sha256').update(Buffer.from(text, 'utf8')).digest('hex');

test('real SystemPrompt projection preserves registry and wire transport; discovery in A changes no A/B prompt bytes', async t => {
  const host = await hostFixture(t, { config: enabledConfig({ tools: ['virtual_echo'], exclude: ['ego_capture'] }) });
  const { ctx, tools, execute, agent, request, calls } = host;
  const a = agent('A');
  const b = agent('B');
  ctx.systemPrompt.context({ name: 'fixture:runtime', order: 10, text: 'Current image provider: fixture; canvas: disconnected.', required: true });
  ctx.systemPrompt.section({ name: 'fixture:tool-guidance', order: 1100, text: 'Original login and safety instructions stay present.' });
  const definitions = tools.schemas(a).map(schema => [schema.name, tools.get(schema.name, a)]);
  const beforeSchemas = tools.schemas(a);
  const aBefore = await assemble(ctx, a);
  const bBefore = await assemble(ctx, b);
  assert.deepEqual(aBefore.tools.map(tool => tool.name), ['run_code']);
  assert.match(sdkSection(aBefore), /# On-demand tools/);
  assert.doesNotMatch(sdkSection(aBefore).split('\n\n# On-demand tools')[0], /ego_visit:|virtual_echo:/);
  assert.match(sdkSection(aBefore), /ego_capture:/);
  assert.match(renderPrompt(aBefore), /Original login and safety instructions stay present/);
  assert.equal(aBefore.contexts[0].text, 'Current image provider: fixture; canvas: disconnected.');
  let registryChanges = 0;
  let promptChanges = 0;
  ctx.on('tools/change', () => { registryChanges++; });
  ctx.on('system-prompt/change', () => { promptChanges++; });
  const full = success(await execute('discover_tools', { plugin: 'dsh-ego-browser' }, { agent: a, nested: true }));
  assert.deepEqual([...full.tools].sort(), ['ego_secret', 'ego_visit']);
  assert.doesNotMatch(full.sdk, /ego_capture:/);
  const unowned = success(await execute('discover_tools', { tool: 'virtual_echo' }, { agent: a, nested: true }));
  assert.deepEqual(unowned.tools, ['virtual_echo']);
  const aAfter = await assemble(ctx, a);
  const bAfter = await assemble(ctx, b);
  for (const [before, after] of [[aBefore, aAfter], [bBefore, bAfter]]) {
    assert.equal(sha256(renderPrompt(before)), sha256(renderPrompt(after)));
    assert.ok(Buffer.from(renderPrompt(before), 'utf8').equals(Buffer.from(renderPrompt(after), 'utf8')));
    assert.deepEqual(before, after);
  }
  assert.equal(sha256(renderPrompt(aBefore)), sha256(renderPrompt(bBefore)));
  assert.deepEqual(tools.schemas(a), beforeSchemas);
  for (const [name, definition] of definitions) assert.equal(tools.get(name, a), definition);
  assert.equal(registryChanges, 0);
  assert.equal(promptChanges, 0);
  assert.deepEqual(calls, []);
  const status = (await request()).body;
  assert.equal(status.discoveryCalls, 2);
  assert.equal(status.lastAssembly.status, 'projected');
  assert.equal(status.lastAssembly.hash, digest(sdkSection(bAfter)));
  assert.equal(status.lastAssembly.hash, sha256(sdkSection(bAfter)).slice(0, 16));
});

test('real scoped restrictions prevent discovery leaks; shadow input/output definitions resolve from caller only', async t => {
  const { ctx, tools, execute, agent } = await hostFixture(t, { config: enabledConfig({ tools: ['scope_only'] }) });
  const a = agent('A');
  const b = agent('B');
  a.ctx.tools.restrict({ deny: ['ego_secret'] });
  await fixturePlugin(a.ctx, 'dsh-ego-browser', [fixtureTool('ego_visit', { description: 'SCOPED_A_BROWSER', marker: 'scopedAMarker' })]);
  await fixturePlugin(b.ctx, 'fixture-scope-b', [fixtureTool('scope_only', { description: 'ONLY_B_CAPABILITY', marker: 'scopedBMarker' })]);
  assert.equal(tools.get('ego_secret', a), undefined);
  assert.ok(tools.get('ego_secret', b));
  assert.equal(tools.get('scope_only', a), undefined);
  const aSchemas = sdkSchemas(tools, a);
  assert.ok(!aSchemas.some(tool => tool.name === 'ego_secret' || tool.name === 'scope_only'));
  const shadow = aSchemas.find(tool => tool.name === 'ego_visit');
  assert.deepEqual(shadow.output, tools.get('ego_visit', a).output.schema);
  assert.ok(Object.hasOwn(shadow.output.properties, 'scopedAMarker'));
  assert.ok(!Object.hasOwn(shadow.output.properties, 'globalMarker'));
  for (const args of [{}, { plugin: 'fixture-scope-b' }, { plugin: 'dsh-ego-browser' }]) {
    const result = success(await execute('discover_tools', args, { agent: a, nested: true }));
    assert.doesNotMatch(JSON.stringify(result), /RESTRICTED_SECRET_DESCRIPTION|ONLY_B_CAPABILITY|scopedBMarker/);
    if (args.plugin === 'dsh-ego-browser') {
      assert.deepEqual([...result.tools].sort(), ['ego_capture', 'ego_visit']);
      assert.match(result.sdk, /SCOPED_A_BROWSER/);
      assert.match(result.sdk, /scopedAMarker: string/);
      const visitSdk = renderSdk(aSchemas.filter(tool => tool.name === 'ego_visit'), tsRuntime);
      assert.doesNotMatch(visitSdk, /globalMarker/);
      assert.match(result.sdk, /ego_capture:/);
    } else if (args.plugin) {
      assert.deepEqual(result.tools, []);
      assert.equal(result.sdk, '');
      assert.ok(result.unavailable);
    }
  }
  const bResult = success(await execute('discover_tools', { plugin: 'dsh-ego-browser' }, { agent: b, nested: true }));
  assert.deepEqual([...bResult.tools].sort(), ['ego_capture', 'ego_secret', 'ego_visit']);
  assert.match(bResult.sdk, /RESTRICTED_SECRET_DESCRIPTION/);
  assert.doesNotMatch(bResult.sdk, /SCOPED_A_BROWSER|scopedAMarker/);
  const bPrivate = success(await execute('discover_tools', { plugin: 'fixture-scope-b' }, { agent: b, nested: true }));
  assert.deepEqual(bPrivate.tools, ['scope_only']);
  assert.match(bPrivate.sdk, /ONLY_B_CAPABILITY/);
  assert.match(bPrivate.sdk, /scopedBMarker: string/);
  assert.doesNotMatch(bPrivate.sdk, /SCOPED_A_BROWSER|scopedAMarker/);
  const aAssembly = await assemble(ctx, a);
  const aCatalog = sdkSection(aAssembly).split('\n\n# On-demand tools')[1];
  assert.doesNotMatch(aCatalog, /ego_secret|scope_only|ego_secret:|scope_only:/);
  const browserRow = aCatalog.split('\n').filter(line => line.startsWith('- {')).map(line => JSON.parse(line.slice(2))).find(row => row.plugin === 'dsh-ego-browser');
  assert.deepEqual(browserRow.tools, ['ego_capture', 'ego_visit']);
  assert.doesNotMatch(renderPrompt(aAssembly), /RESTRICTED_SECRET_DESCRIPTION|ONLY_B_CAPABILITY|scopedBMarker/);
  shadow.output.properties.scopedAMarker.description = 'caller-local mutation';
  assert.notEqual(tools.get('ego_visit', a).output.schema.properties.scopedAMarker.description, 'caller-local mutation');
});

test('native mode keeps complete wire schemas and existing prompt with discovery enabled', async t => {
  const { ctx, tools, execute, agent, mount, request } = await hostFixture(t, { mode: 'native', installPlugin: false });
  const a = agent('native');
  ctx.systemPrompt.section({ name: 'fixture:full', order: 100, text: 'Native original guidance' });
  const before = await assemble(ctx, a);
  await mount();
  const after = await assemble(ctx, a);
  assert.deepEqual(after.tools, before.tools);
  assert.ok(!after.tools.some(tool => tool.name === 'discover_tools'));
  assert.ok(tools.get('discover_tools'), 'presentation filtering must not remove registry binding');
  assert.deepEqual(after.sections, before.sections);
  assert.equal(renderPrompt(after), renderPrompt(before));
  assert.ok(after.tools.some(tool => tool.name === 'ego_visit'));
  assert.ok(!after.tools.some(tool => tool.name === 'run_code'));
  success(await execute('ego_visit', { input: 'native safe fixture' }, { agent: a }));
  assert.ok(tools.get('ego_visit', a));
  assert.equal((await request()).body.lastAssembly.status, 'native-unchanged');
});

test('another plugin owning tools:sdk triggers fail-open compatibility fallback', async t => {
  const { ctx, tools, agent, mount, request } = await hostFixture(t, { installPlugin: false });
  const replacement = 'OTHER_PLUGIN_SDK exact bytes {{literal}}';
  ctx.on('system-prompt/assemble', async (_assembly, _context, next) => {
    const assembly = await next();
    return { ...assembly, sections: assembly.sections.map(section => section.name === 'tools:sdk' ? { ...section, text: replacement, interpolate: false } : section) };
  });
  const a = agent('A');
  const definitions = tools.schemas(a);
  await mount();
  const assembly = await assemble(ctx, a);
  assert.equal(sdkSection(assembly), replacement);
  assert.match(renderPrompt(assembly), /OTHER_PLUGIN_SDK exact bytes \{\{literal\}\}/);
  assert.deepEqual(tools.schemas(a).filter(tool => !['unwrap', 'discover_tools'].includes(tool.name)), definitions);
  assert.equal((await request()).body.lastAssembly.status, 'incompatible-sdk');
});

test('restricted discovery transport leaves original full SDK intact rather than hiding unusable definitions', async t => {
  const { ctx, tools, agent, request } = await hostFixture(t);
  const a = agent('no-discovery');
  a.ctx.tools.restrict({ deny: ['unwrap'] });
  const assembly = await assemble(ctx, a);
  assert.equal(sdkSection(assembly), renderSdk(sdkSchemas(tools, a).filter(tool => tool.name !== 'discover_tools'), tsRuntime));
  assert.match(sdkSection(assembly), /ego_visit:/);
  assert.doesNotMatch(sdkSection(assembly), /# On-demand tools/);
  assert.equal((await request()).body.lastAssembly.status, 'incompatible-sdk');
});

test('host complete persona is restored after waterfall; lastAssembly records projection, not final request', async t => {
  const { ctx, agent, request } = await hostFixture(t);
  const a = agent('complete-persona');
  const persona = 'Complete persona bytes {{literal}} — only this final system prompt.';
  a.ctx.systemPrompt.section({ name: 'fixture:complete', order: 0, text: persona, complete: true, interpolate: false });
  const assembly = await assemble(ctx, a);
  assert.deepEqual(assembly.sections, [{ name: 'fixture:complete', text: persona, interpolate: false }]);
  assert.equal(renderPrompt(assembly), persona);
  assert.deepEqual(assembly.tools.map(tool => tool.name), ['run_code']);
  const status = (await request()).body.lastAssembly;
  assert.equal(status.status, 'projected');
  assert.ok(status.hiddenCount > 0);
  assert.notEqual(status.hash, digest(renderPrompt(assembly)));
});

test('real registry pre-policy, monotonic guard, post-policy and cancellation remain effective after discovery', async t => {
  const { ctx, tools, execute, agent, calls } = await hostFixture(t);
  const a = agent('policies');
  success(await execute('discover_tools', { plugin: 'dsh-ego-browser' }, { agent: a, nested: true }));
  const direct = await execute('ego_visit', { input: 'direct ptc bypass' }, { agent: a });
  assert.equal(direct.error.info.code, 'UNKNOWN_TOOL');
  const removeGuard = tools.guard(exec => exec.name === 'ego_visit' ? 'fixture permission guard denied' : undefined);
  const guarded = await execute('ego_visit', { input: 'guarded' }, { agent: a, nested: true });
  assert.equal(guarded.isError, true);
  assert.match(guarded.error.message, /fixture permission guard denied/);
  assert.deepEqual(calls, []);
  removeGuard();
  const pre = ctx.on('tools/pre-execute', async (exec, next) => exec.name === 'ego_visit' ? { kind: 'deny', reason: 'fixture original pre-policy' } : next());
  const denied = await execute('ego_visit', { input: 'pre denied' }, { agent: a, nested: true });
  assert.match(denied.error.message, /fixture original pre-policy/);
  assert.deepEqual(calls, []);
  pre();
  const post = ctx.on('tools/post-execute', async (exec, _result, next) => exec.name === 'ego_visit' ? { kind: 'block', feedback: [{ type: 'text', text: 'fixture result blocked' }] } : next());
  const blocked = await execute('ego_visit', { input: 'post denied' }, { agent: a, nested: true });
  assert.equal(blocked.isError, true);
  assert.match(blocked.error.message, /fixture result blocked/);
  assert.equal(calls.length, 1);
  post();
  const controller = new AbortController();
  controller.abort(new Error('fixture cancellation'));
  const cancelled = await execute('discover_tools', { plugin: 'dsh-ego-browser' }, { agent: a, signal: controller.signal, nested: true });
  assert.equal(cancelled.error.info.code, 'ABORTED_BEFORE_DISPATCH');
  const cancelGate = ctx.on('tools/pre-execute', async (exec, next) => exec.name === 'ego_visit' ? { kind: 'cancel' } : next());
  const gateCancelled = await execute('ego_visit', { input: 'cancelled by policy' }, { agent: a, nested: true });
  assert.equal(gateCancelled.error.info.code, 'ABORTED_BEFORE_DISPATCH');
  assert.equal(calls.length, 1);
  cancelGate();
  success(await execute('ego_visit', { input: 'allowed final' }, { agent: a, nested: true }));
  assert.equal(calls.length, 2);
});
