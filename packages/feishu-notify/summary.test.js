import test from 'node:test';
import assert from 'node:assert/strict';
import { Context } from '@deepseek-ai/cordis';
import { SessionStore } from '@deepseek-ai/dsh-session';
import { SessionProjectionRegistry } from '@deepseek-ai/dsh-session-projection';
import { SystemPrompt } from '@deepseek-ai/dsh-system-prompt';
import { createAssistantMessage, createToolResultMessage, LlmRuntime, LlmAdapter } from '@deepseek-ai/dsh-llm';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve, basename } from 'node:path';
import { apply } from './index.js';
import { DEFAULT_CONFIG, FeishuClient, FeishuNotifyService, NotifyError, validateConfig } from './core.js';
import { summaryProjection, SUMMARY_KEY, turnSummary, SummaryGenerator, SUMMARY_INPUT_LIMIT, visibleText, compactSummary } from './summary.js';

const text = text => ({ type: 'text', text });
const SOURCE = { provider: 'synthetic-provider', model: 'synthetic-model' };
const SUMMARY = '已完成：实现摘要。\n未完成：未部署。\n需你处理：确认接收方。';
const PHONE_SUMMARY = '✅ 实现摘要。\n❌ 未部署。\n👉 确认接收方。';
const cfg = () => ({ ...structuredClone(DEFAULT_CONFIG), appId: 'cli_synthetic', appSecret: 'synthetic-secret', receive_id: 'ou_synthetic', enabled: true });
const memoryStore = value => ({ load: async () => structuredClone(value), save: async patch => { value = validateConfig(patch, value); return structuredClone(value); } });
const session = id => ({ id, header: {} });
const start = turn => ({ type: 'turn/start', data: { turn } });
const assistant = (turn, content, source = SOURCE) => ({ type: 'assistant/message', data: { turn, step: 1, message: { content, source } } });
const end = (turn, kind = 'completed', reason = {}) => ({ type: 'turn/end', data: { turn, reason: { kind, ...reason } } });
const draft = (value = '已实现摘要，尚未部署。', source = SOURCE) => ({ text: value, source, manualSent: false });
function mockClient(send) {
  const client = new FeishuClient({ fetch: async () => { throw new Error('Network forbidden in test'); } });
  client.send = send; return client;
}
function fixture({ config = cfg(), llm, send, now, summaryTimeoutMs } = {}) {
  const sent = [];
  const service = new FeishuNotifyService({ profile: { name: 'synthetic', dir: '/unused' }, store: memoryStore(config), client: mockClient(send ?? (async (_config, value) => { sent.push(value); return 'synthetic-message'; })), llm, now, summaryTimeoutMs });
  return { service, sent };
}
// Legacy service compatibility only: live turn/end events no longer produce these notifications.
function completion(s, turn, summary = draft(), kind = 'completed') { return { kind: kind === 'aborted' ? 'interrupted' : kind, key: `${s.id}:turn:${turn}`, sessionId: s.id, turn, session: s, summary }; }
function goodLLM(onOptions = () => {}) {
  return { async *stream(options) {
    onOptions(options);
    yield { type: 'reasoning-delta', index: 0, text: 'hidden summary reasoning' };
    yield { type: 'text-delta', index: 1, text: SUMMARY };
    yield { type: 'block-end', index: 1, block: text(SUMMARY) };
    yield { type: 'finish', reason: { kind: 'stop' } };
  } };
}

