import assert from 'node:assert/strict'
import { once } from 'node:events'
import { createServer, request as httpRequest } from 'node:http'
import { test } from 'node:test'
import { createRequire } from 'node:module'
import { resolve } from 'node:path'
import { spawnSync } from 'node:child_process'
import { createFastTransport } from './transport.js'

const localRequire = createRequire(import.meta.url)
const compatibleRequire = localRequire('undici/package.json').version.startsWith('7.')
  ? localRequire
  : createRequire(resolve(process.env.DSH_PROFILE_DIR, 'package.json'))
const { Agent, getGlobalDispatcher, setGlobalDispatcher } = compatibleRequire('undici')

const deferred = () => {
  let resolve
  const promise = new Promise(done => { resolve = done })
  return { promise, resolve }
}
const collect = async iterable => {
  const result = []
  for await (const value of iterable) result.push(value)
  return result
}
const jsonBody = async req => {
  const chunks = []
  for await (const chunk of req) chunks.push(chunk)
  return JSON.parse(Buffer.concat(chunks).toString())
}

async function fixture(t, handle, transportOptions = {}) {
  const before = getGlobalDispatcher()
  const agent = new Agent()
  const dispatches = []
  const observer = agent.compose(dispatch => function observe(options, handler) {
    dispatches.push(options)
    return dispatch(options, handler)
  })
  setGlobalDispatcher(observer)
  const server = createServer((req, res) => {
    Promise.resolve(handle(req, res)).catch(() => res.destroy())
  })
  server.listen(0, '127.0.0.1')
  await once(server, 'listening')
  const origin = `http://127.0.0.1:${server.address().port}`
  const transport = await createFastTransport({
    sourceURL: `${origin}/v1/responses`, targetURL: `${origin}/backend-api/codex/responses`,
    ...transportOptions,
  })
  t.after(async () => {
    await transport.close()
    setGlobalDispatcher(before)
    await agent.destroy()
    server.closeAllConnections()
    await new Promise(resolve => server.close(resolve))
  })
  const post = (path = '/v1/responses', body = { input: 'hello' }, options = {}) => fetch(`${origin}${path}`, {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body), ...options,
  })
  return { transport, post, origin, dispatches, observer, agent }
}

function localRequest(url, headers, body = '{}', path = '/responses') {
  return new Promise((resolve, reject) => {
    const wireHeaders = { ...headers, 'content-length': Buffer.byteLength(body) }
    delete wireHeaders['transfer-encoding']
    const req = httpRequest(`${url}${path}`, { method: 'POST', headers: wireHeaders }, res => {
      const chunks = []
      res.on('data', chunk => chunks.push(chunk))
      res.on('end', () => resolve({ status: res.statusCode, body: Buffer.concat(chunks).toString() }))
    })
    req.on('error', reject)
    req.end(body)
  })
}

function routingOf(dispatches) {
  const local = dispatches.find(options => options.path === '/responses')
  assert.ok(local, 'Fast dispatched to the local proxy')
  return { origin: String(local.origin), headers: Object.fromEntries(new Headers(chunkPairs(local.headers))) }
}
function chunkPairs(headers) {
  if (!Array.isArray(headers) || Array.isArray(headers[0])) return headers
  const pairs = []
  for (let i = 0; i < headers.length; i += 2) pairs.push([headers[i], headers[i + 1]])
  return pairs
}

test('transport has no default endpoints and rejects incomplete configuration without installing a dispatcher', async () => {
  const before = getGlobalDispatcher()
  await assert.rejects(createFastTransport(), /valid HTTP\(S\) endpoint/)
  await assert.rejects(createFastTransport({ sourceURL: 'https://responses.example.invalid/v1/responses' }), /valid HTTP\(S\) endpoint/)
  assert.equal(getGlobalDispatcher(), before)
})

