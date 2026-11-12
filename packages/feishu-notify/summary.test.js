import test from 'node:test';
import assert from 'node:assert/strict';
import { Context } from '@deepseek-ai/cordis';
import { SessionStore } from '@deepseek-ai/dsh-session';
import { SessionProjectionRegistry } from '@deepseek-ai/dsh-session-projection';
import { SystemPrompt } from '@deepseek-ai/dsh-system-prompt';
import { createAssistantMessage, createToolResultMessage } from '@deepseek-ai/dsh-llm';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve, basename } from 'node:path';
import { apply } from './index.js';
import { DEFAULT_CONFIG, FeishuClient, FeishuNotifyService, NotifyError, validateConfig } from './core.js';
import { summaryProjection, SUMMARY_KEY, turnSummary, compactSummary } from './summary.js';

const text = text => ({ type: 'text', text });
const SOURCE = { provider: 'synthetic-provider', model: 'synthetic-model' };
const SUMMARY = '已完成：实现摘要。\n未完成：未部署。\n需你处理：确认接收方。';
const PHONE_SUMMARY = '✅ 实现摘要。\n❌ 未部署。\n👉 确认接收方。';
const cfg = () => ({ ...structuredClone(DEFAULT_CONFIG), appId: 'cli_synthetic', appSecret: 'synthetic-secret', receive_id: 'ou_synthetic', enabled: true });
const memoryStore = value => ({ load: async () => structuredClone(value), save: async patch => { value = validateConfig(patch, value); return structuredClone(value); } });
const session = id => ({ id, header: {} });
const start = turn => ({ type: 'turn/start', data: { turn } });
function mockClient(send) {
  const client = new FeishuClient({ fetch: async () => { throw new Error('Network forbidden in test'); } });
  client.send = send; return client;
}
function fixture({ config = cfg(), send, now } = {}) {
  const sent = [];
  const service = new FeishuNotifyService({ profile: { name: 'synthetic', dir: '/unused' }, store: memoryStore(config), client: mockClient(send ?? (async (_config, value) => { sent.push(value); return 'synthetic-message'; })), now });
  return { service, sent };
}

test('phone summaries use short emoji facts, skip empty and duplicate items, and never infer success for prose', async () => {
  assert.equal(compactSummary(SUMMARY), PHONE_SUMMARY);
  assert.equal(compactSummary('已完成：更新提醒。\n未完成：未说明\n需你处理：无。'), '✅ 更新提醒。');
  assert.equal(compactSummary('已完成：更新提醒。\n未完成：更新提醒。\n需你处理：未说明'), '✅ 更新提醒。');
  assert.equal(compactSummary('已完成：无\n未完成：未说明\n需你处理：暂无'), 'ℹ️ 未说明具体工作状态');
  assert.equal(compactSummary('尚未部署，需确认权限。'), 'ℹ️ 尚未部署，需确认权限。');
  const long = compactSummary('已完成：' + '甲'.repeat(100) + '\n未完成：' + '乙'.repeat(100) + '\n需你处理：' + '丙'.repeat(100));
  assert.ok(Array.from(long).length <= 104);
  assert.ok(long.split('\n').every(line => Array.from(line).length <= 35 && line.endsWith('…')));
  const { service, sent } = fixture();
  // Redact whole secrets before shortening: the line boundary deliberately cuts inside this value.
  await service.manual(session('redact-boundary'), 1, { message: '已完成：' + '甲'.repeat(28) + 'synthetic-secret' }, { callId: 'boundary' });
  assert.doesNotMatch(sent.at(-1), /synthetic|synt/); assert.match(sent.at(-1), /\*\*\*/);
  await service.dispose();
});

test('manual delivery respects disabled, quiet hours, child sessions and missing configuration', async () => {
  const cases = [
    [Object.assign(cfg(), { enabled: false }), session('disabled'), 'DISABLED'],
    [Object.assign(cfg(), { quietHours: { ...cfg().quietHours, enabled: true, start: '00:00', end: '00:00' } }), session('quiet'), 'QUIET_HOURS'],
    [cfg(), { id: 'child', header: { origin: 'subagent' } }, 'SUBAGENT'],
    [Object.assign(cfg(), { appId: '' }), session('unconfigured'), 'NOT_CONFIGURED']
  ];
  for (const [config, s, code] of cases) {
    const { service } = fixture({ config });
    const manual = await service.manual(s, 2, { message: '已完成：工作收尾。' }, { callId: 'manual-' + code });
    assert.equal(manual.code, code);
    await service.dispose();
  }
});