test('projection keeps only last visible text in the exact turn, bounded head/tail, with no reasoning or arguments', () => {
  let state = summaryProjection.init({}, 0);
  for (const event of [start(1), assistant(1, [text('OLD TURN'), { type: 'reasoning', text: 'OLD SECRET' }]), start(2), assistant(2, [text('intermediate')]), assistant(2, [{ type: 'reasoning', text: 'HIDDEN' }, { type: 'tool-use', arguments: 'PRIVATE ARGUMENTS' }, text('FINAL HEAD' + 'x'.repeat(10000) + 'FINAL TAIL')])]) state = summaryProjection.apply(state, event);
  assert.equal(state.currentTurn, 2);
  const row = turnSummary(state);
  assert.equal(row.text.length, SUMMARY_INPUT_LIMIT);
  assert.match(row.text, /^FINAL HEAD/); assert.match(row.text, /FINAL TAIL$/);
  assert.doesNotMatch(row.text, /OLD TURN|HIDDEN|PRIVATE|intermediate/);
  assert.deepEqual(row.source, SOURCE);
  assert.deepEqual(summaryProjection.stateSchema.parse(JSON.parse(JSON.stringify(state))), state);
  assert.equal(summaryProjection.apply(state, { type: 'irrelevant', data: {} }), state);
  assert.equal(visibleText([text('abc'), text('def')]), 'abc\ndef');
  for (let turn = 3; turn < 50; turn++) state = summaryProjection.apply(state, start(turn));
  assert.equal(state.turns.length, 8);
});

test('summary uses same source without tools, preserves text block identity, chooses least supported reasoning effort', async () => {
  let options;
  const llm = goodLLM(value => { options = value; });
  llm.prepareCall = async (config, signal, configure) => {
    assert.equal(signal.aborted, false);
    const controls = configure({ maxTokens: config.maxTokens }, { reasoning: { efforts: [{ id: 'minimal', name: 'Minimum' }, { id: 'high', name: 'High' }], defaultEffort: 'high' } });
    return { config: { ...config, ...controls }, stream: value => llm.stream(value) };
  };
  const generator = new SummaryGenerator({ llm });
  assert.equal(await generator.generate(draft(), { sessionId: 's1' }), SUMMARY);
  assert.equal(options.provider, SOURCE.provider); assert.equal(options.model, SOURCE.model);
  assert.equal(options.reasoningEffort, 'minimal'); assert.equal(options.maxTokens, 300);
  assert.equal(options.sessionId, 's1'); assert.equal(options.tools, undefined);
  assert.deepEqual(options.messages, [{ role: 'user', content: [text(draft().text)] }]);
  assert.match(options.system, /未说明/); assert.match(options.system, /回合结束不表示整个任务完成/);
  assert.equal(generator.controllers.size, 0);
});

test('real LLM runtime accepts identity-free one-shot input and lowest enabled reasoning without a title purpose', async () => {
  const ctx = new Context(); const llm = new LlmRuntime(ctx); let drained = false;
  class SyntheticAdapter extends LlmAdapter {
    providerInfo(provider) { return { id: provider, name: 'Synthetic' }; }
    async resolveModel(provider, model) { return { provider, id: model, name: 'Synthetic', reasoning: { efforts: [{ id: 'off', name: 'Off' }, { id: 'none', name: 'None' }, { id: 'low', name: 'Low' }, { id: 'high', name: 'High' }], defaultEffort: 'high' } }; }
    async *stream(options) {
      assert.equal(options.reasoningEffort, 'low'); assert.equal(options.maxTokens, 300);
      assert.equal(options.messages[0].id, undefined); assert.equal(options.purpose, undefined);
      assert.deepEqual(options.messages[0], { role: 'user', content: [text(draft().text)] });
      yield { type: 'block-end', index: 0, block: text(SUMMARY) };
      yield { type: 'finish', reason: { kind: 'stop' } };
      drained = true;
    }
  }
  const unregister = llm.registerAdapter([SOURCE.provider], new SyntheticAdapter());
  try {
    const result = await new SummaryGenerator({ llm }).generateResult(draft(), { sessionId: 'synthetic-session' });
    assert.deepEqual(result, { text: SUMMARY, summaryStatus: 'generated', summaryReason: 'OK' });
    assert.equal(drained, true, 'the terminal finish is followed through normal iterator completion');
  } finally { unregister(); }
});

