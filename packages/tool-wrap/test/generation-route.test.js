import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { Readable } from 'node:stream';
import { enabledConfig, fixturePlugin, fixtureTool, hostFixture } from './fixture.js';

const model = { provider: 'route-fixture-provider', model: 'route-fixture-model' };
const plugin = 'dsh-ego-browser';
const valid = { plugin, model };
const draft = '这是一条仅供设置页面编辑的插件简介草稿。';
const completed = async function* () {
  yield { type: 'text-delta', index: 0, text: draft };
  yield { type: 'finish', reason: { kind: 'stop' } };
};

async function routeFixture(t, { prepare, stream } = {}) {
  const config = enabledConfig({ descriptions: { [plugin]: 'Persisted user overview' } });
  const host = await hostFixture(t, { config });
  const preparations = [];
  const streams = [];
  host.ctx.provide('agentDefaultModel', { currentSelection: () => model });
  host.ctx.provide('llm', {
    async prepareCall(config, signal) {
      preparations.push({ config, signal });
      if (prepare) return prepare(config, signal);
      return {
        config,
        stream(options) {
          streams.push(options);
          return stream ? stream(options) : completed();
        },
      };
    },
    listModels() { assert.fail('generation route must not list models'); },
    fetch() { assert.fail('generation route must not fetch models'); },
  });
  const handler = host.routes.get('/api/tool-discovery/generate');
  assert.equal(typeof handler, 'function');
  const start = ({ method = 'POST', value = valid, headers = {}, chunks } = {}) => {
    const body = chunks ?? [typeof value === 'string' ? value : JSON.stringify(value)];
    const req = Readable.from(body);
    req.method = method;
    req.headers = { 'content-type': 'application/json', ...headers };
    const res = new EventEmitter();
    Object.assign(res, {
      statusCode: 0, headers: {}, destroyed: false, endCalls: 0,
      setHeader(key, value) { this.headers[key] = value; },
      end(body) { this.endCalls++; this.body = JSON.parse(body); },
    });
    return { req, res, pending: handler(req, res) };
  };
  const request = async options => {
    const call = start(options);
    await call.pending;
    assert.equal(call.req.listenerCount('aborted'), 0);
    assert.equal(call.res.listenerCount('close'), 0);
    return call.res;
  };
  const path = join(host.dir, 'tool-discovery.json');
  const persisted = await readFile(path, 'utf8');
  let changes = 0;
  host.ctx.on('system-prompt/change', () => { changes++; });
  const unchanged = async () => {
    assert.equal(await readFile(path, 'utf8'), persisted);
    assert.equal(changes, 0);
  };
  return { ...host, config, preparations, streams, start, generate: request, unchanged };
}

function responseStatus(res, status) {
  assert.equal(res.statusCode, status, JSON.stringify(res.body));
  assert.equal(res.endCalls, 1);
  assert.equal(res.headers['Content-Type'], 'application/json; charset=utf-8');
  assert.equal(res.headers['Cache-Control'], 'no-store');
  assert.equal(res.headers['X-Content-Type-Options'], 'nosniff');
}

test('generation HTTP route authenticates before reading, and rejects methods, content types, bytes and malformed fields before model calls', async t => {
  const host = await routeFixture(t);
  let reads = 0;
  const unread = async function* () { reads++; yield '{'; };
  responseStatus(await host.generate({ headers: { 'x-fixture-reject': 'yes' }, chunks: unread() }), 403);
  assert.equal(reads, 0, 'rejected caller body must remain unread');
  for (const method of ['GET', 'PUT', 'DELETE']) responseStatus(await host.generate({ method }), 405);
  for (const contentType of ['text/plain', 'application/jsonp', 'application/json-extra']) {
    responseStatus(await host.generate({ headers: { 'content-type': contentType } }), 415);
  }
  responseStatus(await host.generate({ value: '中'.repeat(21846) }), 413);
  responseStatus(await host.generate({ value: '{' }), 400);
  for (const value of [null, [], { ...valid, unexpected: true }, { plugin }, { ...valid, model: { ...model, model: 'not-the-default' } }, { ...valid, model: { ...model, provider: 'not-the-provider' } }]) {
    responseStatus(await host.generate({ value }), 400);
  }
  responseStatus(await host.generate({ value: { ...valid, plugin: 'dsh-ego' } }), 404);
  assert.deepEqual(host.preparations, []);
  assert.deepEqual(host.streams, []);
  await host.unchanged();
  responseStatus(await host.generate(), 200);
  await host.unchanged();
});

