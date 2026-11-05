import test from 'node:test';
import assert from 'node:assert/strict';
import { renderToolsSdk, renderToolsSdkPy } from '@deepseek-ai/dsh-tool-executor-ptc';
import { hiddenTools, discover, project, renderSdk, sdkSchemas, validateConfig, DiscoveryError } from '../core.js';
import { enabledConfig, fixturePlugin, fixtureTool, hostFixture, tsRuntime } from './fixture.js';

const names = tools => tools.map(tool => tool.name).sort();

test('group selection, exact tool selection and exclusion have independent precedence', async t => {
  const { tools } = await hostFixture(t);
  const schemas = sdkSchemas(tools);
  assert.deepEqual(names(hiddenTools(schemas, enabledConfig({ groups: ['dsh-ego-browser'] }))), ['ego_capture', 'ego_secret', 'ego_visit']);
  assert.deepEqual(names(hiddenTools(schemas, enabledConfig({ groups: [], tools: ['virtual_echo', 'ego_visit', 'missing'] }))), ['ego_visit', 'virtual_echo']);
  assert.deepEqual(names(hiddenTools(schemas, enabledConfig({ groups: ['dsh-ego-browser'], tools: ['virtual_echo', 'ego_visit'], exclude: ['ego_visit', 'virtual_echo'] }))), ['ego_capture', 'ego_secret']);
  assert.deepEqual(hiddenTools(schemas, enabledConfig({ enabled: false })), []);
  assert.deepEqual(hiddenTools(schemas, enabledConfig({ groups: [], tools: [] })), []);
  assert.throws(() => hiddenTools(schemas, enabledConfig({ tools: ['run_code', 'discover_tools'] })), DiscoveryError);
  const protectedSchemas = ['run_code', 'discover_tools'].map(name => ({ name, plugin: { id: 'dsh-ego-browser', label: 'Protected fixture' } }));
  assert.deepEqual(hiddenTools([...schemas, ...protectedSchemas], enabledConfig()).filter(tool => ['run_code', 'discover_tools'].includes(tool.name)), []);
});

test('only selected SDK definitions disappear; all other definitions retain full signatures and documentation', async t => {
  const { tools } = await hostFixture(t);
  const schemas = sdkSchemas(tools);
  const config = enabledConfig({ groups: ['dsh-ego-browser'], exclude: ['ego_capture'] });
  const projection = project(schemas, config, tsRuntime);
  const sdkOnly = projection.text.split('\n\n# On-demand tools')[0];
  const visible = schemas.filter(schema => !['ego_visit', 'ego_secret'].includes(schema.name));
  assert.equal(sdkOnly, renderToolsSdk(visible, 'function-body'));
  assert.doesNotMatch(sdkOnly, /ego_visit:|ego_secret:/);
  for (const name of ['ego_capture', 'generate_image', 'schedule_list', 'virtual_echo', 'always_visible', 'discover_tools']) assert.match(sdkOnly, new RegExp(`${name}:`));
  assert.match(sdkOnly, /globalMarker full output documentation/);
  assert.match(sdkOnly, /values: number\[\]/);
  const disabled = project(schemas, enabledConfig({ enabled: false }), tsRuntime);
  assert.equal(disabled.text, renderToolsSdk(schemas.filter(tool => tool.name !== 'discover_tools'), 'function-body'));
  assert.equal(disabled.estimate.savedChars, 0);
  assert.equal(disabled.estimate.estimatedSavedTokens, 0);
  assert.equal(project(schemas, enabledConfig({ groups: [] }), tsRuntime).text, renderToolsSdk(schemas, 'function-body'));
  assert.equal(projection.estimate.hiddenCount, 2);
  assert.equal(projection.estimate.afterChars, projection.text.length);
  assert.equal(projection.estimate.savedChars, projection.estimate.beforeChars - projection.text.length);
});