test('manual previews redact saved secrets and tokens, without truncating bodies at 500', async () => {
  const { service, sent } = fixture();
  service.client.sensitive.add('synthetic-token');
  const manual = await service.manual(session('manual'), 2, { message: 'x'.repeat(1000) + 'synthetic-secret synthetic-token' }, { callId: 'long' });
  assert.equal(manual.status, 'success'); assert.ok(Array.from(sent.at(-1)).length <= 35);
  const status = await service.status(); assert.ok(Array.from(status.results[0].message).length <= 35);
  assert.equal(service.client.redact('x'.repeat(1000), 2400).length, 1000, 'the explicit redact limit remains independent of phone formatting');
  assert.doesNotMatch(JSON.stringify(status), /synthetic-secret|synthetic-token/);
  assert.equal(service.client.redact('e'.repeat(800)).length, 500);
  await service.dispose();
});

test('manual duplicate call/content reservations expire after 60 seconds; invalid session/turn never send', async () => {
  let fail = true, calls = 0, now = 1000;
  const { service } = fixture({ now: () => now, send: async () => { calls++; if (fail) throw new NotifyError('synthetic failure', 'SYNTHETIC'); return 'sent'; } });
  const s = session('s1');
  assert.equal((await service.manual(s, 1, { message: SUMMARY }, { callId: 'same' })).status, 'failed');
  fail = false;
  assert.equal((await service.manual(s, 2, { message: 'different' }, { callId: 'same' })).code, 'DUPLICATE');
  assert.equal((await service.manual(s, 2, { message: SUMMARY }, { callId: 'new' })).code, 'DUPLICATE');
  now += 60001;
  assert.equal((await service.manual(s, 3, { message: SUMMARY }, { callId: 'new' })).status, 'success');
  assert.equal((await service.manual(undefined, undefined, { message: 'manual' })).code, 'NO_AGENT_SESSION');
  assert.equal((await service.manual(s, undefined, { message: 'manual' })).code, 'NO_CURRENT_TURN');
  assert.equal((await service.manual({ id: 'child', header: { delegationDepth: 1 } }, 1, { message: SUMMARY })).code, 'SUBAGENT');
  assert.equal(calls, 2);
  await service.dispose();
});

test('manual turn lock blocks concurrent different calls and keeps successful turns sent beyond 60 seconds', async t => {
  let release, began, calls = 0, now = 1000;
  const started = new Promise(resolve => { began = resolve; });
  const { service } = fixture({ now: () => now, send: async () => {
    calls++;
    if (calls === 1) { began(); return new Promise(resolve => { release = resolve; }); }
    return 'synthetic-other-message';
  } });
  t.after(() => { release?.('synthetic-release'); return service.dispose(); });
  const s = session('manual-concurrent');
  const first = service.manual(s, 1, { message: '已完成：第一项任务。' }, { callId: 'first' });
  await started;
  now += 61000;
  const concurrent = await service.manual(s, 1, { message: '已完成：内容不同也不能并发发送。' }, { callId: 'second' });
  assert.equal(concurrent.status, 'skipped'); assert.equal(concurrent.code, 'MANUAL_PENDING'); assert.equal(calls, 1);
  assert.equal((await service.manual(s, 2, { message: '下一回合' }, { callId: 'next' })).status, 'success');
  assert.equal((await service.manual(session('other-agent'), 1, { message: '另一个 agent' }, { callId: 'other' })).status, 'success');
  release('synthetic-first-message');
  assert.equal((await first).status, 'success');
  now += 61000;
  const repeat = await service.manual(s, 1, { message: '又一份不同内容' }, { callId: 'third' });
  assert.equal(repeat.status, 'skipped'); assert.equal(repeat.code, 'MANUAL_SENT'); assert.equal(calls, 3);
});