test('first transport import preserves an existing legacy dispatcher without initializing undici 8', () => {
  const entry = new URL('./transport.js', import.meta.url).href
  const script = `
    import assert from 'node:assert/strict';
    const one = Symbol.for('undici.globalDispatcher.1');
    const two = Symbol.for('undici.globalDispatcher.2');
    const calls = [];
    const original = { dispatch(options, handler) { calls.push([options, handler]); return true; } };
    Object.defineProperty(globalThis, one, { value: original, writable: true, configurable: false });
    assert.equal(globalThis[two], undefined);
    const { createFastTransport } = await import(${JSON.stringify(entry)});
    assert.equal(globalThis[one], original, 'import must not overwrite the host dispatcher');
    assert.equal(globalThis[two], undefined, 'undici 8 must not be initialized');
    const transport = await createFastTransport({ sourceURL: 'https://responses.example.invalid/v1/responses', targetURL: 'https://priority.example.invalid/backend-api/codex/responses' });
    const options = { origin: 'https://responses.example.invalid', path: '/v1/responses', method: 'POST', headers: { test: 'unchanged' } };
    const handler = {};
    globalThis[one].dispatch(options, handler);
    assert.equal(calls[0][0], options);
    assert.equal(calls[0][1], handler);
    assert.equal(globalThis[two], globalThis[one], '7.x publishes the same unwrapped dispatcher to both public API versions');
    await transport.close();
    assert.equal(globalThis[one], original);
  `
  const result = spawnSync(process.execPath, ['--input-type=module', '--eval', script], { env: process.env, encoding: 'utf8', timeout: 10000 })
  assert.equal(result.status, 0, result.stderr || result.error?.message)
})

test('billion rewritten requests keep compression first and build Codex only after its HTTP forwarding', async t => {
  const upstream = []
  const events = []
  const biliSeen = []
  const nativeFetch = globalThis.fetch
  const f = await fixture(t, async (req, res) => {
    upstream.push({ path: req.url, headers: req.headers, body: await jsonBody(req) })
    res.setHeader('content-type', 'text/event-stream')
    res.end('data: {"type":"response.completed"}\n\n')
  }, { onForward: event => events.push(event) })
  const bili = createServer(async (req, res) => {
    try {
      const body = await jsonBody(req)
      biliSeen.push({ path: req.url, headers: req.headers, body: structuredClone(body) })
      // Real billion prepareResponses rebuilds the envelope and deletes instructions.
      delete body.instructions
      body.input[1].content[0].text = 'compressed by billion'
      const headers = { ...req.headers }
      delete headers.host
      delete headers['content-length']
      const response = await nativeFetch(req.url.slice('/bili/'.length), { method: 'POST', headers, body: JSON.stringify(body) })
      res.writeHead(response.status, { 'content-type': response.headers.get('content-type') })
      res.end(Buffer.from(await response.arrayBuffer()))
    } catch { res.destroy() }
  })
  bili.listen(0, '127.0.0.1')
  await once(bili, 'listening')
  t.after(async () => { bili.closeAllConnections(); await new Promise(resolve => bili.close(resolve)) })
  const biliOrigin = `http://127.0.0.1:${bili.address().port}`
  const body = {
    model: 'local-model', instructions: 'billion removes this',
    input: [{ role: 'developer', content: [{ type: 'input_text', text: 'system survives in transcript' }] }, { role: 'user', content: [{ type: 'input_text', text: 'original' }] }],
    tools: [{ type: 'function', name: 'read', parameters: { type: 'object' } }],
    reasoning: { effort: 'high' }, service_tier: 'default',
  }
  // This is the actual shape produced by billion's global fetch rewrite. Its
  // separate HTTP server must preserve controls; it does not inherit Fast ALS.
  const postViaBili = () => nativeFetch(`${biliOrigin}/bili/${f.origin}/v1/responses`, {
    method: 'POST', headers: { 'content-type': 'application/json', authorization: 'Bearer synthetic-only', 'x-bili-plugin-conversation': 'bili-session' }, body: JSON.stringify(body),
  })
  await (await postViaBili()).text()
  await collect(f.transport.wrap(async function* () { yield await (await postViaBili()).text() }, { sessionId: 'host-session' }))
  assert.equal(biliSeen.length, 2)
  assert.equal(biliSeen[0].path, `/bili/${f.origin}/v1/responses`)
  assert.match(biliSeen[1].path, /^\/bili\/http:\/\/127\.0\.0\.1:\d+\/responses$/)
  assert.equal(biliSeen[0].headers['x-dsh-fast-proxy-token'], undefined)
  assert.equal(biliSeen[1].headers['x-service-tier'], 'priority')
  assert.equal(biliSeen[1].body.service_tier, 'default', 'Codex mapping must not run before billion')
  assert.equal(upstream[0].path, '/v1/responses')
  assert.equal(upstream[0].body.service_tier, 'default')
  assert.equal(upstream[1].path, '/backend-api/codex/responses')
  assert.equal(upstream[1].body.service_tier, 'priority')
  assert.equal(upstream[1].body.instructions, 'system survives in transcript')
  assert.equal(upstream[1].body.input[0].content[0].text, 'compressed by billion')
  assert.deepEqual(upstream[1].body.tools, body.tools)
  assert.deepEqual(upstream[1].body.reasoning, body.reasoning)
  assert.equal(upstream[1].headers.authorization, 'Bearer synthetic-only')
  assert.equal(upstream[1].headers['x-bili-plugin-conversation'], 'bili-session')
  for (const name of ['x-service-tier', 'x-dsh-fast-proxy-token', 'x-dsh-fast-context']) assert.equal(upstream[1].headers[name], undefined)
  assert.deepEqual(events, [{ sessionId: 'host-session', sourceURL: `${f.origin}/v1/responses`, targetURL: `${f.origin}/backend-api/codex/responses`, model: 'local-model', serviceTier: 'priority' }])
  assert.ok(Object.isFrozen(events[0]))
})

