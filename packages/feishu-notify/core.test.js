import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, stat, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve, basename } from 'node:path';
import { Readable } from 'node:stream';
import { apply as applyAskUser } from '@deepseek-ai/dsh-tool-ask-user';
import { apply } from './index.js';
import { DEFAULT_CONFIG, ConfigStore, FeishuClient, FeishuNotifyService, eventNotification, questionNotification, inQuietHours, maskConfig, validateConfig } from './core.js';

const config = () => ({ ...structuredClone(DEFAULT_CONFIG), appId: 'cli_test', appSecret: 'synthetic-secret', receive_id: 'ou_test', enabled: true });
const response = (data, status = 200) => new Response(JSON.stringify(data), { status });
const tokenResponse = () => response({ code: 0, tenant_access_token: 'synthetic-token', expire: 7200 });
const session = (header = {}) => ({ id: 's1', header });
const end = (kind = 'completed', turn = 1) => ({ type: 'turn/end', seq: turn, data: { turn, reason: { kind } } });
const approval = (id = 'a') => eventNotification(session(), { type: 'approval/asked', data: { id, toolName: 'bash' } });
const memoryStore = value => ({ load: async () => structuredClone(value), save: async patch => { value = validateConfig(patch, value); return structuredClone(value); } });
async function tempProfile(t) {
  const dir = await mkdtemp(join(tmpdir(), 'feishu-notify-test-'));
  t.after(async () => { const target = resolve(dir); assert.ok(basename(target).startsWith('feishu-notify-test-')); await rm(target, { recursive: true }); });
  return { dir, name: 'test' };
}

test('network failures retry exactly three times after the initial attempt', async () => {
  let calls = 0;
  const client = new FeishuClient({ fetch: async () => { calls++; throw new TypeError('connection refused'); } });
  await assert.rejects(client.getToken(config()), { code: 'NETWORK' });
  assert.equal(calls, 4);
});

test('5xx without a business failure retries four attempts; business failures do not retry', async () => {
  let calls = 0;
  const client = new FeishuClient({ fetch: async () => { calls++; return response({ code: 0 }, 503); } });
  await assert.rejects(client.getToken(config()), { code: 'HTTP_5XX' });
  assert.equal(calls, 4);
  for (const status of [200, 503]) {
    calls = 0;
    const other = new FeishuClient({ fetch: async () => { calls++; return response({ code: 99991663, msg: 'invalid secret' }, status); } });
    await assert.rejects(other.getToken(config()), { code: 'FEISHU_99991663' });
    assert.equal(calls, 1);
  }
});

test('a hanging response body is covered by each attempt timeout', async () => {
  let calls = 0;
  const client = new FeishuClient({ timeoutMs: 10, fetch: async () => { calls++; return { status: 200, ok: true, json: () => new Promise(() => {}) }; } });
  await assert.rejects(client.getToken(config()), { code: 'TIMEOUT' });
  assert.equal(calls, 4);
});

test('token refresh is singleflight, honors expire minus sixty seconds, and clears on credential changes', async () => {
  let calls = 0, now = 100000;
  const client = new FeishuClient({ now: () => now, fetch: async () => { calls++; await Promise.resolve(); return response({ code: 0, tenant_access_token: 'token-' + calls, expire: 61 }); } });
  const [a, b] = await Promise.all([client.getToken(config()), client.getToken(config())]);
  assert.equal(a, b); assert.equal(calls, 1);
  await client.getToken(config()); assert.equal(calls, 1);
  now += 1001; await client.getToken(config()); assert.equal(calls, 2);
  await client.getToken({ ...config(), appSecret: 'new-synthetic-secret' }); assert.equal(calls, 3);
});

test('stale in-flight token cannot replace cache for new credentials', async () => {
  let resolveOld;
  let calls = 0;
  const client = new FeishuClient({ fetch: async () => { calls++; if (calls === 1) return new Promise(resolve => { resolveOld = resolve; }); return response({ code: 0, tenant_access_token: 'new-token', expire: 7200 }); } });
  const old = client.getToken(config());
  const updated = { ...config(), appSecret: 'new-secret' };
  await client.getToken(updated);
  resolveOld(response({ code: 0, tenant_access_token: 'old-token', expire: 7200 })); await old;
  assert.equal(await client.getToken(updated), 'new-token'); assert.equal(calls, 2);
});