test('generation HTTP success uses only exact global plugin descriptions, never schemas, and returns an unsaved draft', async t => {
  const host = await routeFixture(t);
  const owner = host.agent('private-generation-owner');
  await fixturePlugin(owner.ctx, plugin, [fixtureTool('private_generation_tool', { description: 'PRIVATE_SCOPED_TOOL_DESCRIPTION' })]);
  const initial = await host.request();
  assert.deepEqual(initial.body.generation.models, [{ ...model, label: `${model.provider} / ${model.model}` }]);
  assert.deepEqual(host.preparations, [], 'status must not prepare a model call');
  let schemaReads = 0;
  const restorations = [];
  // Both the requested pack and unrelated plugins contain poisoned schemas.
  // The generation route is required to read only registration names/descriptions.
  for (const name of ['ego_visit', 'generate_image']) {
    const definition = host.tools.get(name);
    for (const [object, key] of [[definition, 'parameters'], [definition.output, 'schema']]) {
      const descriptor = Object.getOwnPropertyDescriptor(object, key);
      restorations.push(() => Object.defineProperty(object, key, descriptor));
      Object.defineProperty(object, key, { configurable: true, get() { schemaReads++; throw new Error('PRIVATE_SCHEMA_MUST_NOT_BE_READ'); } });
    }
  }
  let res;
  try { res = await host.generate(); }
  finally { for (const restore of restorations.reverse()) restore(); }
  responseStatus(res, 200);
  assert.deepEqual(res.body, { description: draft });
  assert.equal(schemaReads, 0);
  assert.equal(host.preparations.length, 1);
  assert.deepEqual(host.preparations[0].config, { ...model, maxTokens: 500 });
  assert.equal(host.streams.length, 1);
  const options = host.streams[0];
  const input = JSON.parse(options.messages[0].content[0].text);
  assert.equal(input.plugin, plugin);
  assert.deepEqual(input.tools.map(tool => tool.name).sort(), ['ego_capture', 'ego_secret', 'ego_visit']);
  assert.ok(input.tools.every(tool => Object.keys(tool).sort().join(',') === 'description,name'));
  assert.equal(input.tools.find(tool => tool.name === 'ego_visit').description, 'Browser visit webpage 浏览器访问网页。Original usage: preserve login and approval rules.');
  assert.doesNotMatch(JSON.stringify(options), /generate_image|schedule_list|virtual_echo|private_generation_tool|PRIVATE_SCOPED_TOOL_DESCRIPTION|PRIVATE_SCHEMA|Persisted user overview/);
  assert.equal(options.signal.aborted, false);
  assert.deepEqual(host.calls, []);
  await host.unchanged();
  assert.deepEqual((await host.request()).body.config, host.config);
});

test('generation HTTP model failures are sanitized and release the profile lock for the next draft', async t => {
  let attempts = 0;
  const host = await routeFixture(t, { prepare(config) {
    if (++attempts === 1) throw new Error('PRIVATE_PROVIDER_ERROR token=secret');
    return { config, stream: completed };
  } });
  const failed = await host.generate();
  responseStatus(failed, 502);
  assert.doesNotMatch(JSON.stringify(failed.body), /PRIVATE_PROVIDER_ERROR|token=secret|stack/);
  await host.unchanged();
  const recovered = await host.generate();
  responseStatus(recovered, 200);
  assert.deepEqual(recovered.body, { description: draft });
  assert.equal(host.preparations.length, 2);
  await host.unchanged();
});

test('generation HTTP concurrent requests receive 429, request abort cancels preparation and releases the lock', { timeout: 5000 }, async t => {
  const entered = Promise.withResolvers();
  const release = Promise.withResolvers();
  let attempts = 0;
  const host = await routeFixture(t, { async prepare(config, signal) {
    if (++attempts === 1) { entered.resolve(signal); await release.promise; }
    return { config, stream: completed };
  } });
  const first = host.start();
  const signal = await entered.promise;
  responseStatus(await host.generate(), 429);
  assert.equal(host.preparations.length, 1, 'busy request must not prepare another model');
  // The host auth/method gates still take precedence while a generation is busy.
  responseStatus(await host.generate({ headers: { 'x-fixture-reject': 'yes' } }), 403);
  responseStatus(await host.generate({ method: 'GET' }), 405);
  const independent = await routeFixture(t);
  responseStatus(await independent.generate(), 200);
  first.req.emit('aborted');
  await first.pending;
  responseStatus(first.res, 499);
  assert.equal(signal.aborted, true);
  assert.equal(first.req.listenerCount('aborted'), 0);
  assert.equal(first.res.listenerCount('close'), 0);
  assert.doesNotMatch(JSON.stringify(first.res.body), /PRIVATE_|stack/);
  release.resolve();
  responseStatus(await host.generate(), 200);
  assert.equal(host.preparations.length, 2);
  await host.unchanged();
  await independent.unchanged();
});

test('generation HTTP response disconnect cancels a stalled stream without responding, cleans listeners and allows retry', { timeout: 5000 }, async t => {
  const entered = Promise.withResolvers();
  const stalled = Promise.withResolvers();
  let attempts = 0;
  let returns = 0;
  const host = await routeFixture(t, { stream(options) {
    if (++attempts !== 1) return completed();
    return { [Symbol.asyncIterator]() { return {
      next() { entered.resolve(options.signal); return stalled.promise; },
      return() { returns++; return Promise.resolve({ done: true }); },
    }; } };
  } });
  const first = host.start();
  const signal = await entered.promise;
  first.res.destroyed = true;
  first.res.emit('close');
  await first.pending;
  assert.equal(signal.aborted, true);
  assert.equal(first.res.endCalls, 0, 'disconnected response must not receive an error body');
  assert.equal(returns, 1, 'the stalled stream must receive iterator cleanup');
  assert.equal(first.req.listenerCount('aborted'), 0);
  assert.equal(first.res.listenerCount('close'), 0);
  stalled.resolve({ done: true });
  responseStatus(await host.generate(), 200);
  assert.equal(host.preparations.length, 2);
  await host.unchanged();
});