test('onForward is isolated from observer errors and never includes arbitrary metadata or body', async t => {
  const events = []
  const f = await fixture(t, async (req, res) => {
    assert.equal(events.length, 1, 'observer runs before upstream receives the request')
    await jsonBody(req)
    res.end('{}')
  }, { onForward: event => { events.push(event); return Promise.reject(new Error('observer error')) } })
  await collect(f.transport.wrap(async function* () { yield await (await f.post('/v1/responses', { input: 'private body', model: 'model' })).text() }, { sessionId: 'session', authorization: 'must not leak', body: 'must not leak' }))
  assert.deepEqual(Object.keys(events[0]).sort(), ['model', 'serviceTier', 'sessionId', 'sourceURL', 'targetURL'].sort())
  assert.equal(JSON.stringify(events).includes('private body'), false)
  assert.equal(JSON.stringify(events).includes('must not leak'), false)
})

test('Fast and standard requests stay isolated under concurrency; unrelated URLs and methods pass through', async t => {
  const seen = []
  const f = await fixture(t, async (req, res) => {
    const body = req.method === 'POST' ? await jsonBody(req) : undefined
    seen.push({ path: req.url, headers: req.headers, body })
    res.setHeader('content-type', 'application/json')
    res.end(JSON.stringify({ path: req.url, body }))
  })
  const requests = Array.from({ length: 24 }, (_, index) => {
    const body = { input: `message-${index}`, service_tier: 'default' }
    if (index % 2 === 0) return collect(f.transport.wrap(async function* () {
      await Promise.resolve()
      yield await (await f.post('/v1/responses', body)).json()
    })).then(values => values[0])
    return f.post('/v1/responses', body).then(response => response.json())
  })
  const result = await Promise.all(requests)
  for (let index = 0; index < result.length; index++) {
    assert.equal(result[index].path, index % 2 === 0 ? '/backend-api/codex/responses' : '/v1/responses')
    assert.equal(result[index].body.service_tier, index % 2 === 0 ? 'priority' : 'default')
  }
  await collect(f.transport.wrap(async function* () {
    yield await (await f.post('/other')).text()
    yield await (await fetch(`${f.origin}/v1/responses`)).text()
    yield await (await f.post('/v1/responses?different=1')).text()
  }))
  assert.equal(seen.filter(item => item.path === '/backend-api/codex/responses').length, 12)
  for (const request of seen.filter(item => item.path !== '/backend-api/codex/responses')) {
    assert.equal(request.headers['x-service-tier'], undefined)
    assert.equal(request.headers['x-dsh-fast-proxy-token'], undefined)
  }
})