test('reasoning selection skips disabled entries in catalog order and leaves defaults alone when no enabled effort exists', async () => {
  const cases = [
    [['off', 'low', 'medium', 'high'], 'low'],
    [['none', 'minimal', 'low'], 'minimal'],
    [['OFF', 'NONE', 'disabled', 'medium', 'low'], 'medium'],
    [['off', 'none'], undefined],
    [[], undefined],
    [undefined, undefined]
  ];
  for (const [ids, expected] of cases) {
    let proposed, options;
    const llm = goodLLM(value => { options = value; });
    llm.prepareCall = async (config, _signal, configure) => {
      const model = ids === undefined ? {} : { reasoning: { efforts: ids.map(id => ({ id, name: id })), defaultEffort: 'high' } };
      proposed = configure({ maxTokens: config.maxTokens }, model);
      return { config: { ...config, ...proposed }, stream: value => llm.stream(value) };
    };
    assert.equal((await new SummaryGenerator({ llm }).generateResult(draft())).summaryReason, 'OK');
    assert.equal(options.reasoningEffort, expected);
    assert.equal(Object.hasOwn(proposed, 'reasoningEffort'), expected !== undefined);
    assert.equal(options.maxTokens, 300);
  }
});

test('summary diagnostics distinguish operational, terminal and validation failures without retaining raw exceptions', async () => {
  const streamed = (output, finish) => ({ async *stream() {
    if (output !== undefined) yield { type: 'block-end', index: 0, block: text(output) };
    if (finish !== undefined) yield { type: 'finish', reason: { kind: finish, failure: { message: 'DO_NOT_RETAIN_SECRET', code: 'DO_NOT_RETAIN_SECRET' } } };
  } });
  const cases = [
    [streamed(SUMMARY, 'error'), 'MODEL_ERROR'], [streamed(SUMMARY, 'aborted'), 'MODEL_ABORTED'],
    [streamed(SUMMARY, 'max-tokens'), 'MAX_TOKENS'], [streamed(SUMMARY, 'tool-calls'), 'UNEXPECTED_FINISH'],
    [streamed('', 'stop'), 'EMPTY_OUTPUT'], [streamed('Unstructured response', 'stop'), 'INVALID_FORMAT'],
    [streamed(SUMMARY, undefined), 'NO_FINISH'],
    [{ async *stream() { throw Object.assign(new Error('DO_NOT_RETAIN_SECRET'), { code: 'DO_NOT_RETAIN_SECRET' }); } }, 'STREAM_FAILED'],
    [{ ...goodLLM(), prepareCall: async () => { throw new Error('DO_NOT_RETAIN_SECRET'); } }, 'PREPARE_FAILED'],
    [{ ...goodLLM(), prepareCall: async () => { throw Object.assign(new Error('DO_NOT_RETAIN_SECRET'), { code: 'INVALID_PREPARED_CALL' }); } }, 'INVALID_PREPARED_CALL']
  ];
  for (const [llm, reason] of cases) {
    const result = await new SummaryGenerator({ llm }).generateResult(draft());
    assert.equal(result.summaryStatus, 'fallback'); assert.equal(result.summaryReason, reason);
    assert.match(result.text, /^状态：本轮已结束（摘要暂不可用）\n回复摘录：/);
    assert.doesNotMatch(JSON.stringify(result), /DO_NOT_RETAIN_SECRET|Unstructured response/);
  }
  const decorated = '```text\n- **已完成：**实现摘要。\n- **未完成：**未部署。\n- **需你处理：**确认接收方。\n```';
  assert.equal((await new SummaryGenerator({ llm: streamed(decorated, 'stop') }).generateResult(draft())).text, SUMMARY);
  const missingModel = await new SummaryGenerator({ llm: goodLLM() }).generateResult(draft('visible', null));
  assert.equal(missingModel.summaryReason, 'NO_MODEL');
  assert.equal((await new SummaryGenerator().generateResult(draft())).summaryReason, 'NO_LLM');
  assert.equal((await new SummaryGenerator().generateResult(draft(''))).summaryReason, 'NO_TEXT');
});

