import test from 'node:test';
import assert from 'node:assert/strict';
import { renderPrompt } from '@deepseek-ai/dsh-system-prompt';
import { ApprovalService } from '@deepseek-ai/dsh-user-approval';
import { project, renderSdk, sdkSchemas } from '../core.js';
import { assemble, enabledConfig, fixturePlugin, fixtureTool, hostFixture, sdkSection, success } from './fixture.js';

const names = ['unwrap', 'discover_tools'];

test('only unwrap is advertised in ordinary PTC prompts, with complete JSON output guidance', async t => {
  const { ctx, tools, agent, request, execute } = await hostFixture(t);
  const a = agent('unwrap-visibility');
  const prompt = renderPrompt(await assemble(ctx, a));
  assert.match(prompt, /unwrap:/);
  assert.match(prompt, /proactively call unwrap/);
  assert.match(prompt, /Example: return await tools\.unwrap\(/);
  assert.match(prompt, /complete JSON serialization/);
  assert.doesNotMatch(prompt, /discover_tools/);
  for (const name of names) assert.ok(tools.get(name, a));
  const schemas = sdkSchemas(tools, a);
  for (const language of ['typescript', 'python']) {
    const projected = project(schemas, enabledConfig(), { language, programFormat: 'repl' });
    const text = projected.text + '\n\n' + projected.directory;
    assert.doesNotMatch(text, /discover_tools/);
    assert.match(text, language === 'python' ? /json\.dumps\(await tools\.unwrap/ : /JSON\.stringify\(await tools\.unwrap/);
  }
  const empty = success(await execute('unwrap', {}, { agent: a, nested: true }));
  assert.doesNotMatch(JSON.stringify(empty), /discover_tools/);
  assert.ok(empty.groups.every(group => !group.tools.some(name => names.includes(name))));
  const missing = success(await execute('unwrap', { plugin: '', tool: 'compress' }, { agent: a, nested: true }));
  assert.deepEqual(missing.unavailable, ['compress']);
  assert.equal(missing.sdk, '');
  assert.deepEqual(missing.guidance, []);
  assert.equal(missing.guidanceStatus, 'not-loaded');
  const status = (await request()).body;
  assert.ok(!status.otherTools.some(tool => names.includes(tool.name)));
  assert.ok(status.groups.every(group => !group.tools.some(tool => names.includes(tool.name))));
});

test('real run_code binding invokes unwrap and legacy alias with the same scoped complete pack and original guard', async t => {
  const host = await hostFixture(t, { bridge: true });
  const { ctx, tools, agent, calls } = host;
  const a = agent('unwrap-bridge');
  a.ctx.tools.restrict({ deny: ['ego_secret'] });
  const description = 'FULL_PACK_LONG_DESCRIPTION '.repeat(800) + 'FULL_PACK_TAIL';
  await fixturePlugin(a.ctx, 'dsh-ego-browser', [fixtureTool('ego_visit', { description, marker: 'unwrapScopedOutput' })]);
  const before = renderPrompt(await assemble(ctx, a));
  let primary;
  for (const name of names) {
    ctx.ptcRuntime.programs.set(name, bindings => bindings[name]({ plugin: 'dsh-ego-browser' }));
    const pack = success(await host.execute('run_code', { code: name, description: 'Load one complete harmless fixture pack' }, { agent: a })).result;
    assert.deepEqual([...pack.tools].sort(), ['ego_capture', 'ego_visit']);
    assert.match(pack.sdk, /FULL_PACK_TAIL/);
    assert.match(pack.sdk, /unwrapScopedOutput: string/);
    assert.doesNotMatch(pack.sdk, /ego_secret:/);
    assert.ok(pack.sdk.length > 20000);
    assert.deepEqual(JSON.parse(JSON.stringify(pack)), pack);
    if (primary) assert.deepEqual(pack, primary);
    else primary = pack;
    const rendered = tools.get(name, a).output.render({ plugin: 'dsh-ego-browser' }, pack);
    assert.deepEqual(JSON.parse(rendered[0].text), pack);
    const { sdk: duplicate, ...expected } = pack;
    assert.ok(duplicate.length);
    for (const format of ['schema', 'full']) {
      ctx.ptcRuntime.programs.set(`${name}-${format}`, bindings => bindings[name]({ plugin: 'dsh-ego-browser', format }));
      const formatted = success(await host.execute('run_code', { code: `${name}-${format}`, description: 'Load complete fixture pack in selected format' }, { agent: a })).result;
      assert.deepEqual({ ...formatted, usage: pack.usage }, format === 'schema' ? expected : pack);
      if (format === 'schema') assert.match(formatted.usage, /return constraints and annotations are in schemas/);
      const rendered = tools.get(name, a).output.render({ plugin: 'dsh-ego-browser', format }, formatted);
      assert.deepEqual(JSON.parse(rendered[0].text), formatted);
    }
    const invalid = await host.execute(name, { plugin: 'dsh-ego-browser', format: 'json' }, { agent: a, nested: true });
    assert.equal(invalid.isError, true);
    assert.deepEqual(calls, []);
  }
  const removeEntryGuard = tools.guard(exec => names.includes(exec.name) ? 'original discovery entry guard' : undefined);
  for (const name of names) {
    const denied = await host.execute('run_code', { code: name, description: 'Check discovery entry guard' }, { agent: a });
    assert.equal(denied.isError, true);
    assert.match(JSON.stringify(denied), /original discovery entry guard/);
  }
  removeEntryGuard();
  await ctx.plugin(ApprovalService, { policy: 'ask' });
  const removeApproval = ctx.on('tools/pre-execute', async (exec, next) => names.includes(exec.name)
    ? { kind: 'ask', reason: 'original discovery entry approval' } : next());
  const decisions = ['rejected', 'allowed-once', 'rejected', 'allowed-once'];
  ctx.on('approval/request', async () => decisions.shift());
  for (const name of names) {
    const denied = await host.execute('run_code', { code: name, description: 'Check discovery entry rejection' }, { agent: a });
    assert.equal(denied.isError, true);
    assert.match(JSON.stringify(denied), /user rejected/);
    const allowed = success(await host.execute('run_code', { code: name, description: 'Check one-shot discovery approval' }, { agent: a }));
    assert.deepEqual(allowed.result, primary);
  }
  assert.deepEqual(decisions, []);
  removeApproval();
  ctx.ptcRuntime.programs.set('guarded original', bindings => bindings.ego_visit({ input: 'blocked fixture' }));
  tools.guard(exec => exec.name === 'ego_visit' ? 'original unwrap fixture guard' : undefined);
  const denied = await host.execute('run_code', { code: 'guarded original', description: 'Check original harmless fixture guard' }, { agent: a });
  assert.equal(denied.isError, true);
  assert.match(JSON.stringify(denied), /original unwrap fixture guard/);
  assert.deepEqual(calls, []);
  assert.equal(renderPrompt(await assemble(ctx, a)), before);
});

for (const mode of ['ptc', 'native']) test(`disabled ${mode} rejects both names and strips unresolved SDK inspection`, async t => {
  const { ctx, tools, agent, execute } = await hostFixture(t, { mode, config: enabledConfig({ enabled: false }) });
  const a = agent(`unwrap-disabled-${mode}`);
  const unresolved = await ctx.systemPrompt.assemble({ scope: a });
  assert.doesNotMatch(renderPrompt(unresolved), /unwrap|discover_tools/);
  for (const name of names) {
    const result = await execute(name, {}, { agent: a, nested: true });
    assert.equal(result.error.info.code, 'UNKNOWN_TOOL');
    assert.ok(tools.get(name), 'registration must remain present');
  }
});

test('legacy alias does not weaken exact SDK guard when another plugin removes only its definition', async t => {
  const { ctx, tools, agent, mount, request } = await hostFixture(t, { installPlugin: false });
  const a = agent('unwrap-exact-guard');
  ctx.on('system-prompt/assemble', async (_assembly, context, next) => {
    const assembly = await next();
    return { ...assembly, sections: assembly.sections.map(section => section.name === 'tools:sdk'
      ? { ...section, text: renderSdk(sdkSchemas(tools, context.scope, context.toolSet).filter(tool => tool.name !== 'discover_tools'), ctx.ptcRuntime) } : section) };
  });
  await mount();
  const assembly = await assemble(ctx, a);
  assert.match(sdkSection(assembly), /ego_visit:/);
  assert.doesNotMatch(sdkSection(assembly), /# On-demand tools|discover_tools/);
  assert.equal((await request()).body.lastAssembly.status, 'incompatible-sdk');
});

test('both names respect caller-bound snapshot ownership and disposal', async t => {
  const { tools, execute, agent } = await hostFixture(t);
  const a = agent('unwrap-snapshot-a');
  const b = agent('unwrap-snapshot-b');
  const snapshot = await tools.resolve({ agent: a, modelSelection: { provider: 'fixture', model: 'fixture' }, signal: new AbortController().signal });
  try {
    for (const name of names) {
      assert.ok(sdkSchemas(tools, a, snapshot).some(tool => tool.name === name));
      const result = await execute(name, {}, { agent: b, nested: true, toolSet: snapshot });
      assert.equal(result.error.info.code, 'UNKNOWN_TOOL');
    }
    snapshot.dispose();
    for (const name of names) {
      const result = await execute(name, {}, { agent: a, nested: true, toolSet: snapshot });
      assert.equal(result.error.info.code, 'UNKNOWN_TOOL');
    }
  } finally { snapshot.dispose(); }
});