test('standard dispatch retains the identical options and handler objects', async t => {
  const before = getGlobalDispatcher()
  const received = []
  const original = { dispatch(options, handler) { received.push([options, handler]); return true } }
  setGlobalDispatcher(original)
  const transport = await createFastTransport({ sourceURL: 'https://responses.example.invalid/v1/responses', targetURL: 'https://priority.example.invalid/backend-api/codex/responses' })
  t.after(async () => { await transport.close(); setGlobalDispatcher(before) })
  const options = { origin: 'https://responses.example.invalid', path: '/v1/responses', method: 'POST', headers: { custom: 'unchanged' }, body: 'unchanged', extra: Symbol() }
  const handler = {}
  assert.equal(getGlobalDispatcher().dispatch(options, handler), true)
  assert.equal(received[0][0], options)
  assert.equal(received[0][1], handler)
  await collect(transport.wrap(function* () {
    const unrelated = { ...options, path: '/other' }
    getGlobalDispatcher().dispatch(unrelated, handler)
    assert.equal(received[1][0], unrelated)
    yield null
  }))
})

test('iterator creation, next, return and detached eager work all run in the Fast scope', async t => {
  const paths = []
  const f = await fixture(t, async (req, res) => {
    await jsonBody(req)
    paths.push(req.url)
    res.end('{}')
  })
  let eager
  const iterable = f.transport.wrap(() => {
    eager = Promise.resolve().then(() => f.post()).then(res => res.text())
    return {
      async next() { await (await f.post()).text(); return { value: 'first', done: false } },
      async return(value) { await (await f.post()).text(); return { value, done: true } },
      [Symbol.asyncIterator]() { return this },
    }
  })
  const iterator = iterable[Symbol.asyncIterator]()
  assert.deepEqual(await iterator.next(), { value: 'first', done: false })
  assert.deepEqual(await iterator.return('stopped'), { value: 'stopped', done: true })
  await eager
  assert.deepEqual(paths, Array(3).fill('/backend-api/codex/responses'))
  await (await f.post()).text()
  assert.equal(paths.at(-1), '/v1/responses')
})

test('Codex envelope preserves tools, images, reasoning, auth and billion session headers; SSE streams incrementally', async t => {
  const release = deferred()
  t.after(() => release.resolve())
  let received
  const chunks = [
    'event: response.output_item.added\ndata: {"type":"response.output_item.added","item":{"type":"function_call","name":"read","call_id":"c1"}}\n\n',
    'data: {"type":"response.function_call_arguments.delta","delta":"{\\\"path\\\":\\\"x\\\"}"}\n\n',
    'data: {"type":"response.completed","response":{"output":[]}}\n\n',
  ]
  const f = await fixture(t, async (req, res) => {
    received = { headers: req.headers, body: await jsonBody(req) }
    res.writeHead(200, { 'content-type': 'text/event-stream', 'x-bili-pf-seq': '42', 'connection': 'keep-alive, x-hop-response', 'x-hop-response': 'remove-me' })
    res.write(chunks[0])
    await release.promise
    res.write(chunks[1])
    res.end(chunks[2])
  })
  const input = [
    { role: 'developer', content: [{ type: 'input_text', text: 'Follow system rules' }] },
    { role: 'user', content: [{ type: 'input_image', image_url: 'data:image/png;base64,bG9jYWw=' }, { type: 'input_text', text: 'read' }] },
    { type: 'reasoning', id: 'r1', encrypted_content: 'opaque', summary: [] },
    { type: 'function_call', call_id: 'c0', name: 'read', arguments: '{"path":"a"}' },
    { type: 'function_call_output', call_id: 'c0', output: 'original tool result' },
  ]
  const tools = [{ type: 'function', name: 'read', strict: true, parameters: { type: 'object', properties: { path: { type: 'string' } }, required: ['path'], additionalProperties: false } }]
  const reasoning = { effort: 'high', summary: 'detailed' }
  const values = await collect(f.transport.wrap(async function* () {
    const response = await f.post('/v1/responses', { model: 'test-model', input, tools, reasoning, max_output_tokens: 123, prompt_cache_retention: '24h', prompt_cache_options: { ttl: '30m' }, prompt_cache_key: 'conversation', store: true }, {
      headers: { 'content-type': 'application/json', authorization: 'Bearer synthetic-test-only', 'x-bili-plugin-conversation': 'session-a', 'x-bili-pf-count': '4', 'proxy-authorization': 'local-control' },
    })
    assert.equal(response.headers.get('x-bili-pf-seq'), '42')
    assert.equal(response.headers.get('x-hop-response'), null)
    const reader = response.body.getReader()
    const first = await reader.read()
    assert.equal(new TextDecoder().decode(first.value), chunks[0])
    release.resolve()
    let text = new TextDecoder().decode(first.value)
    while (true) {
      const next = await reader.read()
      if (next.done) break
      text += new TextDecoder().decode(next.value)
    }
    yield text
  }))
  assert.equal(values[0], chunks.join(''))
  assert.equal(received.headers.authorization, 'Bearer synthetic-test-only')
  assert.equal(received.headers['x-bili-plugin-conversation'], 'session-a')
  assert.equal(received.headers['x-bili-pf-count'], '4')
  for (const name of ['x-dsh-fast-proxy-token', 'x-service-tier', 'proxy-authorization']) assert.equal(received.headers[name], undefined)
  assert.deepEqual(received.body.input, input.slice(1))
  assert.deepEqual(received.body.tools, tools)
  assert.deepEqual(received.body.reasoning, reasoning)
  assert.equal(received.body.instructions, 'Follow system rules')
  assert.equal(received.body.service_tier, 'priority')
  assert.equal(received.body.store, false)
  assert.equal(received.body.stream, true)
  assert.equal(received.body.prompt_cache_key, 'conversation')
  assert.deepEqual(received.body.include, ['reasoning.encrypted_content'])
  for (const name of ['max_output_tokens', 'prompt_cache_retention', 'prompt_cache_options']) assert.equal(received.body[name], undefined)
})