test('terminal failure details expose only allowlisted classes, HTTP status and fixed hints in recent metadata', async () => {
  const cases = [
    [{ code: 'INVALID_REQUEST', status: 400, message: '400 Invalid max_output_tokens: must be at least 4096; PRIVATE_CREDENTIAL' }, { summaryFailureClass: 'INVALID_REQUEST', summaryHttpStatus: 400, summaryFailureHint: 'OUTPUT_TOKEN_PARAMETER' }],
    [{ code: 'PI_AI_ERROR', message: 'Unsupported parameter: reasoning_effort PRIVATE_CREDENTIAL' }, { summaryFailureClass: 'PI_AI_ERROR', summaryFailureHint: 'REASONING_PARAMETER' }],
    [{ code: 'PI_AI_ERROR', message: 'stream disconnected before completion: stream closed before response.completed PRIVATE_CREDENTIAL' }, { summaryFailureClass: 'PI_AI_ERROR', summaryFailureHint: 'STREAM_DISCONNECTED' }],
    [{ code: 'PI_AI_ERROR', message: '400 Unsupported parameter: temperature PRIVATE_CREDENTIAL' }, { summaryFailureClass: 'PI_AI_ERROR', summaryHttpStatus: 400, summaryFailureHint: 'UNSUPPORTED_PARAMETER' }],
    [{ code: 'PRIVATE_CREDENTIAL', status: 401, message: 'PRIVATE_CREDENTIAL' }, { summaryFailureClass: 'AUTH', summaryHttpStatus: 401 }],
    [{ code: 'AUTH', status: 3.5, message: 'PRIVATE_CREDENTIAL' }, { summaryFailureClass: 'AUTH' }],
    [{ code: 'PRIVATE_CREDENTIAL', status: 999, message: 'key PRIVATE_CREDENTIAL contains 400 digits' }, { summaryFailureClass: 'OTHER' }],
    [{ code: 'SERVER', status: '503', message: 'PRIVATE_CREDENTIAL' }, { summaryFailureClass: 'SERVER' }]
  ];
  for (const [failure, expected] of cases) {
    const llm = { async *stream() { yield { type: 'finish', reason: { kind: 'error', failure: { ...failure, requestId: 'PRIVATE_CREDENTIAL', request: { secret: 'PRIVATE_CREDENTIAL' } } } }; } };
    const { service, sent } = fixture({ llm });
    const result = await service.notify(completion(session('diagnostic'), 1));
    assert.equal(result.summaryReason, 'MODEL_ERROR'); assert.equal(result.summaryStatus, 'fallback');
    assert.deepEqual(Object.fromEntries(Object.entries(result).filter(([key]) => ['summaryFailureClass', 'summaryHttpStatus', 'summaryFailureHint'].includes(key))), expected);
    assert.equal(sent[0], 'ℹ️ ' + draft().text);
    assert.doesNotMatch(JSON.stringify((await service.status()).results), /PRIVATE_CREDENTIAL|max_output_tokens|reasoning_effort|response\.completed/);
    assert.doesNotMatch(sent[0], /MODEL_ERROR|INVALID_REQUEST|PI_AI_ERROR|OUTPUT_TOKEN|状态：|回复摘录/);
    await service.dispose();
  }
});

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
  const result = await service.notify(completion(session('structured-fallback'), 1, draft(SUMMARY)));
  assert.equal(result.summaryReason, 'NO_LLM'); assert.equal(sent[0], PHONE_SUMMARY);
  // Redact whole secrets before shortening: the line boundary deliberately cuts inside this value.
  await service.manual(session('redact-boundary'), 1, { message: '已完成：' + '甲'.repeat(28) + 'synthetic-secret' }, { callId: 'boundary' });
  assert.doesNotMatch(sent.at(-1), /synthetic|synt/); assert.match(sent.at(-1), /\*\*\*/);
  await service.dispose();
});

test('summary timeout bounds even an uncooperative stream or prepareCall and aborts it', async () => {
  for (const hangPreparation of [false, true]) {
    let signal;
    const llm = { stream(options) { signal = options.signal; return { [Symbol.asyncIterator]() { return { next: () => new Promise(() => {}) }; } }; } };
    if (hangPreparation) llm.prepareCall = (_config, supplied) => { signal = supplied; return new Promise(() => {}); };
    const generator = new SummaryGenerator({ llm, timeoutMs: 10 });
    const result = await generator.generateResult(draft());
    assert.match(result.text, /^状态：本轮已结束（摘要暂不可用）\n回复摘录：/);
    assert.equal(result.summaryStatus, 'fallback'); assert.equal(result.summaryReason, 'TIMEOUT');
    assert.equal(signal.aborted, true); assert.equal(generator.controllers.size, 0);
  }
});

