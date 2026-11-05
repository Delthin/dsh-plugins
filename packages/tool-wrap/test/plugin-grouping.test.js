import test from 'node:test';
import assert from 'node:assert/strict';
import { Context } from '@deepseek-ai/cordis';
import { Loader } from '@deepseek-ai/cordis-plugin-loader';
import { SystemPrompt } from '@deepseek-ai/dsh-system-prompt';
import { ToolRuntime } from '@deepseek-ai/dsh-tools';
import { renderToolsSdk, renderToolsSdkPy } from '@deepseek-ai/dsh-tool-executor-ptc';
import { ConfigStore, catalog, discover, hiddenTools, renderSdk, sdkSchemas, validateConfig } from '../core.js';
import * as originBootstrap from '../origin-bootstrap.js';
import { assemble, enabledConfig, fixturePlugin, fixtureTool, hostFixture, success, tsRuntime } from './fixture.js';

const names = schemas => schemas.map(tool => tool.name).sort();

test('unrelated tool names and identical prefixes are grouped only by Loader module identity', async t => {
  const { ctx, tools } = await hostFixture(t);
  await fixturePlugin(ctx, '@fixture/astronomy', [fixtureTool('banana'), fixtureTool('shared_first')]);
  await fixturePlugin(ctx, 'fixture-geology', [fixtureTool('orbit'), fixtureTool('shared_second')]);
  const schemas = sdkSchemas(tools);
  const groups = catalog(schemas);
  assert.deepEqual(groups.find(group => group.id === '@fixture/astronomy').tools.map(tool => tool.name), ['banana', 'shared_first']);
  assert.deepEqual(groups.find(group => group.id === 'fixture-geology').tools.map(tool => tool.name), ['orbit', 'shared_second']);
  const selected = enabledConfig({ groups: ['@fixture/astronomy'] });
  assert.deepEqual(names(hiddenTools(schemas, selected)), ['banana', 'shared_first']);
  assert.deepEqual(discover(schemas, selected, tsRuntime, { plugin: '@fixture/astronomy' }).tools.sort(), ['banana', 'shared_first']);
  const unavailable = discover(schemas, selected, tsRuntime, { plugin: 'fixture-geology' });
  assert.deepEqual(unavailable.tools, []);
  assert.equal(unavailable.sdk, '');
  assert.ok(unavailable.unavailable);
  assert.ok(groups.every(group => !['browser', 'image', 'schedule'].includes(group.id)));
});

test('selected plugins automatically include newly registered tools and disappear from catalog after unloading without dropping selection', async t => {
  const id = '@fixture/dynamic';
  const host = await hostFixture(t, { config: enabledConfig({ groups: [id] }) });
  const { ctx, tools, request } = host;
  assert.ok(!(await request()).body.groups.some(group => group.id === id));
  assert.deepEqual((await request()).body.config.groups, [id]);
  const child = await fixturePlugin(ctx, id, [fixtureTool('unrelated_initial')]);
  assert.deepEqual(names(hiddenTools(sdkSchemas(tools), enabledConfig({ groups: [id] }))), ['unrelated_initial']);
  child.tools.register(fixtureTool('newly_added_without_prefix'));
  const loaded = (await request()).body;
  assert.deepEqual(loaded.groups.find(group => group.id === id).tools.map(tool => tool.name), ['newly_added_without_prefix', 'unrelated_initial']);
  assert.deepEqual(names(hiddenTools(sdkSchemas(tools), loaded.config)), ['newly_added_without_prefix', 'unrelated_initial']);
  await child.fiber.dispose();
  const unloaded = (await request()).body;
  assert.ok(!unloaded.groups.some(group => group.id === id));
  assert.deepEqual(unloaded.config.groups, [id]);
  assert.deepEqual(hiddenTools(sdkSchemas(tools), unloaded.config), []);
  await fixturePlugin(ctx, id, [fixtureTool('replacement_after_reinstall')]);
  const reloaded = (await request()).body;
  assert.deepEqual(names(hiddenTools(sdkSchemas(tools), reloaded.config)), ['replacement_after_reinstall']);
});

test('unknown provenance is never inferred from a tool prefix and can only be selected explicitly', async t => {
  const { tools, request } = await hostFixture(t);
  tools.register(fixtureTool('ego_unknown', { description: 'Unknown provenance fixture' }));
  const schemas = sdkSchemas(tools);
  assert.equal(schemas.find(tool => tool.name === 'ego_unknown').plugin, null);
  const groups = enabledConfig({ groups: ['dsh-ego-browser', 'ego', 'ego_unknown'] });
  assert.ok(!names(hiddenTools(schemas, groups)).includes('ego_unknown'));
  const explicit = enabledConfig({ groups: [], tools: ['ego_unknown'] });
  assert.deepEqual(names(hiddenTools(schemas, explicit)), ['ego_unknown']);
  const result = discover(schemas, explicit, tsRuntime, {});
  assert.deepEqual(result.groups, []);
  assert.deepEqual(result.otherTools.map(tool => tool.name), ['ego_unknown']);
  assert.deepEqual(hiddenTools(schemas, { ...explicit, exclude: ['ego_unknown'] }), []);
  const status = (await request()).body;
  assert.ok(status.otherTools.some(tool => tool.name === 'ego_unknown'));
  assert.ok(status.groups.every(group => group.tools.every(tool => tool.name !== 'ego_unknown')));
  assert.ok(status.coverage.unknown > 0);
});