test('catalog exposes plugin summaries and all deferred names without schemas, tool descriptions or execution', async t => {
  const { tools, calls } = await hostFixture(t);
  const schemas = sdkSchemas(tools);
  const overview = discover(schemas, enabledConfig({ tools: ['virtual_echo'], descriptions: { 'dsh-ego-browser': '浏览网页与截图' } }), tsRuntime, {});
  assert.deepEqual(overview.groups.map(group => group.id), ['@deepseek-ai/dsh-tool-schedule', 'dsh-ego-browser', 'dsh-image-gen']);
  for (const group of overview.groups) {
    assert.deepEqual(Object.keys(group).sort(), ['description', 'descriptionSource', 'id', 'label', 'toolCount', 'tools']);
    assert.equal(typeof group.label, 'string');
    assert.equal(group.toolCount, group.id === 'dsh-ego-browser' ? 3 : 1);
    assert.equal(group.descriptionSource, group.id === 'dsh-ego-browser' ? 'custom' : 'missing');
  }
  assert.equal(overview.groups.find(group => group.id === 'dsh-ego-browser').description, '浏览网页与截图');
  assert.equal(overview.groups.find(group => group.id === 'dsh-image-gen').description, '');
  assert.deepEqual(overview.otherTools.map(tool => tool.name), ['virtual_echo']);
  assert.deepEqual(Object.keys(overview.otherTools[0]).sort(), ['description', 'name']);
  assert.deepEqual(overview.groups.find(group => group.id === 'dsh-ego-browser').tools, ['ego_capture', 'ego_secret', 'ego_visit']);
  assert.doesNotMatch(JSON.stringify(overview.groups), /RESTRICTED_SECRET_DESCRIPTION|parameters|globalMarker/);
  assert.deepEqual(calls, []);
});

test('startup catalog lists every deferred name, excludes full tool details and prompts proactive single-pack loading', async t => {
  const { tools, calls } = await hostFixture(t);
  const config = enabledConfig({ groups: ['dsh-ego-browser'], exclude: ['ego_capture'] });
  const text = project(sdkSchemas(tools), config, tsRuntime).text.split('\n\n# On-demand tools')[1];
  const rows = text.split('\n').filter(line => line.startsWith('- {')).map(line => JSON.parse(line.slice(2)));
  assert.deepEqual(rows, [{ plugin: 'dsh-ego-browser', description: 'No description provided. Load this plugin to inspect its tools.', tools: ['ego_secret', 'ego_visit'] }]);
  assert.match(text, /proactively call discover_tools/);
  assert.match(text, /Do not wait for the user/);
  assert.match(text, /only ONE plugin pack per run_code/);
  assert.match(text, /never guess parameters/);
  assert.doesNotMatch(text, /RESTRICTED_SECRET_DESCRIPTION|ego_capture|globalMarker|parameters:|ToolArgsMap/);
  assert.deepEqual(calls, []);
});

