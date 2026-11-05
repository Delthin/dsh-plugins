import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { getGlobalDispatcher } from 'undici';
import { apply, Config } from './index.js';

const collect = async iterable => {
  const values = [];
  for await (const value of iterable) values.push(value);
  return values;
};

async function fixture(t, config, records = new Map()) {
  const hooks = new Map();
  const disposers = [];
  const inspected = [];
  let command, endpoint;
  let closed = false;
  const ctx = {
    storageDomain: { async open(options) {
      assert.equal(options.name, 'dsh_fast');
      assert.equal(options.version, 1);
      assert.deepEqual(options.tables.sessions.valueSchema.parse({ fast: true }), { fast: true });
      return { table: () => ({ get: id => records.get(id), put: async (id, value) => records.set(id, value) }), close() { closed = true; } };
    } },
    effect(effect) { disposers.push(effect()); },
    on(event, handler) { hooks.set(event, handler); },
    commands: { register(value) { command = value; return () => {}; } },
    sessionController: { async inspect(id) { inspected.push(id); } },
    connection: {
      admit: () => ({ peer: { principal: { kind: 'owner' } } }),
      fetch: { register(value) { endpoint = value; return () => {}; } },
    },
  };
  await apply(ctx, config);
  t.after(async () => { for (const dispose of disposers.reverse()) await dispose?.(); assert.equal(closed, true); });
  const response = body => endpoint.fetch(new Request('http://localhost/api/fast', { method: 'POST', body: JSON.stringify(body) }));
  return {
    ctx, records, inspected, response,
    stream: (sessionId, provider, next) => hooks.get('llm/stream')({ sessionId, provider }, next),
    command: (rawInput, id = 'ordinary') => command.handler({ agent: { id }, rawInput }),
    async api(body) {
      const result = await response(body);
      assert.equal(result.status, 200);
      assert.equal(result.headers.get('cache-control'), 'no-store');
      return result.json();
    },
  };
}

const complete = { provider: 'responses-provider', sourceURL: 'https://responses.example.invalid/v1/responses', targetURL: 'https://priority.example.invalid/backend-api/codex/responses' };

test('empty public schema has no personal routes and leaves role snapshots optional', () => {
  assert.deepEqual(Config({}), { provider: '', sourceURL: '', targetURL: '' });
});

test('absent or partial routes refuse enabling at both entry points without touching standard streams or dispatcher', async t => {
  for (const config of [undefined, {}, { provider: complete.provider }, { provider: complete.provider, sourceURL: complete.sourceURL }, { sourceURL: complete.sourceURL, targetURL: complete.targetURL }]) {
    await t.test(JSON.stringify(config) ?? 'no config', async t => {
      const before = getGlobalDispatcher();
      const f = await fixture(t, config);
      assert.equal(getGlobalDispatcher(), before);
      let calls = 0;
      const chunk = Object.freeze({ type: 'synthetic-chunk' });
      const next = async function* () { calls++; yield chunk; };
      assert.deepEqual(await collect(f.stream('ordinary', complete.provider, next)), [chunk]);
      assert.deepEqual(await f.api({ sessionId: 'ordinary', action: 'get' }), { fast: false, locked: false, source: 'session', configured: false, provider: '' });
      for (const action of ['on', 'toggle', '']) {
        const result = await f.command(action);
        assert.equal(result.kind, 'error');
        assert.match(result.text, /Fast 通道未配置/);
      }
      const denied = await f.response({ sessionId: 'ordinary', action: 'set', fast: true });
      assert.equal(denied.status, 400);
      assert.match((await denied.json()).error, /Fast 通道未配置/);
      assert.equal(f.records.has('ordinary'), false, 'refused enable must not persist Fast');
      assert.equal((await f.api({ sessionId: 'ordinary', action: 'set', fast: false })).configured, false);
      assert.equal((await f.command('off')).kind, 'success');
      assert.match((await f.command('status')).text, /Fast 尚未配置/);
      assert.deepEqual(await collect(f.stream('ordinary', 'any-provider', next)), [chunk]);
      assert.equal(calls, 2);
    });
  }
});

test('persisted Fast without a route fails before downstream work and concurrent toggles only turn it off', async t => {
  const f = await fixture(t, {}, new Map([['ordinary', { fast: true }]]));
  let calls = 0;
  await assert.rejects(collect(f.stream('ordinary', complete.provider, async function* () { calls++; })), /Fast 通道未配置/);
  assert.equal(calls, 0);
  await Promise.all([f.command('toggle'), f.command('toggle')]);
  assert.equal(f.records.get('ordinary').fast, false);
  assert.equal((await f.command('on')).kind, 'error');
  assert.equal((await f.response({ sessionId: 'ordinary', action: 'set', fast: 'toggle' })).status, 400);
  assert.equal((await f.api({ sessionId: 'ordinary', action: 'set', fast: false })).fast, false);
});

test('configured normalized route restricts Fast provider while preserving standard provider selection', async t => {
  const f = await fixture(t, { ...complete, provider: ' responses-provider ', sourceURL: ` ${complete.sourceURL} `, targetURL: ` ${complete.targetURL} ` });
  const next = async function* () { yield 'adapter reply'; };
  assert.deepEqual(await collect(f.stream('ordinary', 'another-provider', next)), ['adapter reply']);
  const initial = await f.api({ sessionId: 'ordinary', action: 'get' });
  assert.equal(initial.provider, complete.provider);
  assert.equal(initial.configured, true);
  assert.equal((await f.api({ sessionId: 'ordinary', action: 'set', fast: true })).configured, true);
  await assert.rejects(collect(f.stream('ordinary', 'another-provider', next)), /尚未配置供应商/);
  assert.deepEqual(await collect(f.stream('ordinary', complete.provider, next)), ['adapter reply']);
});