test('manual failure, disabled skip and cancellation release the turn for a new attempt without waiting 60 seconds', async t => {
  let fail = true, calls = 0;
  const { service } = fixture({ send: async () => { calls++; if (fail) throw new NotifyError('synthetic failure', 'SYNTHETIC'); return 'sent'; } });
  t.after(() => service.dispose());
  const s = session('manual-retry');
  assert.equal((await service.manual(s, 1, { message: '第一次' }, { callId: 'failed' })).status, 'failed');
  fail = false;
  assert.equal((await service.manual(s, 1, { message: '新的重试' }, { callId: 'retry' })).status, 'success');
  await service.configure({ enabled: false });
  assert.equal((await service.manual(s, 2, { message: '禁用时' }, { callId: 'disabled' })).code, 'DISABLED');
  await service.configure({ enabled: true });
  assert.equal((await service.manual(s, 2, { message: '启用后' }, { callId: 'enabled' })).status, 'success');
  const controller = new AbortController(); controller.abort();
  assert.equal((await service.manual(s, 3, { message: '已取消' }, { callId: 'cancel', signal: controller.signal })).code, 'CANCELLED');
  assert.equal((await service.manual(s, 3, { message: '取消后重试' }, { callId: 'after-cancel' })).status, 'success');
  assert.equal(calls, 4);
});

test('durable notify_user success restores only its own turn, including concurrent nested calls; skipped/error cannot restore suppression', () => {
  let state = summaryProjection.init({}, 0);
  const fold = event => { state = summaryProjection.apply(state, event); };
  fold(start(1));
  fold({ type: 'tool/call', data: { turn: 1, callId: 'success', name: 'notify_user' } });
  fold({ type: 'tool/ptc-dispatch-start', data: { subCallId: 'nested', name: 'notify_user' } });
  fold(start(2));
  fold({ type: 'tool/result', data: { turn: 1, message: { toolCallId: 'success', content: [text(JSON.stringify({ kind: 'manual', status: 'success', turn: 1 }))] } } });
  fold({ type: 'tool/ptc-dispatch', data: { subCallId: 'nested', name: 'notify_user', isError: false, content: [text(JSON.stringify({ kind: 'manual', status: 'success', turn: 1 }))] } });
  assert.equal(turnSummary(state, 1).manualSent, true); assert.equal(turnSummary(state, 2).manualSent, false);
  for (const [callId, status, isError] of [['skipped', 'skipped', false], ['failed', 'failed', false], ['error', 'success', true]]) {
    fold({ type: 'tool/call', data: { turn: 2, callId, name: 'notify_user' } });
    fold({ type: 'tool/result', data: { turn: 2, message: { toolCallId: callId, isError, content: [text(JSON.stringify({ kind: 'manual', status, turn: 2 }))] } } });
    assert.equal(turnSummary(state, 2).manualSent, false);
  }
  assert.equal(summaryProjection.apply(state, { type: 'assistant/message', data: { turn: 2, message: { content: [text('not retained')], source: SOURCE } } }), state);
  assert.deepEqual(Object.keys(turnSummary(state, 1)).sort(), ['calls', 'manualSent', 'turn']);
  for (let turn = 3; turn < 50; turn++) fold(start(turn));
  assert.equal(state.turns.length, 8);
  assert.deepEqual(summaryProjection.stateSchema.parse(JSON.parse(JSON.stringify(state))), state);
});

