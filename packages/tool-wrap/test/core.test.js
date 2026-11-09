import test from 'node:test';
import assert from 'node:assert/strict';
import { renderToolsSdk } from '@deepseek-ai/dsh-tool-executor-ptc';
import { defineTool } from '@deepseek-ai/dsh-tools';
import { hiddenTools, discover, overview, sdkSchemas, validateConfig, DiscoveryError } from '../core.js';
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
  assert.throws(() => hiddenTools(schemas, enabledConfig({ tools: ['run_code', 'unwrap', 'discover_tools'] })), DiscoveryError);
  const protectedSchemas = ['run_code', 'unwrap', 'discover_tools'].map(name => ({ name, plugin: { id: 'dsh-ego-browser', label: 'Protected fixture' } }));
  assert.deepEqual(hiddenTools([...schemas, ...protectedSchemas], enabledConfig()).filter(tool => ['run_code', 'unwrap', 'discover_tools'].includes(tool.name)), []);
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

test('large schema packs retain all parameter and return constraints and annotations without SDK text', async t => {
  const { ctx, tools } = await hostFixture(t);
  const id = '@fixture/large-plugin';
  const description = 'Complete tool usage and approval instructions. '.repeat(100) + 'USAGE_TAIL';
  const definitions = Array.from({ length: 35 }, (_, index) => fixtureTool(`bulk_${String(index).padStart(2, '0')}`, { description }));
  definitions[0] = defineTool({
    name: 'bulk_00', description,
    parameters: {
      input: { type: 'string', required: true, title: 'Input title', default: 'default input', examples: ['example input'] },
      choice: { oneOf: [{ type: 'number' }, { type: 'integer' }], required: true },
      'not-an-identifier': { type: 'integer', required: true, description: 'Exact JSON field name' },
    },
    output: {
      schema: { type: 'object', additionalProperties: false, title: 'Output title', properties: {
        nested: { type: 'array', required: true, items: { oneOf: [{ type: 'number' }, { type: 'integer' }] } },
        'not-an-identifier': { type: 'integer', required: true, default: 3, examples: [7] },
      } },
      render: (_args, value) => [{ type: 'text', text: JSON.stringify(value) }],
    },
    execute: async () => ({ nested: [1.5], 'not-an-identifier': 3 }),
  });
  await fixturePlugin(ctx, id, definitions);
  const schemas = sdkSchemas(tools), config = enabledConfig({ groups: [id] });
  const originals = schemas.filter(tool => tool.plugin?.id === id).map(({ plugin, ...tool }) => tool);
  for (const runtime of [tsRuntime, { language: 'python', programFormat: 'repl' }]) {
    const result = discover(schemas, config, runtime, { plugin: id });
    assert.deepEqual(Object.keys(result), ['plugin', 'tools', 'schemas', 'sdk', 'usage', 'unavailable']);
    assert.deepEqual(discover(schemas, config, runtime, { plugin: id, format: 'full' }), result);
    assert.deepEqual(result.tools, definitions.map(tool => tool.name));
    assert.deepEqual(result.schemas, originals);
    const { sdk: duplicate, ...expected } = result;
    assert.ok(duplicate.length);
    const compact = discover(schemas, config, runtime, { plugin: id, format: 'schema' });
    assert.deepEqual({ ...compact, usage: result.usage }, expected);
    assert.deepEqual(compact.schemas, originals);
    assert.match(compact.usage, /parameter definitions, return constraints and annotations are in schemas/);
    assert.match(compact.usage, /one argument object \(a dict in Python\)/);
    const constrained = compact.schemas[0];
    assert.deepEqual(constrained.parameters.properties.choice.oneOf, [{ type: 'number' }, { type: 'integer' }]);
    assert.deepEqual(constrained.parameters.required, ['input', 'choice', 'not-an-identifier']);
    assert.equal(constrained.parameters.properties.input.default, 'default input');
    assert.deepEqual(constrained.parameters.properties.input.examples, ['example input']);
    assert.equal(constrained.output.additionalProperties, false);
    assert.deepEqual(constrained.output.properties.nested.items.oneOf, [{ type: 'number' }, { type: 'integer' }]);
    assert.equal(constrained.output.properties['not-an-identifier'].type, 'integer');
    assert.equal(constrained.output.title, 'Output title');
    for (const definition of compact.schemas) assert.match(definition.description, /USAGE_TAIL/);
    const fullChars = JSON.stringify(result).length, schemaChars = JSON.stringify(compact).length;
    assert.ok(schemaChars < fullChars);
    t.diagnostic(`35-tool ${runtime.language} fixture JSON characters: full=${fullChars}, schema=${schemaChars}, saved=${fullChars - schemaChars} (${((fullChars - schemaChars) * 100 / fullChars).toFixed(1)}%)`);
  }
});