test('message retry reuses uuid and automatically selects open_id/chat_id', async () => {
  const sent = []; let messageCalls = 0;
  const client = new FeishuClient({ fetch: async (url, options) => {
    if (url.includes('/auth/')) return tokenResponse();
    sent.push({ url, body: JSON.parse(options.body) }); messageCalls++;
    if (messageCalls === 1) throw new TypeError('network');
    return response({ code: 0, data: { message_id: 'm1' } });
  } });
  await client.send(config(), 'text', 'stable-uuid');
  assert.equal(sent.length, 2); assert.equal(sent[0].body.uuid, sent[1].body.uuid);
  assert.match(sent[0].url, /receive_id_type=open_id/);
  await client.send({ ...config(), receive_id: 'oc_test' }, 'text', 'second');
  assert.match(sent.at(-1).url, /receive_id_type=chat_id/);
});

test('concurrent duplicate events reserve before awaiting and retain reservation while pending', async () => {
  let sent = 0, finish; let now = 0;
  const client = { setCredentials() {}, redact: String, send: async () => { sent++; return new Promise(resolve => { finish = resolve; }); }, dispose() {} };
  const service = new FeishuNotifyService({ profile: { name: 'test', dir: '/unused' }, store: memoryStore(config()), client, now: () => now });
  const notification = approval();
  const first = service.notify(notification);
  await Promise.resolve(); await Promise.resolve();
  now = 61000;
  const duplicate = await service.notify(notification);
  assert.equal(duplicate.code, 'DUPLICATE');
  finish('m'); await first;
  assert.equal(sent, 1);
  now += 60001;
  const next = service.notify(notification); await Promise.resolve(); await Promise.resolve(); finish('m2'); await next;
  assert.equal(sent, 2);
});

test('all four turn endings stay silent; subagents filter immediate reminders and normal forks remain eligible', () => {
  for (const header of [{}, { parentSession: 'parent' }, { origin: 'subagent' }, { delegationDepth: 1 }]) {
    for (const kind of ['completed', 'error', 'aborted', 'interrupted']) assert.equal(eventNotification(session(header), end(kind)), null);
  }
  for (const header of [{ origin: 'subagent' }, { delegationDepth: 1 }]) {
    assert.equal(eventNotification(session(header), { type: 'approval/asked', data: { id: 'a' } }), null);
    assert.equal(questionNotification(session(header), { questions: [] }), null);
  }
  assert.equal(eventNotification(session({ parentSession: 'parent' }), { type: 'approval/asked', data: { id: 'a' } }).kind, 'approval');
});

test('approval audit, durable questions and waterfall requests have stable identities', () => {
  assert.equal(eventNotification(session(), { type: 'approval/asked', data: { id: 'a', toolName: 'bash' } }).kind, 'approval');
  const args = { questions: [{ id: 'q', question: 'Continue?' }] };
  const durable = eventNotification(session(), { type: 'tool/call', data: { name: 'ask_user_question', callId: 'c', arguments: JSON.stringify(args) } });
  const waterfall = questionNotification(session(), { ...args, wait: { callId: 'c' } });
  assert.equal(durable.key, waterfall.key);
  assert.equal(questionNotification(session(), { questions: [{ intent: { kind: 'plan-review', callId: 'p' } }] }).kind, 'plan');
  const nested = eventNotification(session(), { type: 'tool/ptc-dispatch-start', data: { name: 'ask_user_question', subCallId: 'nested', arguments: args } });
  assert.match(nested.key, /nested$/);
});

test('quiet hours cover normal, midnight-crossing and all-day intervals in the configured timezone', () => {
  const c = config(); c.quietHours.enabled = true;
  assert.equal(inQuietHours(c, Date.parse('2026-01-01T15:00:00Z')), true); // 23:00 Shanghai
  assert.equal(inQuietHours(c, Date.parse('2026-01-01T00:00:00Z')), false); // 08:00 end excluded
  c.quietHours.start = '09:00'; c.quietHours.end = '10:00';
  assert.equal(inQuietHours(c, Date.parse('2026-01-01T01:00:00Z')), true);
  c.quietHours.end = '09:00'; assert.equal(inQuietHours(c), true);
});