test('disabled, quiet hours, child sessions and missing configuration do not call the LLM', async () => {
  let calls = 0;
  const cases = [
    [Object.assign(cfg(), { enabled: false }), session('disabled'), 'DISABLED'],
    [Object.assign(cfg(), { quietHours: { ...cfg().quietHours, enabled: true, start: '00:00', end: '00:00' } }), session('quiet'), 'QUIET_HOURS'],
    [cfg(), { id: 'child', header: { origin: 'subagent' } }, 'SUBAGENT'],
    [Object.assign(cfg(), { appId: '' }), session('unconfigured'), 'NOT_CONFIGURED']
  ];
  for (const [config, s, code] of cases) {
    const { service } = fixture({ config, llm: goodLLM(() => calls++) });
    const result = await service.notify({ kind: 'completed', key: code, sessionId: s.id, session: s, turn: 1, title: '本轮结束', summary: draft() });
    assert.equal(result.code, code);
    const manual = await service.manual(s, 2, { message: '已完成：工作收尾。' }, { callId: 'manual-' + code });
    assert.equal(manual.code, code);
    await service.dispose();
  }
  assert.equal(calls, 0);
});

test('LLM input and sent previews redact saved secrets and tokens, without truncating bodies at 500', async () => {
  let input;
  const { service, sent } = fixture({ llm: goodLLM(options => { input = options.messages[0].content[0].text; }) });
  service.client.sensitive.add('synthetic-token');
  await service.notify(completion(session('redaction'), 1, draft('synthetic-secret Bearer synthetic-token and synthetic-token ' + 'x'.repeat(900))));
  assert.doesNotMatch(input, /synthetic-secret|synthetic-token/);
  assert.match(input, /\*\*\*/);
  const manual = await service.manual(session('manual'), 2, { message: 'x'.repeat(1000) + 'synthetic-secret synthetic-token' }, { callId: 'long' });
  assert.equal(manual.status, 'success'); assert.ok(Array.from(sent.at(-1)).length <= 35);
  const status = await service.status(); assert.ok(Array.from(status.results[0].message).length <= 35);
  assert.equal(service.client.redact('x'.repeat(1000), 2400).length, 1000, 'the explicit redact limit remains independent of phone formatting');
  assert.doesNotMatch(JSON.stringify(status), /synthetic-secret|synthetic-token/);
  assert.equal(service.client.redact('e'.repeat(800)).length, 500);
  await service.dispose();
});

test('only successful manual send suppresses same-turn completed, never errors/interruption, another session or next turn', async () => {
  let calls = 0;
  const { service, sent } = fixture({ llm: goodLLM(() => calls++) });
  const s = session('s1');
  assert.equal((await service.manual(s, 1, { message: SUMMARY }, { callId: 'manual-1' })).status, 'success');
  assert.equal((await service.notify(completion(s, 1))).code, 'MANUAL_SENT'); assert.equal(calls, 0);
  assert.equal((await service.notify(completion(s, 2))).status, 'success'); assert.equal(calls, 1);
  assert.equal((await service.notify(completion(session('s2'), 1))).status, 'success'); assert.equal(calls, 2);
  for (const [turn, kind] of [[3, 'error'], [4, 'aborted']]) {
    await service.manual(s, turn, { message: SUMMARY + turn }, { callId: 'manual-' + turn });
    const notification = { ...completion(s, turn, draft(), kind), reason: 'synthetic concrete reason' };
    assert.equal((await service.notify(notification)).status, 'success');
    assert.match(sent.at(-1), /synthetic concrete reason/); assert.match(sent.at(-1), /^❌ /);
    assert.doesNotMatch(sent.at(-1), /回复摘录|状态：/);
  }
  assert.equal(calls, 2); await service.dispose();
});