test('API requires owner admission and validates old Session inspect API before mutations', async t => {
  const f = await fixture(t);
  f.ctx.connection.admit = () => ({ rejection: { status: 403 } });
  assert.equal((await f.response({ sessionId: 'ordinary', action: 'set', fast: false })).status, 403);
  f.ctx.connection.admit = () => ({ peer: { principal: { kind: 'guest' } } });
  assert.equal((await f.response({ sessionId: 'ordinary', action: 'get' })).status, 403);
  f.ctx.connection.admit = () => ({ peer: { principal: { kind: 'owner' } } });
  for (const sessionId of ['', 1, 'x'.repeat(201)]) {
    assert.equal((await f.response({ sessionId, action: 'get' })).status, 400);
  }
  assert.deepEqual(f.inspected, []);
  await f.api({ sessionId: 'ordinary', action: 'set', fast: false });
  assert.deepEqual(f.inspected, ['ordinary']);
  f.ctx.sessionController.inspect = async () => { throw new Error('session/not-found'); };
  assert.equal((await f.response({ sessionId: 'missing', action: 'set', fast: false })).status, 400);
  assert.equal(f.records.has('missing'), false);
});

test('new Session state API validates without resuming and propagates missing-session errors', async t => {
  const f = await fixture(t);
  delete f.ctx.sessionController.inspect;
  const calls = [];
  f.ctx.sessionController.state = async (request, signal) => {
    calls.push(request.sessionId);
    assert.ok(signal instanceof AbortSignal);
    if (request.sessionId === 'missing') throw new Error('session/not-found');
    return { active: false, running: false };
  };
  assert.equal((await f.response({ sessionId: 'existing', action: 'get' })).status, 200);
  const missing = await f.response({ sessionId: 'missing', action: 'set', fast: false });
  assert.equal(missing.status, 400);
  assert.equal((await missing.json()).error, 'session/not-found');
  assert.deepEqual(calls, ['existing', 'missing']);
  assert.equal(f.records.has('missing'), false);
});

test('role snapshots remain immutable and old snapshots default to Standard', async t => {
  const dir = await mkdtemp(join(tmpdir(), 'dsh-fast-index-'));
  t.after(async () => { await rm(dir, { recursive: true }); });
  const roleRunsPath = join(dir, 'runs.json');
  await writeFile(roleRunsPath, JSON.stringify({ items: [{ sessionId: 'old', role: { fast: true } }, { sessionId: 'fast', selection: { fast: true } }] }));
  const f = await fixture(t, { roleRunsPath });
  for (const [sessionId, fast] of [['old', false], ['fast', true]]) {
    const result = await f.api({ sessionId, action: 'get' });
    assert.deepEqual([result.fast, result.locked, result.source], [fast, true, 'role']);
    assert.match((await f.command('off', sessionId)).text, /角色档位固定/);
  }
  assert.equal((await f.api({ sessionId: 'ordinary', action: 'get' })).locked, false);
});

test('configured loopback route preserves Standard, forwards authenticated priority and reports delivery', async t => {
  const seen = [];
  const server = createServer(async (req, res) => {
    const chunks = []; for await (const chunk of req) chunks.push(chunk);
    seen.push({ path: req.url, headers: req.headers, body: JSON.parse(Buffer.concat(chunks).toString()) });
    res.setHeader('content-type', 'application/json'); res.end(JSON.stringify({ path: req.url }));
  });
  server.listen(0, '127.0.0.1'); await once(server, 'listening');
  t.after(async () => { server.closeAllConnections(); await new Promise(done => server.close(done)); });
  const origin = `http://127.0.0.1:${server.address().port}`;
  const f = await fixture(t, { provider: complete.provider, sourceURL: `${origin}/v1/responses`, targetURL: `${origin}/backend-api/codex/responses` });
  const next = async function* () {
    const response = await fetch(`${origin}/v1/responses`, { method: 'POST', headers: { authorization: 'Bearer synthetic-only', 'content-type': 'application/json' }, body: JSON.stringify({ input: 'synthetic prompt', model: 'synthetic-model', service_tier: 'default' }) });
    yield await response.json();
  };
  assert.deepEqual(await collect(f.stream('ordinary', complete.provider, next)), [{ path: '/v1/responses' }]);
  await f.api({ sessionId: 'ordinary', action: 'set', fast: true });
  assert.deepEqual(await collect(f.stream('ordinary', complete.provider, next)), [{ path: '/backend-api/codex/responses' }]);
  assert.equal(seen[0].body.service_tier, 'default');
  assert.equal(seen[1].body.service_tier, 'priority');
  assert.equal(seen[1].headers.authorization, 'Bearer synthetic-only');
  const receipt = (await f.api({ sessionId: 'ordinary', action: 'get' })).lastDelivery;
  assert.equal(receipt.serviceTier, 'priority');
  assert.equal(receipt.sessionId, 'ordinary');
  assert.equal(receipt.count, 1);
  assert.equal(JSON.stringify(receipt).includes('synthetic-only'), false);
  assert.equal(JSON.stringify(receipt).includes('synthetic prompt'), false);
  await assert.rejects(collect(f.stream('ordinary', 'another-provider', next)), /尚未配置供应商/);
  assert.equal(seen.length, 2);
  assert.equal((await f.command('off')).kind, 'success');
  assert.deepEqual(await collect(f.stream('ordinary', complete.provider, next)), [{ path: '/v1/responses' }]);
});