test('configuration persists atomically with 0600, reloads, preserves mask and rejects invalid writes', async t => {
  const profile = await tempProfile(t);
  const store = new ConfigStore(profile.dir);
  assert.equal((await store.load()).enabled, false);
  await store.save(config());
  assert.equal((await stat(store.path)).mode & 0o777, 0o600);
  await store.save({ enabled: false, appSecret: '***' });
  assert.equal(JSON.parse(await readFile(store.path, 'utf8')).appSecret, config().appSecret);
  assert.equal(maskConfig(await store.load()).appSecret, '***');
  await writeFile(store.path, JSON.stringify({ ...config(), receive_id: 'oc_new' }), { mode: 0o600 });
  assert.equal((await store.load()).receive_id, 'oc_new');
  await assert.rejects(store.save({ receive_id: 'bad' }), { code: 'INVALID_CONFIG' });
  assert.equal((await store.load()).receive_id, 'oc_new');
  await writeFile(store.path, '{broken');
  await assert.rejects(store.save({ enabled: true }), { code: 'CONFIG_READ' });
  assert.equal(await readFile(store.path, 'utf8'), '{broken');
});

test('status/results mask secret and token, keep only twenty rows, and test bypasses disabled/quiet hours', async () => {
  const c = config(); c.enabled = false; c.quietHours = { ...c.quietHours, enabled: true, start: '00:00', end: '00:00' };
  const client = new FeishuClient({ fetch: async url => url.includes('/auth/') ? tokenResponse() : response({ code: 400, msg: 'synthetic-secret synthetic-token' }) });
  const service = new FeishuNotifyService({ profile: { name: 'test', dir: '/unused' }, store: memoryStore(c), client });
  const skipped = await service.notify(approval()); assert.equal(skipped.code, 'DISABLED');
  await assert.rejects(service.test(), { code: 'FEISHU_400' });
  for (let i = 0; i < 25; i++) await service.notify(approval('bounded-' + i));
  const result = await service.status();
  assert.equal(result.results.length, 20);
  assert.equal(result.config.appSecret, '***');
  assert.doesNotMatch(JSON.stringify(result), /synthetic-secret|synthetic-token/);
});

test('disposing aborts in-flight requests without starting retries', async () => {
  let calls = 0;
  const client = new FeishuClient({ fetch: async () => { calls++; return new Promise(() => {}); } });
  const pending = client.getToken(config()); client.dispose();
  await assert.rejects(pending, { code: 'CANCELLED' }); assert.equal(calls, 1);
});

