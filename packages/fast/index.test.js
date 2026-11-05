import test from 'node:test';
import assert from 'node:assert/strict';
import { apply } from './index.js';

const collect = async iterable => {
  const values = [];
  for await (const value of iterable) values.push(value);
  return values;
};

async function fixture(t, config) {
  const records = new Map();
  const hooks = new Map();
  const disposers = [];
  let command, endpoint;
  let closed = false;
  const ctx = {
    storageDomain: { async open(options) {
      assert.equal(options.name, 'dsh_fast');
      assert.equal(options.version, 1);
      return { table: () => ({ get: id => records.get(id), put: async (id, value) => records.set(id, value) }), close() { closed = true; } };
    } },
    effect(effect) { disposers.push(effect()); },
    on(event, handler) { hooks.set(event, handler); },
    commands: { register(value) { command = value; return () => {}; } },
    sessionController: { async inspect() {} },
    connection: {
      admit: () => ({ peer: { principal: { kind: 'owner' } } }),
      fetch: { register(value) { endpoint = value; return () => {}; } },
    },
  };
  await apply(ctx, config);
  t.after(async () => { for (const dispose of disposers.reverse()) await dispose?.(); assert.equal(closed, true); });
  return {
    stream: (sessionId, provider, next) => hooks.get('llm/stream')({ sessionId, provider }, next),
    command: rawInput => command.handler({ agent: { id: 'ordinary' }, rawInput }),
    async api(body) {
      const response = await endpoint.fetch(new Request('http://localhost/api/fast', { method: 'POST', body: JSON.stringify(body) }));
      assert.equal(response.status, 200);
      return response.json();
    },
  };
}

test('absent or partial Fast configuration keeps standard usable and refuses Fast before downstream work', async t => {
  for (const config of [undefined, {}, { provider: 'responses-provider' }, { provider: 'responses-provider', sourceURL: 'https://responses.example.invalid/v1/responses' }]) {
    await t.test(JSON.stringify(config) ?? 'no config', async t => {
      const f = await fixture(t, config);
      let calls = 0;
      const next = async function* () { calls++; yield 'standard reply'; };
      assert.deepEqual(await collect(f.stream('ordinary', 'responses-provider', next)), ['standard reply']);
      assert.equal((await f.api({ sessionId: 'ordinary', action: 'get' })).provider, '');
      assert.equal((await f.command('on')).kind, 'success');
      await assert.rejects(collect(f.stream('ordinary', 'responses-provider', next)), /Fast 通道未配置/);
      assert.equal(calls, 1, 'refused Fast requests must not run the downstream adapter');
      assert.equal((await f.command('off')).kind, 'success');
      assert.deepEqual(await collect(f.stream('ordinary', 'any-provider', next)), ['standard reply']);
    });
  }
});

test('configured route restricts Fast provider while preserving standard provider selection', async t => {
  const f = await fixture(t, { provider: 'responses-provider', sourceURL: 'https://responses.example.invalid/v1/responses', targetURL: 'https://priority.example.invalid/backend-api/codex/responses' });
  const next = async function* () { yield 'adapter reply'; };
  assert.deepEqual(await collect(f.stream('ordinary', 'another-provider', next)), ['adapter reply']);
  assert.equal((await f.api({ sessionId: 'ordinary', action: 'get' })).provider, 'responses-provider');
  await f.api({ sessionId: 'ordinary', action: 'set', fast: true });
  await assert.rejects(collect(f.stream('ordinary', 'another-provider', next)), /尚未配置供应商/);
  assert.deepEqual(await collect(f.stream('ordinary', 'responses-provider', next)), ['adapter reply']);
});