test('catalog and directory bytes are independent of plugin and standalone registration order', async t => {
  const { tools } = await hostFixture(t);
  tools.register(fixtureTool('z_standalone'));
  tools.register(fixtureTool('a_standalone'));
  const schemas = sdkSchemas(tools), reversed = [...schemas].reverse();
  const config = enabledConfig({ tools: ['virtual_echo', 'z_standalone', 'a_standalone'] });
  const listing = discover(schemas, config, tsRuntime);
  assert.deepEqual(listing.otherTools.map(tool => tool.name), ['a_standalone', 'virtual_echo', 'z_standalone']);
  assert.equal(JSON.stringify(listing), JSON.stringify(discover(reversed, config, tsRuntime)));
  for (const runtime of [tsRuntime, { ...tsRuntime, programFormat: 'repl' }, { language: 'python', programFormat: 'repl' }]) {
    assert.equal(overview(hiddenTools(schemas, config), runtime, config), overview(hiddenTools(reversed, config), runtime, config));
  }
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
  for (const args of [{ query: 'dsh-ego-browser' }, { names: ['ego_visit', 'missing'] }, { tool: 'virtual_echo' }, { plugin: 'missing' }]) {
    const { sdk: duplicate, ...expected } = discover(schemas, config, tsRuntime, args);
    assert.equal(typeof duplicate, 'string');
    const compact = discover(schemas, config, tsRuntime, { ...args, format: 'schema' });
    assert.deepEqual({ ...compact, usage: expected.usage }, expected);
  }
  const keyword = discover(schemas, config, tsRuntime, { query: 'browser' });
  assert.deepEqual(keyword.tools, []);
  assert.equal(keyword.sdk, '');
  assert.ok(keyword.unavailable);
});

test('discovery rejects malformed exact selectors rather than widening selection', async t => {
  const { tools } = await hostFixture(t);
  const schemas = sdkSchemas(tools);
  for (const args of [{ plugin: null }, { plugin: 1 }, { plugin: [] }, { plugin: '' }, { plugin: 'x'.repeat(513) }, { tool: null }, { tool: ['virtual_echo'] }, { tool: '' }, { tool: 'has space' }, { plugin: 'dsh-ego-browser', tool: 'virtual_echo' }, { names: 'ego_visit' }, { names: [null] }, { names: Array(13).fill('ego_visit') }]) {
    assert.throws(() => discover(schemas, enabledConfig(), tsRuntime, args), DiscoveryError, JSON.stringify(args));
  }
  for (const format of ['', 'sdk', 'SCHEMA', 'json', null, 1, {}, []]) {
    for (const args of [{}, { plugin: 'dsh-ego-browser' }, { tool: 'virtual_echo' }, { query: 'dsh-ego-browser' }, { names: ['ego_visit'] }]) {
      assert.throws(() => discover(schemas, enabledConfig(), tsRuntime, { ...args, format }), DiscoveryError);
    }
  }
  assert.deepEqual(validateConfig(enabledConfig({ groups: ['dsh-image-gen', 'dsh-ego-browser', 'dsh-image-gen'], tools: ['z', 'a', 'z'] })), enabledConfig({ groups: ['dsh-ego-browser', 'dsh-image-gen'], tools: ['a', 'z'] }));
});