test('proxy authenticates its token, refuses arbitrary routes and removes connection-nominated controls', async t => {
  const seen = []
  const f = await fixture(t, async (req, res) => {
    seen.push({ headers: req.headers, body: await jsonBody(req), path: req.url })
    res.end('{}')
  })
  await collect(f.transport.wrap(async function* () { yield await (await f.post()).text() }))
  const route = routingOf(f.dispatches)
  assert.equal((await localRequest(route.origin, {})).status, 401)
  assert.equal((await localRequest(route.origin, { ...route.headers, 'x-dsh-fast-proxy-token': 'x'.repeat(64) })).status, 401)
  assert.equal((await localRequest(route.origin, { ...route.headers, 'x-dsh-fast-proxy-token': 'é'.repeat(64) })).status, 401)
  assert.equal((await localRequest(route.origin, route.headers, '{}', '/http://evil.invalid')).status, 404)
  assert.equal((await localRequest(route.origin, { ...route.headers, 'x-service-tier': 'default' })).status, 404)
  const headers = { ...route.headers, connection: 'keep-alive, x-local-control', 'x-local-control': 'remove', authorization: 'Bearer unchanged', 'x-bili-plugin-conversation': 'another-session' }
  delete headers['content-length']
  assert.equal((await localRequest(route.origin, headers, '{"input":"second","url":"http://evil.invalid"}')).status, 200)
  assert.equal(seen.length, 2)
  assert.equal(seen[1].path, '/backend-api/codex/responses')
  assert.equal(seen[1].headers['x-local-control'], undefined)
  assert.equal(seen[1].headers.authorization, 'Bearer unchanged')
  assert.equal(seen[1].headers['x-bili-plugin-conversation'], 'another-session')
  assert.equal((await localRequest(route.origin, headers, 'not JSON')).status, 400)
  assert.equal(seen.length, 2)
})

test('abort and reader cancellation close the upstream stream', async t => {
  const opened = [deferred(), deferred()]
  const closed = [deferred(), deferred()]
  let count = 0
  const f = await fixture(t, async (req, res) => {
    await jsonBody(req)
    const index = count++
    res.once('close', closed[index].resolve)
    res.writeHead(200, { 'content-type': 'text/event-stream' })
    res.write('data: first\n\n')
    opened[index].resolve()
  })
  const controller = new AbortController()
  await collect(f.transport.wrap(async function* () {
    const response = await f.post('/v1/responses', { input: 'abort' }, { signal: controller.signal })
    await opened[0].promise
    const reader = response.body.getReader()
    await reader.read()
    controller.abort()
    await assert.rejects(reader.read(), error => error.name === 'AbortError')
    yield null
  }))
  await closed[0].promise
  await collect(f.transport.wrap(async function* () {
    const response = await f.post()
    await opened[1].promise
    const reader = response.body.getReader()
    await reader.read()
    await reader.cancel()
    yield null
  }))
  await closed[1].promise
})