test('manual success during an automatic summary wait suppresses the pending completed send', async t => {
  let began, release;
  const started = new Promise(resolve => { began = resolve; });
  const proceed = new Promise(resolve => { release = resolve; });
  const llm = { async *stream() {
    began(); await proceed;
    yield { type: 'text-delta', index: 0, text: SUMMARY };
    yield { type: 'finish', reason: { kind: 'stop' } };
  } };
  const { service, sent } = fixture({ llm });
  t.after(() => service.dispose());
  const s = session('manual-during-summary');
  const pendingCompleted = service.notify(completion(s, 1));
  await started;
  const manual = await service.manual(s, 1, { message: SUMMARY }, { callId: 'concurrent-manual' });
  assert.equal(manual.status, 'success'); assert.equal(sent.length, 1);
  release();
  const completed = await pendingCompleted;
  assert.equal(completed.status, 'skipped'); assert.equal(completed.code, 'MANUAL_SENT');
  assert.equal(sent.length, 1, 'the delayed automatic summary must not send a second message');
});

test('manual failure, skip and cancellation never suppress automatic fallback; duplicate call/content reserve for 60 seconds', async () => {
  let fail = true, calls = 0, now = 1000;
  const { service } = fixture({ now: () => now, send: async () => { calls++; if (fail) throw new NotifyError('synthetic failure', 'SYNTHETIC'); return 'sent'; } });
  const s = session('s1');
  assert.equal((await service.manual(s, 1, { message: SUMMARY }, { callId: 'same' })).status, 'failed');
  fail = false;
  assert.equal((await service.notify(completion(s, 1))).status, 'success');
  assert.equal((await service.manual(s, 2, { message: 'different' }, { callId: 'same' })).code, 'DUPLICATE');
  assert.equal((await service.manual(s, 2, { message: SUMMARY }, { callId: 'new' })).code, 'DUPLICATE');
  assert.equal((await service.notify(completion(s, 2))).status, 'success');
  now += 60001;
  assert.equal((await service.manual(s, 3, { message: SUMMARY }, { callId: 'new' })).status, 'success');
  assert.equal(calls, 4);
  const abort = new AbortController(); abort.abort();
  assert.equal((await service.manual(s, 4, { message: 'cancelled' }, { callId: 'cancelled', signal: abort.signal })).code, 'CANCELLED');
  assert.equal((await service.notify(completion(s, 4))).status, 'success');
  await service.configure({ enabled: false });
  assert.equal((await service.manual(s, 5, { message: 'disabled' }, { callId: 'disabled' })).code, 'DISABLED');
  await service.configure({ enabled: true });
  assert.equal((await service.notify(completion(s, 5))).status, 'success');
  assert.equal((await service.manual(undefined, undefined, { message: 'manual' })).code, 'NO_AGENT_SESSION');
  assert.equal((await service.manual(s, undefined, { message: 'manual' })).code, 'NO_CURRENT_TURN');
  assert.equal((await service.manual({ id: 'child', header: { delegationDepth: 1 } }, 1, { message: SUMMARY })).code, 'SUBAGENT');
  await service.dispose();
});

test('unload/cancel aborts all LLM work promptly, and never sends a fallback after dispose', async () => {
  let signal, started;
  const began = new Promise(resolve => { started = resolve; });
  const llm = { stream(options) { signal = options.signal; started(); return { [Symbol.asyncIterator]() { return { next: () => new Promise(() => {}) }; } }; } };
  const { service, sent } = fixture({ llm });
  const pending = service.notify(completion(session('dispose'), 1));
  await began;
  await service.dispose();
  assert.equal(signal.aborted, true); assert.equal((await pending).status, 'failed');
  assert.equal(service.pending.size, 0); assert.equal(sent.length, 0);
});