test('real Cordis projection contract checkpoints/replays host-only receipts, restores v1 checkpoints and uses postcommit turn identity', async t => {
  const dir = await mkdtemp(join(tmpdir(), 'feishu-notify-test-'));
  t.after(async () => { const target = resolve(dir); assert.ok(basename(target).startsWith('feishu-notify-test-')); await rm(target, { recursive: true }); });
  const ctx = new Context();
  const projections = new SessionProjectionRegistry(ctx);
  const sessions = new SessionStore(ctx);
  const tools = new Map();
  ctx.provide('profileContext', { name: 'synthetic', dir });
  ctx.provide('tools', { register(tool) { tools.set(tool.name, tool); } });
  let llmCalls = 0;
  ctx.provide('llm', { stream() { llmCalls++; throw new Error('cannot create effect on inactive context'); } });
  const prompts = new SystemPrompt(ctx, { includeHarnessIdentity: false });
  prompts.section({ name: 'other-plugin', order: 1, text: 'Keep this unrelated section.' });
  const plugin = await ctx.plugin({ name: 'feishu-notify-integration', apply });
  t.after(() => plugin.dispose());
  // Optional dependency activation is queued by Cordis.
  await new Promise(resolve => setImmediate(resolve));
  const section = (await prompts.assemble()).sections.find(row => row.name === 'feishu-notify:completion');
  assert.ok(section);
  assert.match(section.text, /整体工作持续至少 3 分钟/);
  assert.match(section.text, /完成或收尾.*notify_user 一次/);
  assert.match(section.text, /子任务、中间进度、简短问答、内部异常不通知/);
  assert.match(section.text, /同一整体任务已成功通知则不重复/);
  const service = ctx.get('feishuNotify');
  t.after(() => service.dispose());
  const sent = []; service.client.send = async (_config, value) => { sent.push(value); return 'synthetic-message'; };
  await service.configure(cfg());
  const s = sessions.create('projection-live');
  s.append('turn/start', { turn: 1 });
  const message = createAssistantMessage({ content: [text('final visible')], source: SOURCE });
  s.append('assistant/message', { turn: 1, step: 1, message, stream: [] }, { surfaceOp: 'append' });
  s.append('tool/call', { turn: 1, step: 1, name: 'notify_user', callId: 'live-call', arguments: '{}' });
  const beforeResultCheckpoint = projections.checkpoint(s);
  // Old checkpoints contain both obsolete fields and an unresolved tool call.
  Object.assign(beforeResultCheckpoint[SUMMARY_KEY].val.turns[0], { text: 'final visible', source: SOURCE });
  const checkpointFloor = projections.restoreFloor(beforeResultCheckpoint);
  assert.ok(checkpointFloor > 0, 'checkpoint recovery must read a suffix rather than the full log');
  const tool = tools.get('notify_user'); assert.ok(tool);
  assert.deepEqual(Object.keys(tool.parameters.properties), ['message', 'title']);
  assert.equal((await tool.execute({ message: 'without agent' }, { callId: 'no-agent' })).code, 'NO_AGENT_SESSION');
  // A concurrent new turn must not steal the committed call identity.
  s.append('turn/start', { turn: 2 });
  const result = await tool.execute({ message: SUMMARY }, { agent: { session: s }, callId: 'live-call' });
  assert.equal(result.status, 'success'); assert.equal(result.turn, 1);
  const resultMessage = createToolResultMessage({ callId: 'live-call', content: [text(JSON.stringify(result))], isError: false });
  s.append('tool/result', { turn: 1, step: 1, message: resultMessage }, { surfaceOp: 'append' });
  const checkpoint = projections.checkpoint(s);
  assert.equal(checkpoint[SUMMARY_KEY].ver, 1);
  assert.equal(turnSummary(projections.stateOf(s, SUMMARY_KEY), 1).manualSent, true);
  assert.equal(turnSummary(projections.stateOf(s, SUMMARY_KEY), 2).manualSent, false);
  assert.equal(projections.snapshot(s).values[SUMMARY_KEY], undefined, 'no client wire view');
  summaryProjection.stateSchema.parse(checkpoint[SUMMARY_KEY].val);
  service.manualTurns = new WeakMap(); // Model a reload: only the durable projection receipt remains.
  s.append('turn/end', { turn: 1, reason: { kind: 'completed' } });
  await Promise.allSettled([...service.pending]);
  assert.equal(sent.length, 1); assert.equal(service.results[0].status, 'success');
  assert.equal(service.results[0].kind, 'manual', 'turn/end must not create even a skipped automatic result');
  // The serialized durable tool receipt alone reconstructs success after reload.
  const replay = new Context(); const replayProjection = new SessionProjectionRegistry(replay);
  replayProjection.register(summaryProjection);
  const restored = replayProjection.restore({}, s.snapshotEvents(), 0, s.header, 0);
  assert.equal(turnSummary(restored.checkpoint[SUMMARY_KEY].val, 1).manualSent, true);
  const tail = s.snapshotEvents(checkpointFloor);
  assert.ok(tail.length < s.seq);
  const restoredFromCheckpoint = replayProjection.restore(JSON.parse(JSON.stringify(beforeResultCheckpoint)), tail, checkpointFloor, s.header, 0);
  const checkpointState = restoredFromCheckpoint.checkpoint[SUMMARY_KEY].val;
  assert.equal(turnSummary(checkpointState, 1).manualSent, true, 'tail receipt resolves the pending call from the old checkpoint');
  assert.equal(turnSummary(checkpointState, 2).manualSent, false);
  assert.deepEqual(checkpointState, restored.checkpoint[SUMMARY_KEY].val);
  const legacyCheckpoint = structuredClone(checkpoint);
  for (const row of legacyCheckpoint[SUMMARY_KEY].val.turns) Object.assign(row, { text: 'obsolete visible text', source: SOURCE });
  const recovered = sessions.create('projection-reloaded', { seed: s.snapshotEvents() });
  const legacyFloor = projections.restoreFloor(legacyCheckpoint);
  assert.ok(legacyFloor > 0);
  projections.hydrate(recovered, legacyCheckpoint, recovered.snapshotEvents(legacyFloor), legacyFloor);
  assert.deepEqual(projections.stateOf(recovered, SUMMARY_KEY), checkpointState, 'old checkpoint fields are discarded and the successful receipt survives');
  service.now = () => Date.now() + 61000;
  recovered.append('tool/call', { turn: 1, step: 2, name: 'notify_user', callId: 'restored-repeat', arguments: '{}' });
  const duplicate = await tool.execute({ message: '不同的内容也不重复' }, { agent: { session: recovered }, callId: 'restored-repeat' });
  assert.equal(duplicate.code, 'MANUAL_SENT'); assert.equal(sent.length, 1, 'old checkpoint success survives the in-memory reset and 60 second expiry');
  s.append('turn/end', { turn: 2, reason: { kind: 'completed' } });
  await Promise.allSettled([...service.pending]);
  assert.equal(sent.length, 1);
  s.append('turn/start', { turn: 3 });
  s.append('assistant/message', { turn: 3, step: 1, message: createAssistantMessage({ content: [text('本轮完成摘要实现，未部署。')], source: SOURCE }), stream: [] }, { surfaceOp: 'append' });
  s.append('turn/end', { turn: 3, reason: { kind: 'completed' } });
  ctx.emit('agent/error', { agent: { session: s }, turn: 3, error: new Error('cannot create effect on inactive context') });
  await Promise.allSettled([...service.pending]);
  assert.equal(sent.length, 1); assert.equal(llmCalls, 0);
  s.append('tool/call', { turn: 3, step: 2, name: 'notify_user', callId: 'next-request', arguments: '{}' });
  assert.equal((await tool.execute({ message: '已完成：下一项整体任务。' }, { agent: { session: s }, callId: 'next-request' })).status, 'success');
  assert.equal(sent.length, 2, 'there is no host clock gate that would reject a cross-turn task');
  s.append('approval/asked', { id: 'immediate', toolName: 'bash' });
  const request = { agent: { session: s }, questions: [{ id: 'plan', question: '确认计划？', intent: { kind: 'plan-review', callId: 'plan' } }], wait: { callId: 'plan' } };
  const answer = await ctx.waterfall('user-questions/request', request, async () => ({ answers: [] }));
  assert.deepEqual(answer, { answers: [] });
  await Promise.allSettled([...service.pending]);
  assert.equal(sent.length, 4); assert.match(sent[2], /^👉 工具权限待确认/); assert.match(sent[3], /^👉 计划待确认/);
  assert.equal(llmCalls, 0, 'immediate reminders do not touch the LLM');
  await plugin.dispose();
  const remaining = (await prompts.assemble()).sections;
  assert.equal(remaining.some(row => row.name === 'feishu-notify:completion'), false);
  assert.equal(remaining.find(row => row.name === 'other-plugin').text, 'Keep this unrelated section.');
  ctx.emit('agent/error', { agent: { session: s }, turn: 3, error: new Error('cannot create effect on inactive context') });
  s.append('turn/end', { turn: 3, reason: { kind: 'error', failure: { code: 'SYNTHETIC', message: 'cannot create effect on inactive context' } } });
  await Promise.resolve();
  assert.equal(sent.length, 4); assert.equal(service.closed, true); assert.equal(service.pending.size, 0);
});