test('settings expose scoped-only plugin identity without leaking another scope tool details', async t => {
  const id = '@fixture/scoped-only';
  const { tools, agent, request, execute } = await hostFixture(t, { config: enabledConfig({ groups: [id] }) });
  const a = agent('private-owner');
  const b = agent('other-caller');
  const child = await fixturePlugin(a.ctx, id, [fixtureTool('private_capability', { description: 'PRIVATE_TOOL_DESCRIPTION', marker: 'privateOutputMarker' })]);
  assert.equal(tools.get('private_capability', b), undefined);
  assert.equal(tools.get('private_capability'), undefined);
  const status = (await request()).body;
  const group = status.groups.find(group => group.id === id);
  assert.ok(group);
  assert.equal(group.scopedOnly, true);
  assert.deepEqual(group.tools, []);
  assert.doesNotMatch(JSON.stringify(status), /private_capability|PRIVATE_TOOL_DESCRIPTION|privateOutputMarker/);
  const other = success(await execute('discover_tools', {}, { agent: b, nested: true }));
  assert.deepEqual(other.groups, []);
  const unavailable = success(await execute('discover_tools', { plugin: id }, { agent: b, nested: true }));
  assert.deepEqual(unavailable.tools, []);
  assert.equal(unavailable.sdk, '');
  assert.ok(unavailable.unavailable);
  assert.doesNotMatch(JSON.stringify(unavailable), /private_capability|PRIVATE_TOOL_DESCRIPTION|privateOutputMarker/);
  const own = success(await execute('discover_tools', { plugin: id }, { agent: a, nested: true }));
  assert.deepEqual(own.tools, ['private_capability']);
  assert.match(own.sdk, /PRIVATE_TOOL_DESCRIPTION/);
  assert.match(own.sdk, /privateOutputMarker/);
  await child.fiber.dispose();
  assert.ok(!(await request()).body.groups.some(group => group.id === id));
});

test('plugin metadata is detached provenance and never changes original TypeScript or Python SDK signatures', async t => {
  const { tools } = await hostFixture(t);
  const schemas = sdkSchemas(tools);
  const raw = tools.schemas().filter(tool => tool.name !== 'run_code').map(tool => ({ ...tool, output: structuredClone(tools.get(tool.name).output.schema) }));
  const snapshot = structuredClone(schemas);
  for (const programFormat of ['function-body', 'repl']) {
    assert.equal(renderSdk(schemas, { language: 'typescript', programFormat }), renderToolsSdk(raw, programFormat));
    assert.equal(renderSdk(schemas, { language: 'python', programFormat }), renderToolsSdkPy(raw, programFormat));
  }
  assert.deepEqual(schemas, snapshot);
  assert.equal(schemas.find(tool => tool.name === 'ego_visit').plugin.id, 'dsh-ego-browser');
});

test('v3 round-trips unavailable npm and local Loader specifiers without remapping legacy-looking ids', async t => {
  const { ctx, dir, tools, request } = await hostFixture(t);
  await fixturePlugin(ctx, './local plugin.js', [fixtureTool('totally_unrelated_local_tool')]);
  const ids = ['@uninstalled/package/subpath', 'browser', './local plugin.js', '../plugins/custom.js', '/absolute/custom plugin.js', 'file:///local/custom%20plugin.js', 'x'.repeat(512)];
  const config = enabledConfig({ groups: ids });
  const normalized = { ...config, groups: [...ids].sort() };
  assert.deepEqual(validateConfig(config), normalized);
  const response = await request('PUT', config);
  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.body.config, normalized);
  assert.deepEqual(response.body.groups.find(group => group.id === './local plugin.js').tools.map(tool => tool.name), ['totally_unrelated_local_tool']);
  assert.deepEqual(names(hiddenTools(sdkSchemas(tools), normalized)), ['totally_unrelated_local_tool']);
  assert.deepEqual(await new ConfigStore(dir).load(), normalized);
});