test('failure/timeout still sends an excerpt, while approval delivery never waits for a summary', async () => {
  for (const hang of [false, true]) {
    let began;
    const started = new Promise(resolve => { began = resolve; });
    const llm = { stream() {
      began();
      if (!hang) throw new Error('synthetic LLM failure');
      return { [Symbol.asyncIterator]() { return { next: () => new Promise(() => {}) }; } };
    } };
    const { service, sent } = fixture({ llm, summaryTimeoutMs: 10 });
    const s = session('automatic-' + hang);
    const completionJob = service.notify(completion(s, 1));
    await started;
    const approval = await service.notify({ kind: 'approval', key: s.id + ':approval', sessionId: s.id, title: '工具权限待确认', detail: 'bash' });
    assert.equal(approval.status, 'success');
    assert.match(sent[0], /工具权限待确认/);
    const result = await completionJob;
    assert.equal(result.status, 'success'); assert.equal(result.summaryStatus, 'fallback');
    assert.equal(result.summaryReason, hang ? 'TIMEOUT' : 'STREAM_FAILED');
    assert.equal(sent[1], 'ℹ️ ' + draft().text); assert.match(sent[1], /尚未部署/);
    assert.doesNotMatch(JSON.stringify((await service.status()).results), /synthetic LLM failure/);
    await service.dispose();
  }
});

test('external cancellation during a hanging summary exits without sending the fallback', async () => {
  let began;
  const started = new Promise(resolve => { began = resolve; });
  const llm = { stream() { began(); return { [Symbol.asyncIterator]() { return { next: () => new Promise(() => {}) }; } }; } };
  const { service, sent } = fixture({ llm });
  const controller = new AbortController();
  const pending = service.notify(completion(session('cancel-summary'), 1), { signal: controller.signal });
  await started; controller.abort();
  assert.equal((await pending).code, 'CANCELLED'); assert.equal(sent.length, 0);
  assert.equal(service.pending.size, 0); await service.dispose();
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
});

test('real Cordis projection contract checkpoints/replays host-only bounded state, and plugin tool uses postcommit turn identity', async t => {
  const dir = await mkdtemp(join(tmpdir(), 'feishu-notify-test-'));
  t.after(async () => { const target = resolve(dir); assert.ok(basename(target).startsWith('feishu-notify-test-')); await rm(target, { recursive: true }); });
  const ctx = new Context();
  const projections = new SessionProjectionRegistry(ctx);
  const sessions = new SessionStore(ctx);
  const tools = new Map();
  ctx.provide('profileContext', { name: 'synthetic', dir });
  ctx.provide('tools', { register(tool) { tools.set(tool.name, tool); } });
  let llmCalls = 0;
  ctx.provide('llm', goodLLM(() => { llmCalls++; throw new Error('cannot create effect on inactive context'); }));
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
  assert.equal(checkpoint[SUMMARY_KEY].ver, summaryProjection.stateVersion);
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
  assert.equal(turnSummary(checkpointState, 1).manualSent, true, 'tail receipt resolves the pending call from the checkpoint');
  assert.equal(turnSummary(checkpointState, 1).text, 'final visible');
  assert.equal(turnSummary(checkpointState, 2).manualSent, false);
  assert.deepEqual(checkpointState, restored.checkpoint[SUMMARY_KEY].val);
  service.now = () => Date.now() + 61000;
  s.append('tool/call', { turn: 1, step: 2, name: 'notify_user', callId: 'restored-repeat', arguments: '{}' });
  const duplicate = await tool.execute({ message: '不同的内容也不重复' }, { agent: { session: s }, callId: 'restored-repeat' });
  assert.equal(duplicate.code, 'MANUAL_SENT'); assert.equal(sent.length, 1, 'durable success survives the in-memory reset and 60 second expiry');
  s.append('turn/end', { turn: 2, reason: { kind: 'completed' } });
  await Promise.allSettled([...service.pending]);
  assert.equal(sent.length, 1);
  s.append('turn/start', { turn: 3 });
  s.append('assistant/message', { turn: 3, step: 1, message: createAssistantMessage({ content: [text('本轮完成摘要实现，未部署。')], source: SOURCE }), stream: [] }, { surfaceOp: 'append' });
  s.append('turn/end', { turn: 3, reason: { kind: 'completed' } });
  ctx.emit('agent/error', { agent: { session: s }, turn: 3, error: new Error('cannot create effect on inactive context') });
  await Promise.allSettled([...service.pending]);
  assert.equal(sent.length, 1); assert.equal(llmCalls, 0); assert.equal(service.summaries.llm, undefined);
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
