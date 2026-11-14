import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir, stat } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { Readable } from 'node:stream';
import { createHash } from 'node:crypto';
import { SystemPrompt, renderPrompt } from '@deepseek-ai/dsh-system-prompt';
import { createUserMessage, createAssistantMessage, createSystemMessage, createToolResultMessage, projectToolUpdates } from '@deepseek-ai/dsh-llm';
import { CompositionStore, ownerId, instructionId, sourceId, effectiveRule, validateComposition, validateCapabilities } from '../prompt-composition.js';
import * as discoveryPlugin from '../index.js';
import { promptMessageDescriptor, commitPromptComposition, restorePromptComposition, hasPromptComposition, canAppendPromptCompositionSystem } from '../host-support/admission.js';
import { PATCHES_BY_VERSION, patchSource } from '../host-support/patches.js';
import { hostFixture, fixturePlugin, temporaryDirectory, success, pluginIds, enabledConfig } from './fixture.js';

const HOST_VERSION = JSON.parse(await readFile(fileURLToPath(import.meta.resolve('@deepseek-ai/dsh-system-prompt/package.json')), 'utf8')).version;
const PATCHES = PATCHES_BY_VERSION[HOST_VERSION];
assert.ok(PATCHES, `No audited patches for test host ${HOST_VERSION}`);

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
const textBody = message => body([message]);
async function originalSource(patch) {
  const packageDir = dirname(fileURLToPath(import.meta.resolve(patch.name + '/package.json')));
  return readFile(join(packageDir, patch.file ?? 'lib/index.js'), 'utf8');
}
async function adaptedModule(name, extra = '', file = 'lib/index.js') {
  const patch = PATCHES.find(patch => patch.name === name && (patch.file ?? 'lib/index.js') === file);
  let source = patchSource(await originalSource(patch), patch);
  source = source.replace(/from (["'])([^"']+)\1/g, (_all, _quote, specifier) => {
    const url = specifier === './tool-wrap-admission.js' ? new URL('../host-support/admission.js', import.meta.url).href : specifier.startsWith('.') ? new URL(specifier, new URL(file, import.meta.resolve(name + '/package.json'))).href : import.meta.resolve(specifier);
    return 'from ' + JSON.stringify(url);
  });
  return import('data:text/javascript;base64,' + Buffer.from(source + '\n' + extra).toString('base64'));
}

// Real risks: migration must not erase preferences; unsupported roles must not be saved.
test('composition migration, atomic failure recovery and capability validation preserve existing settings', async t => {
  const dir = await temporaryDirectory(t);
  const legacyPath = join(dir, 'prompt-order.json');
  await writeFile(legacyPath, JSON.stringify({ version: 1, enabled: true, plugins: ['@fixture/removed', '@fixture/present'] }));
  const store = new CompositionStore(dir), migrated = await store.load();
  assert.deepEqual(migrated, config({ order: [ownerId('@fixture/removed'), ownerId('@fixture/present')] }));
  assert.equal((await stat(store.path)).mode & 0o777, 0o600);
  assert.equal(JSON.parse(await readFile(legacyPath, 'utf8')).enabled, true);
  const saved = config({ rules: { [ownerId('@fixture/removed')]: { role: 'system', delivery: 'always' } }, order: migrated.order });
  await store.save(saved);
  const placed = config({ rules: { group: { role: 'user', delivery: 'always', placement: 'fixed' }, child: { role: 'inherit', delivery: 'inherit', placement: 'state' } } });
  await store.save(placed);
  assert.deepEqual(await new CompositionStore(dir).load(), placed);
  assert.equal(effectiveRule(placed, { id: 'child', groupId: 'group', owner: null }).placement, 'state');
  for (const placement of [undefined, null, 'user', 'system']) assert.throws(() => validateComposition(config({ rules: { child: { role: 'user', delivery: 'always', placement } } })), /规则无效/);
  const editable = [{ id: 'child', kind: 'context', label: 'child', roles: ['inherit'], deliveryModes: ['inherit'], placements: ['inherit', 'fixed', 'state'] }];
  validateCapabilities(config({ rules: { child: placed.rules.child } }), editable, { admission: true });
  assert.throws(() => validateCapabilities(config({ rules: { child: placed.rules.child } }), [{ ...editable[0], placements: ['inherit'] }], { admission: true }), /不支持/);
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
  const disabled = config({ ...saved, rules: { [missingId]: { ...saved.rules[missingId], enabled: false, placement: 'state' } } });
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
  assert.deepEqual(effectiveRule(config({ rules: { group: { role: 'system', delivery: 'pack', enabled: false }, child: { role: 'inherit', delivery: 'always', enabled: true } } }), { id: 'child', groupId: 'group', owner: null }), { role: 'system', delivery: 'always', placement: 'inherit', enabled: true });
  assert.deepEqual(effectiveRule(saved, { id: 'child', owner: null }), { role: 'inherit', delivery: 'inherit', placement: 'inherit', enabled: true });
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
  // Exact createPluginMessage source envelopes: only instructions are configurable guidance.
  const mnemon = createUserMessage({ content: [{ type: 'text', text: 'REAL_MNEMON_RECALL_ENVELOPE' }], source: { kind: 'dsh-mnemon', form: 'recall' } });
  const mnemonNext = createUserMessage({ content: [{ type: 'text', text: 'SECOND_MNEMON_RECALL' }], source: { kind: 'dsh-mnemon', form: 'recall' } });
  const mnemonSnapshot = createUserMessage({ content: [{ type: 'text', text: 'MNEMON RUNTIME MEMORY SNAPSHOT\nPRODUCER_OWNED_STATE' }], source: { kind: 'dsh-mnemon', form: 'memory-snapshot', snapshot: { boundary: 'fixture', entries: [] } } });
  const mnemonInstructions = createUserMessage({ content: [{ type: 'text', text: 'MNEMON_GUIDANCE' }], source: { kind: 'dsh-mnemon', form: 'instructions' } });
  const recalledData = createUserMessage({ content: [{ type: 'text', text: 'UNTRUSTED_RECALL_KEEP_DATA' }], source: { kind: 'fixture-recall', form: 'recall' } });
  assert.equal(promptMessageDescriptor(mnemonInstructions).owner, 'dsh-mnemon');
  assert.equal(promptMessageDescriptor(mnemonInstructions).form, 'instructions');
  assert.equal(promptMessageDescriptor(mnemonInstructions).defaultPlacement, 'fixed');
  for (const data of [mnemon, mnemonNext, mnemonSnapshot]) assert.equal(promptMessageDescriptor(data), undefined);
  assert.equal(promptMessageDescriptor(catalog).defaultPlacement, 'fixed');
  assert.equal(promptMessageDescriptor(snapshot).defaultPlacement, 'state');
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
  const messages = [plain, instruction, catalog, snapshot, mnemonInstructions, mnemon, mnemonNext, mnemonSnapshot, recalledData, relay];
  const legacyPlan = await ctx.systemPrompt.admitContributions({ agent: a, assembly: refreshed, messages, toolSet, signal });
  const sortNames = text => text.match(/SORT_(?:A1|A2|B1|TAIL1|TAIL2)/g) ?? [];
  assert.deepEqual(sortNames(legacyPlan.systemText), ['SORT_B1', 'SORT_TAIL1', 'SORT_TAIL2', 'SORT_A1', 'SORT_A2']);
  const flatConfig = { ...composition.store.config, sourceOrder: [a1, b1, a2, requiredId, guideId, 'fixture:removed-source'] };
  await composition.store.save(flatConfig);
  const plan = await ctx.systemPrompt.admitContributions({ agent: a, assembly: refreshed, messages, toolSet, signal });
  assert.deepEqual(sortNames(plan.systemText), ['SORT_A1', 'SORT_B1', 'SORT_A2', 'SORT_TAIL1', 'SORT_TAIL2']);
  assert.match(plan.systemText, /GLOBAL_FILE_BODY/);
  assert.match(plan.systemText, /SKILL_CATALOG_BODY/);
  assert.match(plan.systemText, /MNEMON_GUIDANCE/);
  assert.doesNotMatch(JSON.stringify(plan), /REAL_MNEMON_RECALL_ENVELOPE|SECOND_MNEMON_RECALL|PRODUCER_OWNED_STATE|UNTRUSTED_RECALL_KEEP_DATA/);
  assert.doesNotMatch(plan.systemText, /ORDINARY_USER|TEAM_RELAY|GUIDE_A|REQUIRED_A/);
  assert.ok(plan.contributions.some(part => part.text === 'DYNAMIC_STRATEGY' && part.role === 'user' && part.placement === 'state'));
  assert.ok(plan.contributions.some(part => part.text === 'MEMORY_SNAPSHOT_BODY' && part.placement === 'state'));
  assert.ok(plan.contributions.some(part => part.id === instructionId('/fixture/project-a/AGENTS.md') && part.placement === 'fixed'));
  assert.deepEqual(composition.capabilities().placements, ['inherit', 'fixed', 'state']);
  assert.deepEqual(composition.sources().find(source => source.id === requiredId).placements, ['inherit', 'fixed', 'state']);
  assert.equal(composition.sources().find(source => source.id === guideId).defaultPlacement, 'state');
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
  const marker = a.session.snapshotEvents().findLast(event => event.type === 'plugin:tool-wrap/pack-admitted');
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
  assert.equal(canAppendPromptCompositionSystem(a.session, { ...plan, systemSourceIds: [...plan.systemSourceIds].reverse() }), false, 'reordering existing system authorities still requires clearing old system copies');
  const modeled = modelMessages(a.session);
  assert.ok(modeled.every(message => message.content.length > 0));
  assert.equal(modeled.find(message => message.id === plain.id).role, 'user');
  assert.equal(modeled.find(message => message.id === relay.id).role, 'user');
  assert.deepEqual(modeled.filter(message => message.source.kind === 'dsh-mnemon'), [mnemon, mnemonNext, mnemonSnapshot], 'all recalls and native snapshot retain exact IDs, source metadata, content and order');
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
    buildRequest: () => {
      a.requestSurfaceGeneration = replay.surface.contentGeneration;
      return { provider: 'fixture', model: 'fixture', messages: modelMessages(replay) };
    },
  });
  // A previous adapter could have promoted recall into every native system update.
  // Lost source authority uses the real host projection to clear all such copies once.
  const legacyRecallId = 'message:dsh-mnemon:recall:';
  const legacyControl = replay.surface.nodes.find(seq => replay.eventAt(seq).data?.source?.kind === 'prompt-composition-state');
  const controlMessage = replay.eventAt(legacyControl).data;
  replay.append('user/message', createUserMessage({ content: [], source: { ...controlMessage.source, systemSourceIds: [...plan.systemSourceIds, legacyRecallId] } }), { surfaceOp: { op: 'replace', startSeq: legacyControl, endSeq: legacyControl }, sourceEventSeqs: [legacyControl] });
  for (const { message, intent } of projection.project('LEGACY_PROMOTED_RECALL', { inHistory: true, startsSeries: false })) replay.append('system/message', { turn: 1, step: 1, message }, intent);
  assert.equal(canAppendPromptCompositionSystem(replay, plan), false);
  await loop.ReactLoopAgent.prototype.step.call(a, { assembly, toolSet, selection: { provider: 'fixture', model: 'fixture' }, messages: [] });
  assert.equal(modelMessages(replay).filter(message => message.role === 'system').length, 1);
  assert.doesNotMatch(body(modelMessages(replay).filter(message => message.role === 'system')), /LEGACY_PROMOTED_RECALL|REAL_MNEMON_RECALL_ENVELOPE/);
  assert.deepEqual(modelMessages(replay).filter(message => message.source.kind === 'dsh-mnemon'), [mnemon, mnemonNext, mnemonSnapshot]);
  assert.equal(canAppendPromptCompositionSystem(replay, plan), true, 'migration restores the normal incremental system path');
  const updatedAssembly = { ...assembly, sections: assembly.sections.map(section => section.name === 'sort:A1' ? { ...section, text: 'SORT_A1_UPDATED' } : section) };
  const decision = { assembly: updatedAssembly, toolSet, selection: { provider: 'fixture', model: 'fixture' }, messages: [] };
  const beforeSystemRefresh = modelMessages(replay);
  await loop.ReactLoopAgent.prototype.step.call(a, decision);
  assert.deepEqual(modelMessages(replay).slice(0, beforeSystemRefresh.length), beforeSystemRefresh, 'a stable system source body update preserves the complete old request prefix');
  const refreshedSystems = modelMessages(replay).filter(message => message.role === 'system');
  assert.equal(refreshedSystems.length, beforeSystemRefresh.filter(message => message.role === 'system').length + 1, 'capable native system projection appends rather than replaces');
  assert.match(textBody(refreshedSystems.at(-1)), /SORT_A1_UPDATED/);
  const extendedAssembly = { ...updatedAssembly, sections: [...updatedAssembly.sections, { name: 'system:added', text: 'SYSTEM_ADDED_AUTHORITY', interpolate: false }] };
  const addedDecision = { ...decision, assembly: extendedAssembly }, beforeSystemAddition = modelMessages(replay);
  await loop.ReactLoopAgent.prototype.step.call(a, addedDecision);
  assert.deepEqual(modelMessages(replay).slice(0, beforeSystemAddition.length), beforeSystemAddition, 'adding system authority without removing or reordering old sources preserves the complete old request prefix');
  const extendedSystems = modelMessages(replay).filter(message => message.role === 'system');
  assert.equal(extendedSystems.length, refreshedSystems.length + 1, 'a monotonic source addition uses native system append');
  assert.match(textBody(extendedSystems.at(-1)), /SORT_A1_UPDATED[\s\S]*SYSTEM_ADDED_AUTHORITY/);
  const demotedConfig = { ...flatConfig, rules: { ...flatConfig.rules, 'instructions:global': { role: 'user', delivery: 'always' } } };
  await composition.store.save(demotedConfig);
  await loop.ReactLoopAgent.prototype.step.call(a, addedDecision);
  const demotedSystems = modelMessages(replay).filter(message => message.role === 'system');
  assert.equal(demotedSystems.length, 1, 'demotion clears every previously appended system copy');
  assert.doesNotMatch(body(demotedSystems), /STALE_ELEVATED_COPY|GLOBAL_FILE_BODY/);
  assert.match(body(modelMessages(replay).filter(message => message.role === 'user')), /GLOBAL_FILE_BODY/, 'demoted instructions are admitted at user priority');
  // Removal must also clear all copies, including an earlier native in-history tail.
  for (const { message, intent } of projection.project('STALE_REMOVED_SOURCE_COPY_SORT_A1', { inHistory: true, startsSeries: false })) replay.append('system/message', { turn: 1, step: 1, message }, intent);
  const removedDecision = { ...addedDecision, assembly: { ...extendedAssembly, sections: extendedAssembly.sections.filter(section => section.name !== 'sort:A1') } };
  await loop.ReactLoopAgent.prototype.step.call(a, removedDecision);
  const removedSystems = modelMessages(replay).filter(message => message.role === 'system');
  assert.equal(removedSystems.length, 1, 'source removal clears all former system copies');
  assert.doesNotMatch(body(removedSystems), /SORT_A1|STALE_REMOVED_SOURCE_COPY/);
  await composition.store.save(config());
  await loop.ReactLoopAgent.prototype.step.call(a, removedDecision);
  assert.deepEqual(inHistoryInputs, [false, true, true, false, false, false]);
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
  assert.equal(userPlan.configKey, plan.configKey, 'role changes cannot masquerade as ordering changes and reproject unrelated fixed sources');
  assert.ok(orderedSources.every(id => plan.excludedIds.includes(id) && !userPlan.excludedIds.includes(id)), 'real admission explicitly revokes former user projections when sources move to system');
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
      const marker = agent.session.snapshotEvents().findLast(event => event.type === 'plugin:tool-wrap/pack-admitted');
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

// Automatic updates must retain the entire previous request, including other sources and tool history.
test('real session admission appends fixed updates and complete state snapshots while configuration changes stay scoped', async () => {
  const { Session } = await adaptedModule('@deepseek-ai/dsh-session');
  let session = new Session('placement-cache');
  session.append('system/message', { turn: 1, step: 1, message: createSystemMessage('SYSTEM_PREFIX') }, { surfaceOp: 'append' });
  const user = text => createUserMessage({ content: [{ type: 'text', text }], source: { kind: 'user' } });
  const originalState = createUserMessage({ content: [{ type: 'text', text: 'ORIGINAL_STATE_AUDIT' }], source: { kind: 'fixture-state', form: 'snapshot', sections: [{ name: 'state', text: 'ORIGINAL_STATE_AUDIT' }] } });
  let fixed = ['fixed-a', 'fixed-b'].map(id => ({ id, role: 'user', placement: 'fixed', text: id.toUpperCase() }));
  const states = text => [{ id: 'state-a', role: 'user', placement: 'state', text: 'UNCHANGED_STATE' }, { id: 'state-b', role: 'user', placement: 'state', text }];
  const plan = text => ({ version: 1, systemText: 'SYSTEM_PREFIX', systemSourceIds: ['system-prefix'], configKey: 'initial-settings', contributions: [...fixed, ...states(text)] });
  const ownedNodes = placement => session.surface.nodes.map(seq => ({ seq, message: session.deriveEventMessage(session.eventAt(seq)) })).filter(({ message }) => message?.source.kind === 'prompt-composition' && message.source.placement === placement);
  const control = () => session.surface.nodes.map(seq => session.eventAt(seq).data).find(message => message?.source?.kind === 'prompt-composition-state');
  const latestState = () => ownedNodes('state').filter(({ message }) => message.source.snapshotKey === control().source.stateKey && message.source.operation !== 'remove');
  const latestFixed = () => {
    const active = new Map();
    for (const record of ownedNodes('fixed')) {
      if (record.message.source.operation === 'remove') active.delete(record.message.source.contributionId);
      else active.set(record.message.source.contributionId, record);
    }
    return [...active.values()];
  };
  const assertPrefix = previous => assert.deepEqual(modelMessages(session).slice(0, previous.length), previous, 'the whole previous model request remains an identical prefix');
  const assertIdle = current => {
    const before = session.seq;
    commitPromptComposition(session, current, [], false);
    assert.equal(session.seq, before, 'identical admission writes no events');
    const request = modelMessages(session);
    session = Session.create('placement-cache-reopened', session.snapshotEvents());
    assert.deepEqual(modelMessages(session), request);
    const reopenedBefore = session.seq; // Session.create appends its own session/end-seed marker.
    assert.equal(canAppendPromptCompositionSystem(session, current), true, 'replay preserves the system authority marker');
    commitPromptComposition(session, current, [], false);
    assert.equal(session.seq, reopenedBefore, 'reopening an identical plan writes no admission events');
  };
  const first = user('FIRST_USER');
  assert.equal(canAppendPromptCompositionSystem(session, plan('STATE_ONE')), false, 'first admission cannot trust older system slots');
  commitPromptComposition(session, plan('STATE_ONE'), [first, originalState], true);
  assert.equal(canAppendPromptCompositionSystem(session, { ...plan('STATE_ONE'), systemText: 'SYSTEM_PREFIX_UPDATED' }), true, 'stable authority permits body-only in-history updates');
  assert.equal(canAppendPromptCompositionSystem(session, { ...plan('STATE_ONE'), systemSourceIds: [] }), false, 'loss of system authority requires clearing old slots');
  assert.equal(canAppendPromptCompositionSystem(session, undefined), false, 'disabling composition requires clearing old slots');
  const fixedBefore = ownedNodes('fixed');
  assert.ok(modelMessages(session).findIndex(message => message.id === first.id) < modelMessages(session).findIndex(message => message.source.placement === 'state'));
  const tool = createToolResultMessage({ callId: 'fixture-call', content: [{ type: 'text', text: 'TOOL_HISTORY' }], isError: false });
  session.append('tool/result', { turn: 1, step: 1, message: tool }, { surfaceOp: 'append' });
  const beforeFixed = modelMessages(session);
  fixed = [{ ...fixed[0], text: 'FIXED_A_CHANGED' }, fixed[1]];
  commitPromptComposition(session, plan('STATE_ONE'), [user('SECOND_USER')], true);
  assertPrefix(beforeFixed);
  assert.deepEqual(ownedNodes('fixed').slice(0, 2), fixedBefore, 'A and unrelated B retain original seq, ID, source, body and positions');
  assert.equal(ownedNodes('fixed').length, 3, 'only changed A adds a fixed message');
  assert.equal(ownedNodes('fixed').at(-1).message.source.contributionId, 'fixed-a');
  assert.match(textBody(ownedNodes('fixed').at(-1).message), /instead of all previously loaded instructions from this source/);
  assertIdle(plan('STATE_ONE'));
  const beforeState = modelMessages(session), oldSnapshot = control().source.stateKey;
  const third = user('THIRD_USER');
  commitPromptComposition(session, plan('STATE_TWO'), [third], true);
  assertPrefix(beforeState);
  assert.deepEqual(ownedNodes('fixed').slice(0, 2), fixedBefore);
  assert.notEqual(control().source.stateKey, oldSnapshot);
  assert.deepEqual(latestState().map(({ message }) => message.source.contributionId), ['state-a', 'state-b']);
  assert.deepEqual(modelMessages(session).slice(-2).map(message => message.source.contributionId), ['state-a', 'state-b']);
  assert.ok(modelMessages(session).findIndex(message => message.id === third.id) < modelMessages(session).length - 2);
  assert.match(body(modelMessages(session).slice(-2)), /complete snapshot supersedes all earlier/);
  assert.match(body(modelMessages(session)), /STATE_ONE/);
  assert.match(body(latestState().map(record => record.message)), /STATE_TWO/);
  assert.doesNotMatch(body(latestState().map(record => record.message)), /STATE_ONE/);
  assertIdle(plan('STATE_TWO'));
  // Returning to an earlier value creates a new generation, not a duplicate match to old history.
  const beforeReturn = modelMessages(session);
  commitPromptComposition(session, plan('STATE_ONE'), [], false);
  assertPrefix(beforeReturn);
  assert.notEqual(control().source.stateKey, oldSnapshot);
  assertIdle(plan('STATE_ONE'));
  const beforeAddition = modelMessages(session);
  fixed.push({ id: 'fixed-c', role: 'user', placement: 'fixed', text: 'FIXED_C_ADDED' });
  commitPromptComposition(session, plan('STATE_ONE'), [], false);
  assertPrefix(beforeAddition);
  const beforeRemoval = modelMessages(session);
  fixed = fixed.filter(item => item.id !== 'fixed-c');
  commitPromptComposition(session, plan('STATE_ONE'), [], false);
  assertPrefix(beforeRemoval);
  assert.match(textBody(ownedNodes('fixed').at(-1).message), /previously loaded instructions from this source no longer apply/);
  assert.equal(ownedNodes('fixed').at(-1).message.source.operation, 'remove');
  assertIdle(plan('STATE_ONE'));
  // Explicit exclusion clears every version of A, while B and conversation history stay untouched.
  const excluded = { ...plan('STATE_ONE'), excludedIds: ['fixed-a'], contributions: [fixed[1], ...states('STATE_ONE')] };
  commitPromptComposition(session, excluded, [], false);
  assert.ok(!ownedNodes('fixed').some(({ message }) => message.source.contributionId === 'fixed-a'));
  assert.deepEqual(ownedNodes('fixed').find(({ message }) => message.source.contributionId === 'fixed-b'), fixedBefore[1]);
  assertIdle(excluded);
  commitPromptComposition(session, plan('STATE_ONE'), [], false);
  assert.equal(ownedNodes('fixed').filter(({ message }) => message.source.contributionId === 'fixed-a').length, 1, 'reenabling admits current A once');
  assert.deepEqual(ownedNodes('fixed').find(({ message }) => message.source.contributionId === 'fixed-b'), fixedBefore[1], 'restoring A must not reproject unrelated B');
  // A role promotion uses the same explicit exclusion; a later demotion restores user placement.
  const elevated = { ...excluded, systemText: 'SYSTEM_PREFIX\n\nFIXED_A_CHANGED', systemSourceIds: ['system-prefix', 'fixed-a'] };
  commitPromptComposition(session, elevated, [], false);
  assert.ok(!ownedNodes('fixed').some(({ message }) => message.source.contributionId === 'fixed-a'));
  commitPromptComposition(session, plan('STATE_ONE'), [], false);
  assertIdle(plan('STATE_ONE'));
  const bBeforeMovement = ownedNodes('fixed').find(({ message }) => message.source.contributionId === 'fixed-b');
  const moved = { ...plan('STATE_ONE'), contributions: [fixed[1], { ...fixed[0], placement: 'state' }, ...states('STATE_ONE')] };
  commitPromptComposition(session, moved, [], false);
  assert.deepEqual(ownedNodes('fixed').find(({ message }) => message.source.contributionId === 'fixed-b'), bBeforeMovement);
  assert.ok(!ownedNodes('fixed').some(({ message }) => message.source.contributionId === 'fixed-a'));
  assert.deepEqual(latestState().map(({ message }) => message.source.contributionId), ['fixed-a', 'state-a', 'state-b']);
  let reordered = { ...plan('STATE_ONE'), configKey: 'B-before-A', contributions: [fixed[1], fixed[0], ...states('STATE_ONE')] };
  commitPromptComposition(session, reordered, [], false);
  assert.deepEqual(latestFixed().map(({ message }) => message.source.contributionId), ['fixed-b', 'fixed-a']);
  assertIdle(reordered);
  reordered = { ...reordered, configKey: 'A-before-B', contributions: [fixed[0], fixed[1], ...states('STATE_ONE')] };
  commitPromptComposition(session, reordered, [], false);
  assert.deepEqual(latestFixed().map(({ message }) => message.source.contributionId), ['fixed-a', 'fixed-b'], 'an explicit fixed reorder takes effect instead of retaining obsolete order');
  assertIdle(reordered);
  // State-only settings changes preserve all fixed messages. Empty snapshots revoke older state.
  const beforeStateOff = ownedNodes('fixed');
  const stateOff = { ...reordered, configKey: 'state-off', excludedIds: ['state-b'], contributions: [fixed[0], fixed[1], states('STATE_ONE')[0]] };
  commitPromptComposition(session, stateOff, [], false);
  assert.deepEqual(ownedNodes('fixed'), beforeStateOff);
  assert.ok(!ownedNodes('state').some(({ message }) => message.source.contributionId === 'state-b'));
  const emptyState = { ...stateOff, contributions: [fixed[0], fixed[1]] };
  const beforeEmpty = modelMessages(session);
  commitPromptComposition(session, emptyState, [], false);
  assertPrefix(beforeEmpty);
  assert.equal(latestState().length, 0);
  assert.match(textBody(modelMessages(session).at(-1)), /state snapshot is empty/);
  assertIdle(emptyState);
  restorePromptComposition(session);
  assert.equal(hasPromptComposition(session), false);
  assert.match(body(modelMessages(session)), /ORIGINAL_STATE_AUDIT/);
  assert.ok(modelMessages(session).some(message => message.id === tool.id));
  assert.deepEqual(modelMessages(Session.create('placement-restored', session.snapshotEvents())), modelMessages(session));
  commitPromptComposition(session, reordered, [], false);
  assert.doesNotMatch(body(modelMessages(session)), /ORIGINAL_STATE_AUDIT/);
  assertIdle(reordered);
});

test('legacy plans and mixed sessions preserve historical versions, remain idle on replay and restore authority nodes', async () => {
  const { Session } = await adaptedModule('@deepseek-ai/dsh-session');
  const session = new Session('legacy-placement');
  const original = createUserMessage({ content: [{ type: 'text', text: 'ORIGINAL_CATALOG' }], source: { kind: 'fixture-catalog', form: 'catalog' } });
  const authority = createUserMessage({ content: [], source: { ...original.source, compositionAuthority: true, compositionOriginalContent: original.content, compositionOriginalId: original.id } });
  session.append('user/message', authority, { surfaceOp: 'append' });
  const legacy = (id, slot, text) => session.append('user/message', createUserMessage({ content: [{ type: 'text', text }], source: { kind: 'prompt-composition', version: 1, key: 'legacy-mixed-group-key', slot, contributionId: id } }), { surfaceOp: 'append' });
  const fixed = legacy('catalog', 0, 'FIXED_CATALOG'), oldState = legacy('snapshot', 1, 'OLD_STATE');
  const input = createUserMessage({ content: [{ type: 'text', text: 'CURRENT_USER' }], source: { kind: 'user' } });
  const plan = { version: 1, systemText: '', contributions: [{ id: 'catalog', role: 'user', text: 'FIXED_CATALOG' }, { id: 'snapshot', role: 'user', placement: 'state', text: 'NEW_STATE' }] };
  const beforeMigration = modelMessages(session);
  commitPromptComposition(session, plan, [input], true);
  assert.deepEqual(modelMessages(session).slice(0, beforeMigration.length), beforeMigration, 'migration leaves the complete legacy request as prefix');
  assert.ok(session.surface.nodes.includes(fixed.seq));
  assert.equal(session.eventAt(fixed.seq).data.id, fixed.data.id);
  assert.ok(session.surface.nodes.includes(oldState.seq));
  const messages = modelMessages(session);
  assert.equal(messages.filter(message => message.source.contributionId === 'snapshot').length, 2, 'old state survives as history');
  assert.ok(messages.findIndex(message => message.id === input.id) < messages.findLastIndex(message => message.source.contributionId === 'snapshot'));
  assert.match(textBody(messages.at(-1)), /complete snapshot supersedes all earlier[\s\S]*NEW_STATE/);
  const reopened = Session.create('legacy-migrated', session.snapshotEvents());
  let before = reopened.seq;
  commitPromptComposition(reopened, plan, [], false);
  assert.equal(reopened.seq, before);
  const changed = { ...plan, contributions: [{ ...plan.contributions[0], text: 'FIXED_CATALOG_UPDATED' }, plan.contributions[1]] };
  const beforeFixed = modelMessages(reopened);
  commitPromptComposition(reopened, changed, [], false);
  assert.deepEqual(modelMessages(reopened).slice(0, beforeFixed.length), beforeFixed, 'a legacy plan without config identity still appends fixed changes safely');
  assert.match(textBody(modelMessages(reopened).at(-1)), /instead of all previously loaded[\s\S]*FIXED_CATALOG_UPDATED/);
  const removed = { ...changed, contributions: [changed.contributions[0]] };
  commitPromptComposition(reopened, removed, [], false);
  const afterRemoval = modelMessages(reopened);
  assert.match(textBody(afterRemoval.at(-1)), /state snapshot is empty/);
  before = reopened.seq;
  commitPromptComposition(reopened, removed, [], false);
  assert.equal(reopened.seq, before, 'legacy state history stays state after its source disappears');
  const removedReplay = Session.create('legacy-removed-replay', reopened.snapshotEvents());
  before = removedReplay.seq;
  commitPromptComposition(removedReplay, removed, [], false);
  assert.equal(removedReplay.seq, before);
  restorePromptComposition(removedReplay);
  assert.match(body(modelMessages(removedReplay)), /ORIGINAL_CATALOG/);
  assert.doesNotMatch(body(modelMessages(removedReplay)), /FIXED_CATALOG|NEW_STATE|OLD_STATE/);
});

test('legacy Mnemon authorities restore exact data and withdraw fixed, state and mixed projections once', async () => {
  const { Session } = await adaptedModule('@deepseek-ai/dsh-session');
  for (const placement of ['fixed', 'state', undefined]) {
    const session = new Session('mnemon-authority-' + placement);
    const user = createUserMessage({ content: [{ type: 'text', text: 'USER_KEEP' }], source: { kind: 'user' } });
    const assistant = createAssistantMessage({ content: [{ type: 'text', text: 'ASSISTANT_KEEP' }], source: { provider: 'fixture', model: 'fixture' } });
    const tool = createToolResultMessage({ callId: 'fixture', content: [{ type: 'text', text: 'TOOL_KEEP' }], isError: false });
    const originals = ['recall', 'recall', 'memory-snapshot'].map((form, index) => createUserMessage({ content: [{ type: 'text', text: 'EXACT_MNEMON_DATA_' + index }], source: { kind: 'dsh-mnemon', form, ...(form === 'memory-snapshot' ? { snapshot: { boundary: 'fixture', entries: [] } } : {}) } }));
    const authority = message => session.append('user/message', createUserMessage({ content: [], source: { ...message.source, compositionAuthority: true, compositionOriginalContent: message.content, compositionOriginalId: message.id } }), { surfaceOp: 'append' });
    authority(originals[0]);
    session.append('user/message', user, { surfaceOp: 'append' });
    authority(originals[1]);
    session.append('assistant/message', { turn: 1, step: 1, message: assistant, stream: [] }, { surfaceOp: 'append' });
    session.append('tool/result', { turn: 1, step: 1, message: tool }, { surfaceOp: 'append' });
    authority(originals[2]);
    const guidance = createUserMessage({ content: [{ type: 'text', text: 'MNEMON_INSTRUCTIONS_KEEP' }], source: { kind: 'dsh-mnemon', form: 'instructions' } });
    authority(guidance);
    const guidanceId = promptMessageDescriptor(guidance).id;
    for (const [slot, form] of ['recall', 'recall', 'memory-snapshot', 'instructions'].entries()) session.append('user/message', createUserMessage({ content: [{ type: 'text', text: form === 'instructions' ? 'MNEMON_INSTRUCTIONS_KEEP' : 'OLD_MANAGED_DATA_' + slot }], source: { kind: 'prompt-composition', version: 1, key: 'legacy', slot, contributionId: 'message:dsh-mnemon:' + form + ':', ...(placement ? { placement } : {}) } }), { surfaceOp: 'append' });
    const plan = { version: 1, systemText: '', systemSourceIds: [], contributions: [{ id: guidanceId, role: 'user', ...(placement ? { placement } : {}), text: 'MNEMON_INSTRUCTIONS_KEEP' }] };
    const incoming = createUserMessage({ content: [{ type: 'text', text: 'NEW_INPUT_KEEP' }], source: { kind: 'user' } });
    commitPromptComposition(session, plan, [incoming], true);
    const restored = modelMessages(session);
    assert.deepEqual(restored.slice(0, 6), [originals[0], user, originals[1], assistant, tool, originals[2]], 'restore source IDs, content and order without changing interleaved conversation');
    assert.equal(restored.filter(message => message.id === incoming.id).length, 1);
    assert.doesNotMatch(body(restored), /OLD_MANAGED_DATA/);
    assert.ok(restored.some(message => message.source.contributionId === guidanceId), 'instructions keep their existing composition contract');
    const replay = Session.create('mnemon-migration-replay', session.snapshotEvents());
    assert.deepEqual(modelMessages(replay), restored);
    const before = replay.seq;
    commitPromptComposition(replay, plan, [incoming], false);
    assert.equal(replay.seq, before, 'retry/replay appends no duplicate restoration or revocation');
    assert.deepEqual(modelMessages(replay), restored);
    restorePromptComposition(replay);
    assert.deepEqual(modelMessages(replay).filter(message => message.source.kind === 'dsh-mnemon'), [...originals, guidance], 'disabling reuses exact authority restoration including original IDs');
  }
});

// Exercise the real request builder and transport projection, not just the visible body helper.
test('composition bookkeeping preserves native incremental tool history while real history replacement resets it', async () => {
  const [{ Session }, { ReactLoopAgent }, { SurfaceManager }] = await Promise.all([
    adaptedModule('@deepseek-ai/dsh-session'),
    adaptedModule('@deepseek-ai/dsh-agent-loop', 'export { ReactLoopAgent };'),
    adaptedModule('@deepseek-ai/dsh-session', '', 'lib/types/surface.js'),
  ]);
  const session = new Session('bookkeeping-wire');
  const user = (text, source = { kind: 'user' }) => createUserMessage({ content: [{ type: 'text', text }], source });
  const tool = name => ({ name, description: name, parameters: { type: 'object', properties: {} } });
  const a = tool('fixture_a'), b = tool('fixture_b');
  let plan = { version: 1, systemText: 'SYSTEM', systemSourceIds: ['system'], configKey: 'initial', contributions: [
    { id: 'fixed', role: 'user', placement: 'fixed', text: 'FIXED' }, { id: 'state', role: 'user', placement: 'state', text: 'STATE_ONE' },
  ] };
  session.append('system/message', { turn: 1, step: 1, message: createSystemMessage('SYSTEM') }, { surfaceOp: 'append' });
  const first = user('FIRST_USER');
  commitPromptComposition(session, plan, [first], true);
  const agent = { session, requestHeaderLogged: false, requestSurfaceGeneration: session.surface.contentGeneration, frozenMessages: new WeakSet() };
  const build = (tools = [a, b]) => ReactLoopAgent.prototype.buildRequest.call(agent, { provider: 'fixture', model: 'fixture' }, undefined, tools, { turn: 1, step: 1 }, false, new AbortController().signal);
  const project = request => projectToolUpdates(request.messages, request.tools, 'in-history', request.toolHistory);
  const parity = () => {
    const events = session.snapshotEvents(), surface = new SurfaceManager(events);
    assert.equal(surface.contentGeneration, session.surface.contentGeneration);
    assert.equal(surface.replaceGeneration, session.surface.replaceGeneration);
    assert.deepEqual(surface.nodes, session.surface.nodes);
    assert.deepEqual(surface.nodes.map(seq => surface.deriveEventMessage(events[seq])).filter(Boolean), session.deriveMessages());
    assert.deepEqual(Session.create('bookkeeping-replay', events).deriveMessages(), session.deriveMessages());
  };
  build([a]);
  let request = build(), wire = project(request);
  assert.equal(request.toolHistory.updates.length, 1);
  assert.equal(wire.tools.find(tool => tool.name === b.name).deferLoading, true);
  assert.equal(wire.messages.filter(message => message.role === 'developer').length, 1);
  for (const change of ['control', 'fixed', 'state', 'new-inputs']) {
    const beforeMessages = session.deriveMessages(), beforeWire = wire, history = request.toolHistory;
    const generation = session.surface.contentGeneration, replacements = session.surface.replaceGeneration;
    if (change === 'control') plan = { ...plan, configKey: 'unused-id-order-change' };
    if (change === 'fixed') plan = { ...plan, contributions: [{ ...plan.contributions[0], text: 'FIXED_UPDATED' }, plan.contributions[1]] };
    if (change === 'state') plan = { ...plan, contributions: [plan.contributions[0], { ...plan.contributions[1], text: 'STATE_TWO' }] };
    const incoming = change === 'new-inputs' ? [user('NEXT_USER'), user('PRODUCER_STATE', { kind: 'fixture-state', form: 'snapshot', sections: [{ name: 'state', text: 'PRODUCER_STATE' }] }), user('PRODUCER_AGENTS', { kind: 'agent-instructions', baselineIdentity: 'fixture-baseline', changes: [], compositionSections: [{ key: '/fixture/AGENTS.md', text: 'EXACT_FILE_BLOCK' }] })] : [];
    commitPromptComposition(session, plan, incoming, incoming.length > 0);
    assert.equal(session.surface.contentGeneration, generation, change + ' must not rewrite previously visible history');
    assert.equal(session.surface.replaceGeneration, replacements + (change === 'new-inputs' ? 0 : 1), 'hidden control replacement remains durable; fresh producer authority is append-only');
    assert.deepEqual(session.deriveMessages().slice(0, beforeMessages.length), beforeMessages);
    assert.deepEqual(session.deriveMessages(), modelMessages(session), 'incremental derived cache must reflect appended content');
    request = build(); wire = project(request);
    assert.deepEqual(request.toolHistory, history);
    assert.deepEqual(wire.tools, beforeWire.tools);
    assert.deepEqual(wire.messages.slice(0, beforeWire.messages.length), beforeWire.messages);
    if (change === 'control') assert.deepEqual(wire, beforeWire, 'an unused ordering change changes no provider messages or declarations');
    for (const producer of incoming.slice(1)) {
      const authority = session.surface.nodes.map(seq => session.eventAt(seq).data).find(message => message?.source?.compositionOriginalId === producer.id);
      assert.deepEqual(authority.source, { ...producer.source, compositionAuthority: true, compositionOriginalId: producer.id, compositionOriginalContent: producer.content });
      assert.equal(authority.content.length, 0);
    }
    parity();
  }
  assert.equal(session.snapshotEvents().filter(event => event.type === 'request/header' && event.data.reason === 'series').length, 0);
  const generation = session.surface.contentGeneration;
  const seq = session.surface.nodes.find(seq => session.eventAt(seq).data?.id === first.id);
  session.append('user/message', user('REPLACED_USER'), { surfaceOp: { op: 'replace', startSeq: seq, endSeq: seq }, sourceEventSeqs: [seq] });
  assert.equal(session.surface.contentGeneration, generation + 1, 'real history rewrites retain native invalidation');
  request = build();
  assert.equal(request.toolHistory.updates.length, 0);
  assert.equal(session.snapshotEvents().at(-1).type, 'request/header');
  assert.equal(session.snapshotEvents().at(-1).data.reason, 'series');
  const beforeRestore = session.surface.contentGeneration;
  restorePromptComposition(session);
  assert.ok(session.surface.contentGeneration > beforeRestore, 'restoring visible authority still invalidates');
  assert.match(body(session.deriveMessages()), /PRODUCER_STATE/);
  assert.match(body(session.deriveMessages()), /PRODUCER_AGENTS/);
  parity();
});

test('only one-to-one unprojected composition bookkeeping skips native content invalidation', async () => {
  const [{ Session }, { SurfaceManager }] = await Promise.all([
    adaptedModule('@deepseek-ai/dsh-session'),
    adaptedModule('@deepseek-ai/dsh-session', '', 'lib/types/surface.js'),
  ]);
  const hidden = () => createUserMessage({ content: [], source: { kind: 'prompt-composition-state' } });
  const visible = () => createUserMessage({ content: [{ type: 'text', text: 'VISIBLE' }], source: { kind: 'user' } });
  for (const kind of ['hidden', 'visible-to-hidden', 'hidden-to-visible', 'generic-empty', 'range', 'projected']) {
    const log = [];
    const append = message => log.push({ seq: log.length, type: 'user/message', data: message, surfaceOp: 'append' });
    append(kind === 'visible-to-hidden' ? visible() : kind === 'generic-empty' ? createUserMessage({ content: [], source: { kind: 'user' } }) : hidden());
    if (kind === 'range') append(hidden());
    const projection = { type: 'image/offload', project: () => new Map([[0, visible()]]) };
    if (kind === 'projected') log.push({ seq: log.length, type: 'image/offload', data: {} });
    const surface = new SurfaceManager(log, 0, kind === 'projected' ? [projection] : []);
    const before = surface.contentGeneration, replaced = surface.replaceGeneration;
    const endSeq = kind === 'range' ? 1 : 0;
    log.push({ seq: log.length, type: 'user/message', data: kind === 'hidden-to-visible' ? visible() : hidden(), surfaceOp: { op: 'replace', startSeq: 0, endSeq }, sourceEventSeqs: endSeq === 1 ? [0, 1] : [0] });
    assert.equal(surface.contentGeneration, before + (kind === 'hidden' ? 0 : 1), kind);
    assert.equal(surface.replaceGeneration, replaced + 1, kind);
  }
  if (HOST_VERSION === '0.2.2-rc.3') for (const kind of ['hidden', 'visible-to-hidden', 'hidden-to-visible']) {
    const session = new Session('bookkeeping-batch-' + kind);
    session.append('user/message', visible(), { surfaceOp: 'append' });
    const log = [...session.snapshotEvents()], surface = new SurfaceManager(log);
    const startSeq = session.seq;
    session.append([
      ['user/message', kind === 'visible-to-hidden' ? visible() : hidden(), { surfaceOp: 'append' }],
      ['user/message', kind === 'hidden-to-visible' ? visible() : hidden(), { surfaceOp: { op: 'replace', startSeq, endSeq: startSeq }, sourceEventSeqs: [startSeq] }],
    ]);
    const candidates = session.snapshotEvents().slice(startSeq), accept = surface.prepareBatch(candidates);
    log.push(...candidates); accept();
    const generation = kind === 'hidden' ? 0 : 1;
    assert.equal(session.surface.contentGeneration, generation, 'server batch: ' + kind);
    assert.equal(surface.contentGeneration, generation, 'browser batch: ' + kind);
    assert.equal(new SurfaceManager(log).contentGeneration, generation, 'batch replay: ' + kind);
    assert.deepEqual(surface.nodes, session.surface.nodes);
    assert.deepEqual(Session.create('batch-replay', log).deriveMessages(), session.deriveMessages());
  }
});

// Real risks: host file corruption/partial restore and losing budgeted AGENTS boundaries.
test('audited host assets preserve budgeted file identities and apply/restore only matching synthetic installations', async t => {
  const root = join(await temporaryDirectory(t), 'installation');
  const backup = join(root, 'backup');
  for (const patch of PATCHES) {
    const dir = join(root, 'node_modules', patch.name);
    await mkdir(dirname(join(dir, patch.file ?? 'lib/index.js')), { recursive: true });
    await writeFile(join(dir, 'package.json'), JSON.stringify({ name: patch.name, version: HOST_VERSION, type: 'module' }));
    const source = await originalSource(patch);
    assert.equal(createHash('sha256').update(source).digest('hex'), patch.sha256, `${patch.name}/${patch.file ?? 'lib/index.js'} audited source`);
    await writeFile(join(dir, patch.file ?? 'lib/index.js'), source);
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
  const helperPath = 'node_modules/@deepseek-ai/dsh-agent-loop/lib/tool-wrap-admission.js';
  const helperTarget = join(root, helperPath), manifestPath = join(backup, 'manifest.json');
  const helper = await readFile(helperTarget, 'utf8'), manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
  const digest = value => createHash('sha256').update(value).digest('hex');
  const oldHelper = helper + '\n// authenticated previous helper revision\n';
  const prior = { ...manifest, helper: { path: helperPath, sha256: digest(oldHelper) } };
  await writeFile(helperTarget, oldHelper);
  // Matching content hashes alone cannot authorize another root or helper destination.
  for (const invalid of [{ ...prior, root: join(root, 'other') }, { ...prior, helper: { ...prior.helper, path: helperPath + '.other' } }]) {
    const saved = JSON.stringify(invalid);
    await writeFile(manifestPath, saved);
    result = run('--apply');
    assert.notEqual(result.status, 0);
    assert.equal(await readFile(helperTarget, 'utf8'), oldHelper);
    assert.equal(await readFile(manifestPath, 'utf8'), saved);
  }
  const savedPrior = JSON.stringify(prior);
  await writeFile(manifestPath, savedPrior);
  result = run('--check');
  assert.equal(result.status, 0, result.stderr);
  assert.equal(await readFile(helperTarget, 'utf8'), oldHelper, 'check leaves the old helper untouched');
  assert.equal(await readFile(manifestPath, 'utf8'), savedPrior);
  result = run('--apply');
  assert.equal(result.status, 0, result.stderr);
  assert.equal(await readFile(helperTarget, 'utf8'), helper, 'explicit apply upgrades the manifest-authenticated helper');
  const upgradedManifest = await readFile(manifestPath, 'utf8');
  assert.equal(JSON.parse(upgradedManifest).helper.sha256, digest(helper));
  assert.deepEqual(JSON.parse(upgradedManifest), manifest, 'helper upgrade retains the exact audited files, packages and restoration metadata');
  for (const [index, patch] of PATCHES.entries()) assert.equal(await readFile(join(backup, `${index}.original.js`), 'utf8'), await originalSource(patch));
  const independentHelper = helper + '\n// independent helper edit\n';
  await writeFile(helperTarget, independentHelper);
  for (const mode of ['--apply', '--restore']) {
    result = run(mode);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /helper/i);
    assert.equal(await readFile(helperTarget, 'utf8'), independentHelper);
    assert.equal(await readFile(manifestPath, 'utf8'), upgradedManifest);
    for (const patch of PATCHES) assert.equal(await readFile(join(root, 'node_modules', patch.name, patch.file ?? 'lib/index.js'), 'utf8'), patchSource(await originalSource(patch), patch));
  }
  await writeFile(helperTarget, helper);
  const target = join(root, 'node_modules', PATCHES[0].name, 'lib/index.js');
  const patched = await readFile(target, 'utf8');
  await writeFile(target, patched + '\n// independent edit\n');
  result = run('--restore');
  assert.notEqual(result.status, 0);
  assert.match(await readFile(target, 'utf8'), /independent edit/);
  await writeFile(target, patched);
  result = run('--restore');
  assert.equal(result.status, 0, result.stderr);
  await assert.rejects(stat(helperTarget), { code: 'ENOENT' });
  assert.equal(JSON.parse(await readFile(manifestPath, 'utf8')).state, 'restored');
  for (const patch of PATCHES) assert.equal(await readFile(join(root, 'node_modules', patch.name, patch.file ?? 'lib/index.js'), 'utf8'), await originalSource(patch));
  const patchedInstructions = await adaptedModule('@deepseek-ai/dsh-agent-instructions');
  const original = await import('@deepseek-ai/dsh-agent-instructions');
  const file = { absolutePath: '/fixture/project-a/AGENTS.md', displayPath: 'AGENTS.md', content: 'BUDGET_CONTENT_' + 'x'.repeat(4000) };
  const rendered = patchedInstructions.renderAgentInstructions([file], { maxBytes: 650 });
  assert.equal(rendered.text, original.renderAgentInstructions([file], { maxBytes: 650 }).text);
  assert.ok(rendered.truncated.length);
  assert.equal(rendered.compositionSections[0].key, file.absolutePath);
  assert.ok(rendered.compositionSections[0].text.length < file.content.length);
  for (const maxBytes of [1, 150, 250, 400, 650]) {
    const result = patchedInstructions.renderAgentInstructions([file], { maxBytes });
    assert.equal(result.compositionSections[0].text, result.text, 'preserve the native compact/budget fallback at ' + maxBytes + ' bytes');
    assert.ok(Buffer.byteLength(result.compositionSections[0].text) <= maxBytes);
  }
  const multiple = patchedInstructions.renderAgentInstructions([file, { ...file, absolutePath: '/fixture/project-a/src/AGENTS.md', displayPath: 'src/AGENTS.md' }], { maxBytes: 20000 });
  assert.equal(multiple.compositionSections.filter(section => section.text.includes('The following workspace instructions')).length, 1, 'render the selected intro once across file blocks');
  const other = patchedInstructions.renderAgentInstructions([{ ...file, absolutePath: '/fixture/project-b/AGENTS.md' }], { maxBytes: 650 });
  assert.notEqual(other.compositionSections[0].key, rendered.compositionSections[0].key);
});