test('real Loader entry injection gates tools on origins while preserving static systemPrompt dependency', async t => {
  const ctx = new Context();
  t.after(() => ctx.fiber.dispose());
  const loader = new Loader(ctx);
  // Loader installs its isolation lifecycle plugin asynchronously. Wait before
  // creating entries, as the application host does during bootstrap.
  await ctx.fiber.await();
  const registerBefore = ToolRuntime.prototype.register;
  const trace = [];
  // Use the actual runtime module and the current base entry's gate; import is
  // mapped in memory so no live profile, disk plugin or process is involved.
  const modules = new Map([
    ['@deepseek-ai/dsh-tools', { default: ToolRuntime }],
    ['@delthin/dsh-tool-wrap/origin-bootstrap', originBootstrap],
    ['@fixture/gated-producer', { name: 'fixture-delayed-producer', inject: ['tools'], apply(child) {
      assert.equal(child.get('toolDiscoveryOriginsReady'), true);
      assert.notEqual(ToolRuntime.prototype.register, registerBefore);
      trace.push('register');
      child.tools.register(fixtureTool('first_unrelated_name'));
    } }],
  ]);
  loader.import = async name => { assert.ok(modules.has(name), name); return modules.get(name); };
  await loader.create({ id: 'producer', name: '@fixture/gated-producer' });
  await loader.create({ id: 'tools', name: '@deepseek-ai/dsh-tools', inject: { toolDiscoveryOriginsReady: null } });
  const toolsEntry = loader.resolve('tools');
  assert.ok(Object.hasOwn(toolsEntry.fiber.inject, 'systemPrompt'));
  assert.ok(Object.hasOwn(toolsEntry.fiber.inject, 'toolDiscoveryOriginsReady'));
  assert.equal(ctx.get('tools'), undefined);
  assert.deepEqual(trace, []);
  await loader.create({ id: 'origins', name: '@delthin/dsh-tool-wrap/origin-bootstrap' });
  await loader.resolve('origins').fiber.await();
  assert.equal(ctx.get('toolDiscoveryOriginsReady'), true);
  assert.equal(ctx.get('tools'), undefined, 'static systemPrompt injection must remain required');
  assert.deepEqual(trace, []);
  new SystemPrompt(ctx, { includeHarnessIdentity: false });
  await loader.await();
  assert.deepEqual(trace, ['register']);
  assert.equal(sdkSchemas(ctx.get('tools')).find(tool => tool.name === 'first_unrelated_name').plugin.id, '@fixture/gated-producer');
});

test('developer package descriptions feed catalog, custom overrides and removal restores metadata without SDK changes', async t => {
  const id = '@fixture/described';
  const author = 'AUTHOR_PACKAGE_OVERVIEW — not a tool description';
  const custom = 'CUSTOM_PACKAGE_OVERVIEW';
  const { ctx, tools, request, agent } = await hostFixture(t, { config: enabledConfig({ groups: [id] }) });
  ctx.provide('pluginPackages', { metaOf(moduleId) { return moduleId === id ? { description: { en: 'English metadata', 'zh-CN': author } } : undefined; } });
  await fixturePlugin(ctx, id, [fixtureTool('unrelated_described_tool', { description: 'ORIGINAL_TOOL_DESCRIPTION', marker: 'originalMetadataOutput' })]);
  const schemas = sdkSchemas(tools);
  const described = schemas.find(tool => tool.name === 'unrelated_described_tool');
  assert.equal(described.plugin.id, id);
  assert.equal(described.plugin.description, author);
  const group = catalog(schemas).find(group => group.id === id);
  assert.equal(group.description, author);
  assert.equal(group.descriptionSource, 'developer');
  assert.equal(catalog(schemas, enabledConfig(), { [id]: 'Explicit developer map' }).find(group => group.id === id).description, 'Explicit developer map');
  const overridden = enabledConfig({ groups: [id], descriptions: { [id]: custom } });
  assert.equal((await request('PUT', overridden)).statusCode, 200);
  let status = (await request()).body;
  assert.equal(status.groups.find(group => group.id === id).description, custom);
  assert.equal(status.groups.find(group => group.id === id).descriptionSource, 'custom');
  assert.equal(catalog(schemas, overridden, { [id]: 'Explicit developer map' }).find(group => group.id === id).description, custom);
  const a = agent('metadata-presentation');
  let assembly = await assemble(ctx, a);
  const sdkText = assembly.sections.find(section => section.name === 'tools:sdk').text;
  assert.match(sdkText, /CUSTOM_PACKAGE_OVERVIEW/);
  assert.doesNotMatch(sdkText, /AUTHOR_PACKAGE_OVERVIEW/);
  const loaded = discover(schemas, overridden, tsRuntime, { plugin: id });
  assert.match(loaded.sdk, /ORIGINAL_TOOL_DESCRIPTION/);
  assert.match(loaded.sdk, /originalMetadataOutput: string/);
  assert.doesNotMatch(loaded.sdk, /AUTHOR_PACKAGE_OVERVIEW|CUSTOM_PACKAGE_OVERVIEW|English metadata/);
  assert.equal((await request('PUT', enabledConfig({ groups: [id] }))).statusCode, 200);
  status = (await request()).body;
  assert.equal(status.groups.find(group => group.id === id).description, author);
  assert.equal(status.groups.find(group => group.id === id).descriptionSource, 'developer');
  assembly = await assemble(ctx, a);
  assert.match(assembly.sections.find(section => section.name === 'tools:sdk').text, /AUTHOR_PACKAGE_OVERVIEW/);
  for (const language of ['typescript', 'python']) {
    const rendered = renderSdk([described], { language, programFormat: 'function-body' });
    assert.doesNotMatch(rendered, /AUTHOR_PACKAGE_OVERVIEW|CUSTOM_PACKAGE_OVERVIEW|English metadata/);
    assert.match(rendered, /ORIGINAL_TOOL_DESCRIPTION/);
  }
});