test('exact plugin returns its complete hidden SDK and original usage, without keyword or partial matching', async t => {
  const { tools, calls } = await hostFixture(t);
  const schemas = sdkSchemas(tools);
  const config = enabledConfig({ exclude: ['ego_capture'] });
  const result = discover(schemas, config, tsRuntime, { plugin: 'dsh-ego-browser' });
  assert.equal(result.plugin, 'dsh-ego-browser');
  assert.deepEqual([...result.tools].sort(), ['ego_secret', 'ego_visit']);
  const originals = schemas.filter(tool => ['ego_visit', 'ego_secret'].includes(tool.name));
  assert.equal(result.sdk, renderToolsSdk(originals, 'function-body'));
  assert.match(result.sdk, /Original usage: preserve login and approval rules/);
  assert.match(result.sdk, /input: string/);
  assert.match(result.sdk, /globalMarker: string/);
  assert.match(result.sdk, /globalMarker full output documentation/);
  assert.match(result.sdk, /details: \{/);
  assert.match(result.sdk, /values: number\[\]/);
  assert.match(result.usage, /normal host checks/);
  assert.match(result.usage, /image provider and canvas state/);
  for (const plugin of ['browser', '浏览器', 'dsh-ego', 'DSH-EGO-BROWSER', 'ego_visit', 'missing']) {
    const unavailable = discover(schemas, config, tsRuntime, { plugin });
    assert.deepEqual(unavailable.tools, [], plugin);
    assert.equal(unavailable.sdk, '', plugin);
    assert.ok(unavailable.unavailable, plugin);
  }
  assert.deepEqual(discover(schemas, enabledConfig({ enabled: false }), tsRuntime, { plugin: 'dsh-ego-browser' }).tools, []);
  assert.deepEqual(calls, []);
});

test('plugin packages are not truncated at former exact-name or search limits', async t => {
  const { ctx, tools } = await hostFixture(t);
  const id = '@fixture/large-plugin';
  const definitions = Array.from({ length: 35 }, (_, index) => fixtureTool(`bulk_${String(index).padStart(2, '0')}`));
  await fixturePlugin(ctx, id, definitions);
  const result = discover(sdkSchemas(tools), enabledConfig({ groups: [id] }), tsRuntime, { plugin: id });
  assert.deepEqual([...result.tools].sort(), definitions.map(tool => tool.name));
  for (const definition of definitions) assert.match(result.sdk, new RegExp(`${definition.name}:`));
});

test('unowned tools use exact single-tool packages and cannot select a plugin-owned tool', async t => {
  const { tools } = await hostFixture(t);
  const schemas = sdkSchemas(tools);
  const config = enabledConfig({ tools: ['virtual_echo'] });
  const result = discover(schemas, config, tsRuntime, { tool: 'virtual_echo' });
  assert.deepEqual(result.tools, ['virtual_echo']);
  assert.equal(result.sdk, renderToolsSdk(schemas.filter(tool => tool.name === 'virtual_echo'), 'function-body'));
  for (const tool of ['ego_visit', 'always_visible', 'missing']) {
    const unavailable = discover(schemas, config, tsRuntime, { tool });
    assert.deepEqual(unavailable.tools, []);
    assert.equal(unavailable.sdk, '');
    assert.ok(unavailable.unavailable);
  }
});

test('pure core retains exact legacy names and module-id query aliases without keyword search', async t => {
  const { tools } = await hostFixture(t);
  const schemas = sdkSchemas(tools);
  const config = enabledConfig();
  const exact = discover(schemas, config, tsRuntime, { names: ['ego_visit', 'ego_visit', 'always_visible', 'missing', 'run_code'] });
  assert.deepEqual(exact.tools, ['ego_visit']);
  assert.deepEqual(exact.unavailable, ['always_visible', 'missing', 'run_code']);
  assert.equal(exact.sdk, renderToolsSdk(schemas.filter(tool => tool.name === 'ego_visit'), 'function-body'));
  assert.deepEqual(discover(schemas, config, tsRuntime, { query: 'dsh-ego-browser' }).tools.sort(), ['ego_capture', 'ego_secret', 'ego_visit']);
  const keyword = discover(schemas, config, tsRuntime, { query: 'browser' });
  assert.deepEqual(keyword.tools, []);
  assert.equal(keyword.sdk, '');
  assert.ok(keyword.unavailable);
});

test('language/program-format rendering follows host TypeScript and Python renderers', async t => {
  const { tools } = await hostFixture(t);
  const schemas = sdkSchemas(tools);
  for (const programFormat of ['function-body', 'repl']) {
    assert.equal(renderSdk(schemas, { language: 'typescript', programFormat }), renderToolsSdk(schemas, programFormat));
    assert.equal(renderSdk(schemas, { language: 'python', programFormat }), renderToolsSdkPy(schemas, programFormat));
  }
  const python = project(schemas, enabledConfig(), { language: 'python', programFormat: 'function-body' });
  assert.match(python.text, /print\(await tools.discover_tools/);
  assert.throws(() => renderSdk(schemas, { language: 'unavailable' }), DiscoveryError);
});

test('discovery rejects malformed exact selectors rather than widening selection', async t => {
  const { tools } = await hostFixture(t);
  const schemas = sdkSchemas(tools);
  for (const args of [{ plugin: null }, { plugin: 1 }, { plugin: [] }, { plugin: '' }, { plugin: 'x'.repeat(513) }, { tool: null }, { tool: ['virtual_echo'] }, { tool: '' }, { tool: 'has space' }, { plugin: 'dsh-ego-browser', tool: 'virtual_echo' }, { names: 'ego_visit' }, { names: [null] }, { names: Array(13).fill('ego_visit') }]) {
    assert.throws(() => discover(schemas, enabledConfig(), tsRuntime, args), DiscoveryError, JSON.stringify(args));
  }
  assert.deepEqual(validateConfig(enabledConfig({ groups: ['dsh-image-gen', 'dsh-ego-browser', 'dsh-image-gen'], tools: ['z', 'a', 'z'] })), enabledConfig({ groups: ['dsh-ego-browser', 'dsh-image-gen'], tools: ['a', 'z'] }));
});

// The model-facing contract intentionally excludes compatibility-only core arguments.
test('public discover_tools schema exposes only optional exact plugin and unowned-tool selectors', async t => {
  const { tools } = await hostFixture(t);
  const schema = tools.schemas().find(tool => tool.name === 'discover_tools');
  assert.ok(schema);
  assert.deepEqual(Object.keys(schema.parameters.properties).sort(), ['plugin', 'tool']);
  for (const parameter of Object.values(schema.parameters.properties)) {
    assert.equal(parameter.type, 'string');
    assert.ok(!schema.parameters.required?.includes(Object.entries(schema.parameters.properties).find(([, value]) => value === parameter)[0]));
  }
});