test('host routes are dependency-injected, reject unauthorized requests and match tool/service results', async t => {
  const profile = await tempProfile(t);
  const routes = [], tools = [], disposers = [], events = new Map(), services = new Map();
  let reject = 403;
  const ctx = {
    get: key => key === 'profileContext' ? profile : services.get(key),
    provide: (key, value) => services.set(key, value),
    on: (key, fn, options) => { events.set(key, { fn, options }); },
    effect: factory => { const dispose = factory(); disposers.push(dispose); },
    inject: (keys, fn) => { assert.ok(keys.every(key => ['tools', 'connection', 'webServer', 'sessionProjections', 'systemPrompt'].includes(key)), 'live plugin must not inject llm'); if (keys.every(key => ctx[key])) fn(ctx); },
    tools: { register: tool => { tools.push(tool); } },
    sessionProjections: { register() {}, stateOf: () => undefined },
    webServer: { register: route => { routes.push(route); return () => {}; } },
    connection: { requestRejection: () => reject }
  };
  await apply(ctx);
  t.after(async () => { for (const dispose of disposers.reverse()) await dispose(); });
  assert.deepEqual(routes.map(r => r.path), ['/api/feishu-notify', '/api/feishu-notify/test']);
  assert.equal(events.get('user-questions/request').options.prepend, true);
  const invoke = async (method, body, route = routes[0]) => {
    const req = Readable.from(body === undefined ? [] : [JSON.stringify(body)]); req.method = method; req.url = route.path; req.headers = { 'content-type': 'application/json' };
    let payload; const res = { setHeader() {}, once() {}, off() {}, end(value) { payload = JSON.parse(value); this.writableEnded = true; } };
    await route.handler(req, res); return { status: res.statusCode, payload };
  };
  assert.equal((await invoke('PUT', config())).status, 403);
  reject = undefined;
  const saved = await invoke('PUT', config()); assert.equal(saved.status, 200); assert.equal(saved.payload.config.appSecret, '***');
  const tool = tools[0];
  assert.equal(Object.hasOwn(tool.parameters.properties.config.properties, 'appSecret'), false);
  const toolStatus = await tool.execute({ action: 'status' }, {});
  assert.equal(toolStatus.config.appSecret, '***');
  assert.doesNotMatch(JSON.stringify(toolStatus), /synthetic-secret/);
  await assert.rejects(tool.execute({ action: 'configure', config: { appSecret: 'tool-secret' } }, {}), { code: 'INVALID_ARGS' });
  assert.equal((await services.get('feishuNotify').config()).appSecret, config().appSecret);
  const toolResult = await tool.execute({ action: 'configure', config: { enabled: false } }, {});
  const get = await invoke('GET'); assert.deepEqual(get.payload, toolResult);
  assert.equal((await invoke('PUT', { receive_id: 'wrong' })).status, 400);
  assert.equal((await invoke('DELETE')).status, 405);
  const service = services.get('feishuNotify');
  const s = session(); const agent = { session: s };
  assert.equal(events.has('agent/error'), false, 'internal driver errors must have no notification subscriber');
  service.results = [];
  let automaticSends = 0, automaticSummaries = 0;
  service.client.send = async () => { automaticSends++; return 'unexpected-automatic'; };
  service.summaries.generateResult = async () => { automaticSummaries++; throw new Error('cannot create effect on inactive context'); };
  await service.configure({ enabled: true });
  for (let turn = 1; turn <= 20; turn++) for (const kind of ['completed', 'error', 'aborted', 'interrupted']) {
    const event = end(kind, turn);
    event.data.reason.failure = { message: 'cannot create effect on inactive context' };
    events.get('session/event').fn(s, event);
  }
  await Promise.resolve(); await Promise.allSettled([...service.pending]);
  assert.equal(automaticSends, 0); assert.equal(automaticSummaries, 0);
  assert.equal(service.results.length, 0, 'silent events must not fill recent results either');

  // Exercise the installed legacy tool, not a copy of its argument mapping.
  let legacyTool, sent = 0;
  service.client.send = async () => { sent++; return 'synthetic-message'; };
  await service.configure({ enabled: true });
  applyAskUser({ tools: { register(value) { legacyTool = value; } }, userQuestions: { ask: async request => {
    assert.equal(request.wait, undefined); assert.equal(request.questions[0].multiSelect, true);
    await Promise.resolve(); // Verify identity remains local across concurrent async calls.
    return events.get('user-questions/request').fn(request, async () => ({ answers: [{ id: 'q', selected: ['Yes'] }] }));
  } } });
  const raw = { questions: [{ id: 'q', question: 'Continue?', options: [{ label: 'Yes' }], multi_select: true }] };
  for (const callId of ['legacy-a', 'legacy-b']) events.get('session/event').fn(s, { type: 'tool/call', data: { name: 'ask_user_question', callId, arguments: JSON.stringify(raw) } });
  const answers = await Promise.all(['legacy-a', 'legacy-b'].map(callId => {
    const execution = { name: 'ask_user_question', agent, callId };
    return events.get('tools/execute').fn(execution, () => legacyTool.execute(raw, execution));
  }));
  await Promise.allSettled([...service.pending]);
  assert.equal(sent, 2, 'one send per call despite both durable and legacy waterfall observations');
  assert.deepEqual(answers[0], { answers: [{ id: 'q', selected: ['Yes'] }] });
  // The same text asked outside that tool remains a distinct custom request.
  events.get('user-questions/request').fn({ agent, questions: [{ id: 'q', question: 'Continue?', options: [{ label: 'Yes' }], multiSelect: true }] }, async () => ({ answers: [] }));
  await Promise.allSettled([...service.pending]);
  assert.equal(sent, 3, 'custom non-tool questions are not suppressed by text matching');
});
