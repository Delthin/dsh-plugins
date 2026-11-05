import test from 'node:test';
import assert from 'node:assert/strict';
import { renderPrompt } from '@deepseek-ai/dsh-system-prompt';
import { renderToolsSdk } from '@deepseek-ai/dsh-tool-executor-ptc';
import { assemble, enabledConfig, fixturePlugin, fixtureTool, hostFixture, sdkSection, success } from './fixture.js';

for (const mode of ['ptc', 'native']) test(`disabled ${mode} presentation is byte/schema-identical to pre-plugin host`, async t => {
  const { ctx, tools, agent, mount, request } = await hostFixture(t, { mode, config: enabledConfig({ enabled: false }), installPlugin: false });
  const a = agent(`disabled-${mode}`);
  const before = await assemble(ctx, a);
  await mount();
  const after = await assemble(ctx, a);
  assert.deepEqual(after, before);
  assert.equal(renderPrompt(after), renderPrompt(before));
  assert.doesNotMatch(renderPrompt(after), /discover_tools|# On-demand tools/);
  assert.ok(!after.tools.some(tool => tool.name === 'discover_tools'));
  assert.ok(tools.get('discover_tools'), 'disabled presentation must not rewrite registry capability');
  const status = (await request()).body;
  assert.equal(status.lastAssembly.status, 'disabled');
  assert.equal(status.estimate.hiddenCount, 0);
  assert.equal(status.estimate.savedChars, 0);
  assert.equal(status.estimate.estimatedSavedTokens, 0);
});

test('configuration toggle changes next projection only, preserving every tool identity and full excluded SDK', async t => {
  const { ctx, tools, agent, request } = await hostFixture(t, { config: enabledConfig({ enabled: false }) });
  const a = agent('settings-toggle');
  const definitions = tools.schemas(a).map(schema => [schema.name, tools.get(schema.name, a)]);
  const before = await assemble(ctx, a);
  const enabled = await request('PUT', enabledConfig({ groups: ['dsh-ego-browser'], exclude: ['ego_visit'] }));
  assert.equal(enabled.statusCode, 200);
  const projected = await assemble(ctx, a);
  const projectedSdk = sdkSection(projected).split('\n\n# On-demand tools')[0];
  assert.doesNotMatch(projectedSdk, /ego_capture:/);
  const expectedVisible = tools.schemas(a).filter(tool => !['run_code', 'ego_capture', 'ego_secret'].includes(tool.name))
    .map(tool => ({ ...tool, output: tools.get(tool.name, a).output.schema }));
  assert.equal(projectedSdk, renderToolsSdk(expectedVisible, 'function-body'));
  assert.match(projectedSdk, /always_visible:/);
  assert.equal((await request('PUT', enabledConfig({ enabled: false }))).statusCode, 200);
  const restored = await assemble(ctx, a);
  assert.deepEqual(restored, before);
  for (const [name, definition] of definitions) assert.equal(tools.get(name, a), definition);
});

test('settings list only registered schedule tools; scoped schedules remain caller-only', async t => {
  const id = '@deepseek-ai/dsh-tool-schedule';
  const { tools, agent, request, execute } = await hostFixture(t);
  const a = agent('schedule-candidates');
  a.ctx.tools.restrict({ deny: ['schedule_list'] });
  const status = (await request()).body;
  const group = status.groups.find(group => group.id === id);
  assert.deepEqual(group.tools.map(tool => tool.name), ['schedule_list']);
  assert.ok(group.tools.every(tool => !Object.hasOwn(tool, 'candidate')));
  assert.ok(!tools.schemas(a).some(tool => tool.name === 'schedule_create'));
  const overview = success(await execute('discover_tools', {}, { agent: a, nested: true }));
  assert.ok(!overview.groups.some(group => group.id === id));
  const exact = success(await execute('discover_tools', { plugin: id }, { agent: a, nested: true }));
  assert.deepEqual(exact.tools, []);
  assert.ok(exact.unavailable);
  assert.equal(exact.sdk, '');
  await fixturePlugin(a.ctx, id, [fixtureTool('schedule_create', { description: 'SCOPED_SCHEDULE_ONLY', marker: 'scopedScheduleMarker' })]);
  const scoped = success(await execute('discover_tools', { plugin: id }, { agent: a, nested: true }));
  assert.deepEqual(scoped.tools, ['schedule_create']);
  assert.match(scoped.sdk, /SCOPED_SCHEDULE_ONLY/);
  assert.match(scoped.sdk, /scopedScheduleMarker: string/);
  assert.doesNotMatch(scoped.sdk, /schedule_list:/);
  const b = agent('other-schedule-scope');
  const other = success(await execute('discover_tools', { plugin: id }, { agent: b, nested: true }));
  assert.deepEqual(other.tools, ['schedule_list']);
  assert.doesNotMatch(JSON.stringify(other), /schedule_create|SCOPED_SCHEDULE_ONLY|scopedScheduleMarker/);
});
