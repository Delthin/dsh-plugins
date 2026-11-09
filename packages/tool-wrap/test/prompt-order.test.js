import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir, stat } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { Readable } from 'node:stream';
import { SystemPrompt, renderPrompt } from '@deepseek-ai/dsh-system-prompt';
import { createUserMessage, createSystemMessage, createToolResultMessage } from '@deepseek-ai/dsh-llm';
import { CompositionStore, ownerId, instructionId, sourceId, effectiveRule, validateComposition, validateCapabilities } from '../prompt-composition.js';
import { PromptOrderStore } from '../prompt-order.js';
import * as discoveryPlugin from '../index.js';
import { promptMessageDescriptor, commitPromptComposition, restorePromptComposition, hasPromptComposition } from '../host-support/admission.js';
import { PATCHES, patchSource } from '../host-support/patches.js';
import { hostFixture, fixturePlugin, temporaryDirectory, success, pluginIds, enabledConfig } from './fixture.js';

const config = overrides => ({ version: 1, enabled: false, order: [], rules: {}, ...overrides });
async function request(host, method = 'GET', value, headers = {}) {
  const req = Readable.from(value === undefined ? [] : [JSON.stringify(value)]);
  req.method = method; req.headers = { 'content-type': 'application/json', ...headers };
  const res = { statusCode: 0, destroyed: false, setHeader() {}, end(body) { this.body = JSON.parse(body); } };
  await host.routes.get('/api/tool-discovery/prompt-composition')(req, res);
  return res;
}
const modelMessages = session => session.surface.nodes.map(seq => session.deriveEventMessage(session.eventAt(seq))).filter(Boolean);
const body = messages => messages.map(message => message.content.filter(block => block.type === 'text').map(block => block.text).join('\n')).join('\n');
async function originalSource(patch) {
  const packageDir = dirname(fileURLToPath(import.meta.resolve(patch.name + '/package.json')));
  return readFile(join(packageDir, patch.file ?? 'lib/index.js'), 'utf8');
}
async function adaptedModule(name, extra = '') {
  const patch = PATCHES.find(patch => patch.name === name);
  let source = patchSource(await originalSource(patch), patch);
  source = source.replace(/from (["'])([^"']+)\1/g, (_all, _quote, specifier) => {
    const url = specifier === './tool-wrap-admission.js' ? new URL('../host-support/admission.js', import.meta.url).href : import.meta.resolve(specifier);
    return 'from ' + JSON.stringify(url);
  });
  return import('data:text/javascript;base64,' + Buffer.from(source + '\n' + extra).toString('base64'));
}

// Real risks: migration must not erase preferences; unsupported roles must not be saved.
test('composition migration, atomic failure recovery and capability validation preserve existing settings', async t => {
  const dir = await temporaryDirectory(t);
  const legacy = new PromptOrderStore(dir);
  await legacy.save({ version: 1, enabled: true, plugins: ['@fixture/removed', '@fixture/present'] });
  const store = new CompositionStore(dir), migrated = await store.load();
  assert.deepEqual(migrated, config({ order: [ownerId('@fixture/removed'), ownerId('@fixture/present')] }));
  assert.equal((await stat(store.path)).mode & 0o777, 0o600);
  assert.equal(JSON.parse(await readFile(legacy.path, 'utf8')).enabled, true);
  const saved = config({ rules: { [ownerId('@fixture/removed')]: { role: 'system', delivery: 'always' } }, order: migrated.order });
  await store.save(saved);
  assert.deepEqual(validateComposition(saved), saved, 'old v1 rules must not acquire extra fields');
  assert.deepEqual(await new CompositionStore(dir).load(), saved, 'legacy v1 read/write must not add sourceOrder');
  for (const sourceOrder of [undefined, ['same', 'same'], [' invalid'], ['bad\u0000id'], Array.from({ length: 1025 }, (_, index) => String(index))]) {
    assert.throws(() => validateComposition(config({ sourceOrder })), /逐项顺序/);
  }
  const flatSaved = { ...saved, sourceOrder: ['fixture:removed-source'] };
  await store.save(flatSaved);
  assert.deepEqual(await new CompositionStore(dir).load(), flatSaved);
  const missingSources = [{ id: flatSaved.sourceOrder[0], kind: 'unavailable' }];
  for (const sources of [[], missingSources]) {
    validateCapabilities(flatSaved, sources, { admission: false }, flatSaved);
    assert.throws(() => validateCapabilities(flatSaved, sources, { admission: false }, saved), /未知提示词来源/);
  }
  await store.save(saved);
  assert.throws(() => validateComposition(config({ rules: { missing: { role: 'inherit', delivery: 'inherit', enabled: undefined } } })), /规则无效/);
  validateCapabilities(saved, [], { admission: false }, saved);
  const missingId = ownerId('@fixture/removed');
  const disabled = config({ ...saved, rules: { [missingId]: { ...saved.rules[missingId], enabled: false } } });
  await store.save(disabled);
  assert.deepEqual(await new CompositionStore(dir).load(), disabled);
  const unavailable = [{ id: missingId, kind: 'unavailable', roles: ['inherit'], deliveryModes: ['inherit'] }];
  validateCapabilities(disabled, unavailable, { admission: true }, disabled);
  for (const sources of [[], unavailable]) assert.throws(() => validateCapabilities(disabled, sources, { admission: true }, saved), /来源已变化/);
  assert.throws(() => validateCapabilities(saved, unavailable, { admission: true }, disabled), /来源已变化/);
  await store.save(saved);
  const path = store.path;
  store.path = join(dir, 'absent', 'prompt-composition.json');
  await assert.rejects(store.save(config()), /原配置保留/);
  assert.deepEqual(store.config, saved);
  assert.deepEqual(JSON.parse(await readFile(path, 'utf8')), saved);
  store.path = path;
  await Promise.all([store.save(config({ order: ['a'] })), store.save(saved)]);
  assert.deepEqual(await new CompositionStore(dir).load(), saved);
  assert.deepEqual(effectiveRule(config({ rules: { group: { role: 'system', delivery: 'pack', enabled: false }, child: { role: 'inherit', delivery: 'always', enabled: true } } }), { id: 'child', groupId: 'group', owner: null }), { role: 'system', delivery: 'always', enabled: true });
  assert.deepEqual(effectiveRule(saved, { id: 'child', owner: null }), { role: 'inherit', delivery: 'inherit', enabled: true });
  const host = await hostFixture(t);
  const status = (await request(host)).body;
  assert.equal(status.capabilities.available, false);
  assert.ok(status.sources.some(source => source.id === 'instructions:global'));
  assert.ok(status.sources.some(source => source.label === 'tool-discovery:directory'));
  assert.equal((await request(host, 'PUT', config({ enabled: true }))).statusCode, 409);
  const source = status.sources.find(source => source.kind === 'section');
  assert.equal((await request(host, 'PUT', config({ rules: { [source.id]: { role: 'developer', delivery: 'inherit' } } }))).statusCode, 409);
  assert.equal((await request(host, 'GET', undefined, { 'x-fixture-reject': '1' })).statusCode, 403);
  assert.deepEqual((await request(host)).body.config, config());
  const toolOnlyGroups = Object.values(pluginIds).map(id => status.sources.find(source => source.id === ownerId(id)));
  for (const group of toolOnlyGroups) {
    assert.ok(group, 'trusted tools-only plugins must have an orderable source');
    assert.equal(group.kind, 'group');
    assert.equal(group.groupId, ownerId(group.owner));
    assert.deepEqual(group.children, []);
    assert.deepEqual(group.roles, ['inherit']);
    assert.deepEqual(group.deliveryModes, ['inherit']);
    assert.equal(group.canToggleInjection, false);
    assert.equal(Object.hasOwn(group, 'text'), false);
    assert.equal(Object.hasOwn(group, 'preview'), false);
  }
  const ordered = config({ order: toolOnlyGroups.map(group => group.id).reverse() });
  assert.equal((await request(host, 'PUT', ordered)).statusCode, 200);
  assert.deepEqual((await request(host)).body.config, ordered);
  for (const unknown of ['tools:' + pluginIds.browser, ownerId('@fixture/not-registered')]) {
    assert.equal((await request(host, 'PUT', config({ order: [...ordered.order, unknown] }))).statusCode, 409);
  }
  assert.deepEqual((await request(host)).body.config, ordered, 'unknown IDs must not overwrite the saved order');
  const composition = host.ctx.get('toolWrapPromptComposition');
  composition.observe({ id: 'fixture:custom-source', owner: pluginIds.browser, kind: 'message', groupId: 'fixture:custom-group', groupLabel: 'Custom browser group' });
  const browserGroups = (await request(host)).body.sources.filter(source => source.kind === 'group' && source.owner === pluginIds.browser);
  assert.deepEqual(browserGroups.map(group => group.id), ['fixture:custom-group'], 'an existing custom owner group must not acquire an empty duplicate');
  const legacyDraft = { ...ordered, order: [...ordered.order, ...flatSaved.sourceOrder] };
  await composition.store.save(legacyDraft);
  assert.equal((await request(host)).body.sources.find(source => source.id === flatSaved.sourceOrder[0]).kind, 'unavailable');
  const flatDraft = { ...legacyDraft, sourceOrder: flatSaved.sourceOrder };
  assert.equal((await request(host, 'PUT', flatDraft)).statusCode, 200, 'first flat save preserves absent IDs already saved in legacy order');
  assert.deepEqual(await new CompositionStore(host.dir).load(), flatDraft);
  assert.equal((await request(host, 'PUT', flatDraft)).statusCode, 200);
  assert.equal((await request(host, 'PUT', { ...flatDraft, sourceOrder: [...flatDraft.sourceOrder, 'fixture:unknown'] })).statusCode, 409);
  assert.deepEqual((await request(host)).body.config, flatDraft);
  const extended = { ...flatDraft, sourceOrder: [...flatDraft.sourceOrder, 'fixture:custom-source'] };
  assert.equal((await request(host, 'PUT', extended)).statusCode, 200);
  assert.deepEqual((await request(host)).body.config, extended);
});

// Real risks: role promotion/demotion, caller isolation and required-context refresh.
test('final admission composes all trusted sources, keeps caller packs isolated and replays role restoration', async t => {
  const [patchedPrompt, patchedInstructions, patchedSession, loop] = await Promise.all([
    adaptedModule('@deepseek-ai/dsh-system-prompt'), adaptedModule('@deepseek-ai/dsh-agent-instructions'), adaptedModule('@deepseek-ai/dsh-session'),
    adaptedModule('@deepseek-ai/dsh-agent-loop', 'export { ReactLoopAgent, SystemPromptProjection, RuntimeContextProjection };'),
  ]);
  const originals = new Map();
  for (const name of ['assemble', 'refreshContext', 'admitContributions', 'promptCompositionVersion']) {
    originals.set(name, Object.getOwnPropertyDescriptor(SystemPrompt.prototype, name));
    Object.defineProperty(SystemPrompt.prototype, name, Object.getOwnPropertyDescriptor(patchedPrompt.SystemPrompt.prototype, name));
  }
  t.after(() => { for (const [name, descriptor] of originals) { if (descriptor) Object.defineProperty(SystemPrompt.prototype, name, descriptor); else delete SystemPrompt.prototype[name]; } });
  const host = await hostFixture(t), { ctx, tools } = host;
  const a = host.agent('composition-a'), b = host.agent('composition-b');
  a.session = new patchedSession.Session('composition-a');
  a.session.append('turn/start', { turn: 1 }); a.session.append('step/start', { turn: 1, step: 1 });
  let contextCalls = 0;
  const plugin = await fixturePlugin(a.ctx, pluginIds.browser);
  plugin.systemPrompt.section({ name: 'pack:guide', order: 200, text: context => 'GUIDE_A_' + context.marker, interpolate: false });
  plugin.systemPrompt.context({ name: 'pack:required', order: 20, required: true, text: context => { contextCalls++; return 'REQUIRED_A_' + context.marker; } });
  const image = await fixturePlugin(a.ctx, pluginIds.image);
  const orderedSources = [
    [plugin, pluginIds.browser, 'A1'], [plugin, pluginIds.browser, 'A2'],
    [image, pluginIds.image, 'B1'], [image, pluginIds.image, 'TAIL1'], [image, pluginIds.image, 'TAIL2'],
  ].map(([owner, id, name], index) => {
    owner.systemPrompt.section({ name: 'sort:' + name, order: 300 + index, text: 'SORT_' + name });
    return sourceId('section', id, 'sort:' + name);
  });
  const [a1, a2, b1] = orderedSources;
  const guideId = sourceId('section', pluginIds.browser, 'pack:guide');
  const requiredId = sourceId('context', pluginIds.browser, 'pack:required');
  const other = await fixturePlugin(b.ctx, pluginIds.browser);
  other.systemPrompt.context({ name: 'pack:required', order: 20, required: true, text: 'PRIVATE_B_ONLY' });
  a.ctx.tools.restrict({ deny: ['ego_secret'] });
  ctx.on('system-prompt/assemble', async (_assembly, _context, next) => {
    const assembly = await next();
    return { ...assembly, sections: [...assembly.sections, { name: 'mnemon:strategy', text: 'DYNAMIC_STRATEGY', interpolate: false }] };
  });
  const composition = ctx.get('toolWrapPromptComposition');
  assert.equal(composition.capabilities().available, true);
  const plain = createUserMessage({ content: [{ type: 'text', text: 'ORDINARY_USER_DO_NOT_PROMOTE' }], source: { kind: 'user' } });
  const relay = createUserMessage({ content: [{ type: 'text', text: 'TEAM_RELAY_KEEP_USER' }], source: { kind: 'team-message', form: 'relay' } });
  const instruction = createUserMessage({ content: [{ type: 'text', text: 'ORIGINAL_AGENT_FRAME' }], source: { kind: 'agent-instructions', form: 'instructions', baseline: true, baselineIdentity: 'project-a', changes: [], compositionSections: [
    { key: '/fixture/home/AGENTS.md', path: '$DSH_HOME/AGENTS.md', scope: 'global', action: 'set', text: 'GLOBAL_FILE_BODY' },
    { key: '/fixture/project-a/AGENTS.md', path: 'AGENTS.md', scope: 'project', action: 'set', text: 'PROJECT_A_FILE_BODY' },
  ] } });
  const catalog = createUserMessage({ content: [{ type: 'text', text: 'SKILL_CATALOG_BODY' }], source: { kind: 'skill-catalog', form: 'catalog', entries: [] } });
  const snapshot = createUserMessage({ content: [{ type: 'text', text: 'MEMORY_SNAPSHOT_BODY' }], source: { kind: 'fixture-memory', form: 'snapshot', sections: [{ name: 'memory', text: 'MEMORY_SNAPSHOT_BODY' }] } });
  const mnemon = createUserMessage({ content: [{ type: 'text', text: 'REAL_MNEMON_RECALL_ENVELOPE' }], source: { kind: 'dsh-mnemon', form: 'recall' } });
  const recalledData = createUserMessage({ content: [{ type: 'text', text: 'UNTRUSTED_RECALL_KEEP_DATA' }], source: { kind: 'fixture-recall', form: 'recall' } });
  assert.equal(promptMessageDescriptor(mnemon).owner, 'dsh-mnemon');
  assert.equal(promptMessageDescriptor(mnemon).form, 'snapshot');
  assert.equal(promptMessageDescriptor(recalledData), undefined);
  const catalogId = promptMessageDescriptor(catalog).id;
  await composition.store.save(config({ enabled: true, order: [ownerId(pluginIds.image), ownerId(pluginIds.browser)], rules: {
    ...Object.fromEntries(orderedSources.map(id => [id, { role: 'inherit', delivery: 'always' }])),
    'instructions:global': { role: 'system', delivery: 'always' },
    [catalogId]: { role: 'system', delivery: 'always' },
    [ownerId('dsh-mnemon')]: { role: 'system', delivery: 'always' },
    [sourceId('section', null, 'mnemon:strategy')]: { role: 'user', delivery: 'always' },
  } }));
  const signal = new AbortController().signal;
  const toolSet = await tools.resolve({ agent: a, modelSelection: { provider: 'fixture', model: 'fixture' }, signal });
  t.after(() => toolSet.dispose());
  const assembly = await ctx.systemPrompt.assemble({ scope: a, toolSet, marker: 'EXACT_STEP' });
  const refreshed = ctx.systemPrompt.refreshContext(assembly, { scope: a, marker: 'EXACT_STEP', signal });
  const messages = [plain, instruction, catalog, snapshot, mnemon, recalledData, relay];
  const legacyPlan = await ctx.systemPrompt.admitContributions({ agent: a, assembly: refreshed, messages, toolSet, signal });
  const sortNames = text => text.match(/SORT_(?:A1|A2|B1|TAIL1|TAIL2)/g) ?? [];
  assert.deepEqual(sortNames(legacyPlan.systemText), ['SORT_B1', 'SORT_TAIL1', 'SORT_TAIL2', 'SORT_A1', 'SORT_A2']);
  const flatConfig = { ...composition.store.config, sourceOrder: [a1, b1, a2, requiredId, guideId, 'fixture:removed-source'] };
  await composition.store.save(flatConfig);
  const plan = await ctx.systemPrompt.admitContributions({ agent: a, assembly: refreshed, messages, toolSet, signal });
  assert.deepEqual(sortNames(plan.systemText), ['SORT_A1', 'SORT_B1', 'SORT_A2', 'SORT_TAIL1', 'SORT_TAIL2']);
  assert.match(plan.systemText, /GLOBAL_FILE_BODY/);
  assert.match(plan.systemText, /SKILL_CATALOG_BODY/);
  assert.match(plan.systemText, /REAL_MNEMON_RECALL_ENVELOPE/);
  assert.doesNotMatch(plan.systemText, /UNTRUSTED_RECALL_KEEP_DATA/);
  assert.doesNotMatch(plan.systemText, /ORDINARY_USER|TEAM_RELAY|GUIDE_A|REQUIRED_A/);
  assert.ok(plan.contributions.some(part => part.text === 'DYNAMIC_STRATEGY' && part.role === 'user'));
  assert.ok(plan.contributions.some(part => part.text === 'MEMORY_SNAPSHOT_BODY'));
  const beforeUnwrap = contextCalls;
  const pack = success(await host.execute('unwrap', { plugin: pluginIds.browser }, { agent: a, nested: true, toolSet }));
  assert.ok(pack.schemas.some(schema => schema.name === 'ego_visit' && schema.parameters && schema.output));
  assert.ok(!pack.tools.includes('ego_secret'));
  assert.match(JSON.stringify(pack.guidance), /GUIDE_A_EXACT_STEP/);
  assert.match(JSON.stringify(pack.guidance), /REQUIRED_A_EXACT_STEP/);
  assert.deepEqual(pack.guidance.map(source => source.id), [requiredId, guideId], 'on-demand guidance uses the same flat source ranks');
  assert.doesNotMatch(JSON.stringify(pack), /PRIVATE_B_ONLY/);
  assert.equal(contextCalls, beforeUnwrap, 'unwrap must not reevaluate dynamic context providers');
  assert.deepEqual(await composition.guidance({ agent: b, toolSet, signal }, pluginIds.browser, ['ego_visit']), []);
  const marker = a.session.snapshotEvents().findLast(event => event.type === 'tool-wrap/pack-admitted');
  assert.ok(marker);
  assert.equal(composition.loadedPlugins(a).size, 0, 'the parent call has not successfully reached the model surface');
  const resultEvent = a.session.append('tool/result', { turn: 1, step: 1, message: createToolResultMessage({ callId: marker.data.rootCallId, content: [{ type: 'text', text: 'complete pack returned' }], isError: false }) }, { surfaceOp: 'append' });
  const loadedPlan = await ctx.systemPrompt.admitContributions({ agent: a, assembly: refreshed, messages, toolSet, signal });
  assert.match(loadedPlan.systemText, /GUIDE_A_EXACT_STEP/, 'unpacked system guidance must be an actual system contribution, not a role label inside a tool result');
  assert.ok(loadedPlan.contributions.some(part => part.text === 'REQUIRED_A_EXACT_STEP'));
  const loadedReplay = patchedSession.Session.create('loaded-replay', a.session.snapshotEvents());
  assert.deepEqual([...composition.loadedPlugins({ session: loadedReplay })], [pluginIds.browser]);
  assert.equal(composition.loadedPlugins(b).size, 0);
  a.session.append('user/message', createUserMessage({ content: [], source: { kind: 'prompt-composition-cleared' } }), { surfaceOp: { op: 'replace', startSeq: resultEvent.seq, endSeq: resultEvent.seq }, sourceEventSeqs: [resultEvent.seq] });
  assert.equal(composition.loadedPlugins(a).size, 0, 'a rewind/removal of the visible result must remove the activation');
  a.session.append('system/message', { turn: 1, step: 1, message: createSystemMessage(plan.systemText) }, { surfaceOp: 'append' });
  commitPromptComposition(a.session, plan, messages, true);
  assert.ok(hasPromptComposition(a.session));
  const modeled = modelMessages(a.session);
  assert.ok(modeled.every(message => message.content.length > 0));
  assert.equal(modeled.find(message => message.id === plain.id).role, 'user');
  assert.equal(modeled.find(message => message.id === relay.id).role, 'user');
  assert.doesNotMatch(body(modeled), /GUIDE_A|REQUIRED_A/);
  const beforeRetry = a.session.seq;
  commitPromptComposition(a.session, plan, messages, false);
  assert.equal(a.session.seq, beforeRetry, 'retries must not duplicate prompt or ordinary messages');
  const replay = patchedSession.Session.create('replay', a.session.snapshotEvents());
  assert.deepEqual(modelMessages(replay), modeled);
  const projection = new loop.SystemPromptProjection(replay);
  // A real in-history adapter may already have several system nodes. Demotion must
  // clear every old high-priority copy, not merely append a lower-role replacement.
  for (const { message, intent } of projection.project('STALE_ELEVATED_COPY', { inHistory: true, startsSeries: false })) replay.append('system/message', { turn: 1, step: 1, message }, intent);
  const inHistoryInputs = [];
  Object.assign(a, {
    session: replay, loopCtx: ctx, phase: { kind: 'running', turn: 1, step: 1, abort: { signal } },
    runtimeContext: new loop.RuntimeContextProjection(a.ctx, replay),
    systemPrompt: { project(text, input) { inHistoryInputs.push(input.inHistory); return projection.project(text, input); } },
    requestSurfaceGeneration: replay.surface.contentGeneration, assistantAttemptCounter: 0, assistantStreamRevision: 0,
    dispatch: { emit() {} }, toolsChanged: () => false,
    prepareRequest: async () => ({ config: {}, preparedCall: { systemPromptUpdate: 'in-history', stream: async function* () {} } }),
    buildRequest: () => ({ provider: 'fixture', model: 'fixture', messages: modelMessages(replay) }),
  });
  const decision = { assembly, toolSet, selection: { provider: 'fixture', model: 'fixture' }, messages: [] };
  await loop.ReactLoopAgent.prototype.step.call(a, decision);
  await composition.store.save(config());
  await loop.ReactLoopAgent.prototype.step.call(a, decision);
  assert.deepEqual(inHistoryInputs, [false, false]);
  assert.equal(modelMessages(replay).filter(message => message.role === 'system').length, 1);
  assert.doesNotMatch(body(modelMessages(replay).filter(message => message.role === 'system')), /STALE_ELEVATED_COPY|GLOBAL_FILE_BODY|SKILL_CATALOG_BODY/);
  assert.equal(hasPromptComposition(replay), false);
  assert.ok(modelMessages(replay).every(message => message.content.length > 0));
  assert.equal(modelMessages(replay).find(message => message.source.kind === 'skill-catalog').role, 'user');
  assert.match(body(modelMessages(replay)), /ORIGINAL_AGENT_FRAME/);
  const projectB = createUserMessage({ content: [], source: { kind: 'agent-instructions', baselineIdentity: 'project-b', changes: [], compositionSections: [{ key: '/fixture/project-b/AGENTS.md', path: 'AGENTS.md', scope: 'project', action: 'set', text: 'PROJECT_B_BODY' }] } });
  const files = composition.instructions(a, [projectB]);
  assert.deepEqual(files.map(file => file.id), [instructionId('/fixture/project-b/AGENTS.md')]);
  assert.notEqual(files[0].id, instructionId('/fixture/project-a/AGENTS.md'));
  assert.doesNotMatch(JSON.stringify(composition.status()), /GUIDE_A_|REQUIRED_A_|PROJECT_A_FILE_BODY|MEMORY_SNAPSHOT_BODY/);
  await composition.store.save({ ...flatConfig, rules: { ...flatConfig.rules, ...Object.fromEntries(orderedSources.map(id => [id, { role: 'user', delivery: 'always' }])) } });
  const userPlan = await ctx.systemPrompt.admitContributions({ agent: a, assembly: refreshed, messages, toolSet, signal });
  assert.deepEqual(userPlan.contributions.filter(source => orderedSources.includes(source.id)).map(source => source.id), [a1, b1, a2, ...orderedSources.slice(3)]);
  assert.deepEqual(sortNames(userPlan.systemText), [], 'flat order also applies after individual sources move to the user role');
  await composition.store.save(config());
  assert.equal(await ctx.systemPrompt.admitContributions({ agent: a, assembly: refreshed, messages: [], toolSet, signal }), undefined);
  assert.ok(patchedInstructions.renderAgentInstructions);
});

// Off must win over always delivery, deferred packs and later configuration changes.
test('per-source injection controls filter native, unwrapped and packed admission without leaking unwrap guidance', async t => {
  const [patchedPrompt] = await Promise.all([adaptedModule('@deepseek-ai/dsh-system-prompt'), adaptedModule('@deepseek-ai/dsh-agent-instructions'), adaptedModule('@deepseek-ai/dsh-session'), adaptedModule('@deepseek-ai/dsh-agent-loop')]);
  const originals = new Map();
  for (const name of ['assemble', 'refreshContext', 'admitContributions', 'promptCompositionVersion']) {
    originals.set(name, Object.getOwnPropertyDescriptor(SystemPrompt.prototype, name));
    Object.defineProperty(SystemPrompt.prototype, name, Object.getOwnPropertyDescriptor(patchedPrompt.SystemPrompt.prototype, name));
  }
  t.after(() => { for (const [name, descriptor] of originals) { if (descriptor) Object.defineProperty(SystemPrompt.prototype, name, descriptor); else delete SystemPrompt.prototype[name]; } });
  for (const mode of ['native', 'unwrapped', 'packed']) {
    const host = await hostFixture(t, { mode: mode === 'native' ? 'native' : 'ptc', config: enabledConfig({ enabled: mode !== 'unwrapped' }), installPlugin: false });
    const { ctx, tools } = host, agent = host.agent('injection-' + mode);
    const wrapperOwner = await fixturePlugin(ctx, '@delthin/dsh-tool-wrap');
    await wrapperOwner.plugin(discoveryPlugin);
    const owner = await fixturePlugin(agent.ctx, pluginIds.browser);
    owner.systemPrompt.section({ name: 'off:always', order: 100, text: 'OFF_ALWAYS_BODY' });
    owner.systemPrompt.section({ name: 'off:required', order: 101, required: true, text: 'OFF_REQUIRED_BODY' });
    owner.systemPrompt.context({ name: 'off:context', order: 100, required: true, text: 'OFF_CONTEXT_BODY' });
    owner.systemPrompt.section({ name: 'on:child', order: 103, text: 'CHILD_OVERRIDE_BODY' });
    const composition = ctx.get('toolWrapPromptComposition'), signal = new AbortController().signal;
    const rules = {
      [ownerId(pluginIds.browser)]: { role: 'inherit', delivery: 'inherit', enabled: false },
      [sourceId('section', pluginIds.browser, 'off:always')]: { role: 'inherit', delivery: 'always' },
      [sourceId('section', pluginIds.browser, 'on:child')]: { role: 'user', delivery: 'always', enabled: true },
      'instructions:project': { role: 'system', delivery: 'always', enabled: false },
    };
    const toolSet = await tools.resolve({ agent, modelSelection: { provider: 'fixture', model: 'fixture' }, signal });
    t.after(() => toolSet.dispose());
    const assembly = await ctx.systemPrompt.assemble({ scope: agent, toolSet });
    const refreshed = ctx.systemPrompt.refreshContext(assembly, { scope: agent, signal });
    const instruction = createUserMessage({ content: [{ type: 'text', text: 'OFF_INSTRUCTION_FRAME' }], source: { kind: 'agent-instructions', baseline: true, compositionSections: [{ key: '/fixture/project/AGENTS.md', path: 'AGENTS.md', scope: 'project', text: 'OFF_INSTRUCTION_BODY' }] } });
    const snapshot = createUserMessage({ content: [{ type: 'text', text: 'OFF_SNAPSHOT_BODY' }], source: { kind: 'fixture-state', form: 'snapshot', sections: [{ name: 'state', text: 'OFF_SNAPSHOT_BODY' }] } });
    const opaque = createUserMessage({ content: [{ type: 'text', text: 'OPAQUE_RESIDENT_BODY' }, { type: 'image', url: 'https://example.invalid/fixture.png' }], source: { kind: 'fixture-opaque', form: 'catalog' } });
    rules[promptMessageDescriptor(snapshot).id] = { role: 'system', delivery: 'always', enabled: false };
    await composition.store.save(config({ enabled: true, rules }));
    const messages = [instruction, snapshot, opaque];
    const plan = await ctx.systemPrompt.admitContributions({ agent, assembly: refreshed, messages, toolSet, signal });
    assert.equal(composition.accepted({ agent, toolSet }).canDefer, mode === 'packed');
    assert.doesNotMatch(JSON.stringify(plan), /OFF_/);
    assert.ok(plan.contributions.some(item => item.text === 'CHILD_OVERRIDE_BODY' && item.role === 'user'));
    if (mode === 'packed') assert.match(plan.systemText, /unwrap/);
    const status = composition.status();
    assert.equal((await request(host, 'PUT', config({ enabled: true, rules }))).statusCode, 200);
    assert.equal(status.capabilities.injection, true);
    assert.equal(status.sources.find(source => source.name === 'off:required').canToggleInjection, true);
    for (const locked of status.sources.filter(source => source.opaque || source.name === 'tool-discovery:directory' || source.id === ownerId('@delthin/dsh-tool-wrap'))) {
      assert.equal(locked.canToggleInjection, false);
      assert.equal((await request(host, 'PUT', config({ enabled: true, rules: { ...rules, [locked.id]: { role: 'inherit', delivery: 'inherit', enabled: false } } }))).statusCode, 409);
    }
    // A configuration save after request admission cannot alter that request's unwrap snapshot.
    await composition.store.save(config({ enabled: true }));
    const execution = { agent, toolSet, signal };
    assert.doesNotMatch(JSON.stringify(await composition.guidance(execution, pluginIds.browser, ['ego_visit'])), /OFF_/);
    if (mode === 'packed') {
      const pack = success(await host.execute('unwrap', { plugin: pluginIds.browser }, { agent, nested: true, toolSet }));
      assert.doesNotMatch(JSON.stringify(pack.guidance), /OFF_/);
      assert.ok(pack.schemas.some(schema => schema.name === 'ego_visit'), 'prompt injection does not change tool permission');
      const marker = agent.session.snapshotEvents().findLast(event => event.type === 'tool-wrap/pack-admitted');
      agent.session.append('tool/result', { turn: 1, step: 1, message: createToolResultMessage({ callId: marker.data.rootCallId, content: [{ type: 'text', text: 'pack loaded' }], isError: false }) }, { surfaceOp: 'append' });
      assert.equal(composition.loadedPlugins(agent).has(pluginIds.browser), true);
      await composition.store.save(config({ enabled: true, rules }));
      const loadedPlan = await ctx.systemPrompt.admitContributions({ agent, assembly: refreshed, messages, toolSet, signal });
      assert.doesNotMatch(JSON.stringify(loadedPlan), /OFF_/);
    }
    commitPromptComposition(agent.session, plan, messages, true);
    assert.doesNotMatch(body(modelMessages(agent.session)), /OFF_/);
    assert.match(body(modelMessages(agent.session)), /OPAQUE_RESIDENT_BODY/);
    // Disabled composition persists the same draft while leaving original host admission alone.
    assert.equal((await request(host, 'PUT', config({ rules }))).statusCode, 200);
    assert.equal(await ctx.systemPrompt.admitContributions({ agent, assembly: refreshed, messages, toolSet, signal }), undefined);
    assert.match(JSON.stringify(await composition.guidance(execution, pluginIds.browser, ['ego_visit'])), /OFF_ALWAYS_BODY/);
    // Complete personas replace all other host sections; exercise their explicit off separately.
    owner.systemPrompt.section({ name: 'off:persona', order: 102, complete: true, text: 'OFF_PERSONA_BODY' });
    await composition.store.save(config({ enabled: true, rules }));
    const personaAssembly = await ctx.systemPrompt.assemble({ scope: agent, toolSet });
    const personaPlan = await ctx.systemPrompt.admitContributions({ agent, assembly: personaAssembly, messages: [], toolSet, signal });
    assert.doesNotMatch(JSON.stringify(personaPlan), /OFF_PERSONA_BODY/);
    assert.equal(composition.sources().find(source => source.name === 'off:persona').canToggleInjection, true);
    assert.equal((await request(host, 'PUT', config({ enabled: true, rules: { ...rules, [sourceId('section', pluginIds.browser, 'off:persona')]: { role: 'inherit', delivery: 'inherit', enabled: false } } }))).statusCode, 200);
  }
});

// Real risks: host file corruption/partial restore and losing budgeted AGENTS boundaries.
test('audited host assets preserve budgeted file identities and apply/restore only matching synthetic installations', async t => {
  const root = join(await temporaryDirectory(t), 'installation');
  const backup = join(root, 'backup');
  for (const patch of PATCHES) {
    const dir = join(root, 'node_modules', patch.name);
    await mkdir(dirname(join(dir, patch.file ?? 'lib/index.js')), { recursive: true });
    await writeFile(join(dir, 'package.json'), JSON.stringify({ name: patch.name, version: '0.2.2-rc.1', type: 'module' }));
    await writeFile(join(dir, patch.file ?? 'lib/index.js'), await originalSource(patch));
  }
  const cli = fileURLToPath(new URL('../host-support/adapter.mjs', import.meta.url));
  const run = mode => spawnSync(process.execPath, [cli, mode, '--root', root, '--backup', backup], { encoding: 'utf8' });
  let result = run('--apply');
  assert.equal(result.status, 0, result.stderr);
  for (const patch of PATCHES) {
    const target = join(root, 'node_modules', patch.name, patch.file ?? 'lib/index.js');
    assert.equal(await readFile(target, 'utf8'), patchSource(await originalSource(patch), patch));
    const syntax = spawnSync(process.execPath, ['--check', target], { encoding: 'utf8' });
    assert.equal(syntax.status, 0, syntax.stderr);
  }
  const target = join(root, 'node_modules', PATCHES[0].name, 'lib/index.js');
  const patched = await readFile(target, 'utf8');
  await writeFile(target, patched + '\n// independent edit\n');
  result = run('--restore');
  assert.notEqual(result.status, 0);
  assert.match(await readFile(target, 'utf8'), /independent edit/);
  await writeFile(target, patched);
  result = run('--restore');
  assert.equal(result.status, 0, result.stderr);
  for (const patch of PATCHES) assert.equal(await readFile(join(root, 'node_modules', patch.name, patch.file ?? 'lib/index.js'), 'utf8'), await originalSource(patch));
  const patchedInstructions = await adaptedModule('@deepseek-ai/dsh-agent-instructions');
  const original = await import('@deepseek-ai/dsh-agent-instructions');
  const file = { absolutePath: '/fixture/project-a/AGENTS.md', displayPath: 'AGENTS.md', content: 'BUDGET_CONTENT_' + 'x'.repeat(4000) };
  const rendered = patchedInstructions.renderAgentInstructions([file], { maxBytes: 650 });
  assert.equal(rendered.text, original.renderAgentInstructions([file], { maxBytes: 650 }).text);
  assert.ok(rendered.truncated.length);
  assert.equal(rendered.compositionSections[0].key, file.absolutePath);
  assert.ok(rendered.compositionSections[0].text.length < file.content.length);
  const other = patchedInstructions.renderAgentInstructions([{ ...file, absolutePath: '/fixture/project-b/AGENTS.md' }], { maxBytes: 650 });
  assert.notEqual(other.compositionSections[0].key, rendered.compositionSections[0].key);
});