test('abort before upstream response headers cancels the pending upstream request', async t => {
  const opened = deferred()
  const closed = deferred()
  const f = await fixture(t, async (req, res) => {
    res.once('close', closed.resolve)
    await jsonBody(req)
    opened.resolve()
  })
  const controller = new AbortController()
  await collect(f.transport.wrap(async function* () {
    const pending = f.post('/v1/responses', { input: 'pending headers' }, { signal: controller.signal })
    await opened.promise
    controller.abort()
    await assert.rejects(pending, error => error.name === 'AbortError')
    yield null
  }))
  await closed.promise
})

test('upstream HTTP failures are streamed, truncated SSE errors reach the reader, and redirects are not followed', async t => {
  const f = await fixture(t, async (req, res) => {
    const body = await jsonBody(req)
    const input = body.input[0].content[0].text
    if (input === 'http-error') { res.writeHead(429); res.end('quota-test'); return }
    if (input === 'redirect') { res.writeHead(307, { location: `${f.origin}/must-not-follow` }); res.end(); return }
    res.writeHead(200, { 'content-type': 'text/event-stream' })
    res.write('data: partial\n\n')
    setImmediate(() => res.destroy())
  })
  await collect(f.transport.wrap(async function* () {
    const failure = await f.post('/v1/responses', { input: 'http-error' })
    assert.equal(failure.status, 429)
    assert.equal(await failure.text(), 'quota-test')
    const redirect = await f.post('/v1/responses', { input: 'redirect' }, { redirect: 'manual' })
    assert.equal(redirect.status, 307)
    await redirect.text()
    await assert.rejects(async () => { const response = await f.post(); await response.text() })
    yield null
  }))
  assert.equal(f.dispatches.some(options => options.path === '/must-not-follow'), false)
})

test('dispose aborts active requests, is idempotent and leaves a later dispatcher owner intact', async t => {
  const opened = deferred()
  const closed = deferred()
  const f = await fixture(t, async (req, res) => {
    await jsonBody(req)
    res.once('close', closed.resolve)
    res.write('pending')
    opened.resolve()
  })
  const responses = await collect(f.transport.wrap(async function* () { yield await f.post() }))
  await opened.promise
  const later = getGlobalDispatcher().compose(dispatch => function laterOwner(options, handler) { return dispatch(options, handler) })
  setGlobalDispatcher(later)
  const closing = f.transport.close()
  assert.equal(f.transport.close(), closing)
  await closing
  assert.equal(getGlobalDispatcher(), later)
  await assert.rejects(responses[0].text())
  await closed.promise
  assert.throws(() => f.transport.wrap(function* () {})[Symbol.asyncIterator](), /closed/)
  const route = routingOf(f.dispatches)
  await assert.rejects(localRequest(route.origin, route.headers))
})

test('out-of-order Fast owners restore the original dispatcher without closing shared resources', async t => {
  const before = getGlobalDispatcher()
  const first = await createFastTransport({ sourceURL: 'https://responses.example.invalid/v1/responses', targetURL: 'https://priority.example.invalid/backend-api/codex/responses' })
  const second = await createFastTransport({ sourceURL: 'https://responses.example.invalid/v1/responses', targetURL: 'https://priority.example.invalid/backend-api/codex/responses' })
  t.after(async () => { await second.close(); await first.close(); setGlobalDispatcher(before) })
  const installed = getGlobalDispatcher()
  await first.close()
  assert.equal(getGlobalDispatcher(), installed)
  await second.close()
  assert.equal(getGlobalDispatcher(), before)
})

test('a non-writable global fetch forwarding wrapper remains untouched', async t => {
  const f = await fixture(t, async (req, res) => { await jsonBody(req); res.end('{}') })
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'fetch')
  const originalFetch = globalThis.fetch
  let wrapperCalls = 0
  const billionStyleFetch = (...args) => { wrapperCalls++; return originalFetch(...args) }
  Object.defineProperty(globalThis, 'fetch', { ...descriptor, value: billionStyleFetch, writable: false })
  try {
    await collect(f.transport.wrap(async function* () { yield await (await f.post()).text() }))
    assert.equal(globalThis.fetch, billionStyleFetch)
    assert.equal(wrapperCalls, 1, 'upstream bypasses the global fetch wrapper')
  } finally {
    Object.defineProperty(globalThis, 'fetch', descriptor)
  }
})
