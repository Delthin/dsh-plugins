import { AsyncLocalStorage } from 'node:async_hooks'
import { randomBytes, timingSafeEqual } from 'node:crypto'
import { createServer } from 'node:http'
import { Readable } from 'node:stream'
import { pipeline } from 'node:stream/promises'
import { createRequire } from 'node:module'
import { resolve } from 'node:path'
import { httpEndpoint } from './config.js'

// undici 8 initializes .2 and replaces .1 on first import. Resolve metadata before
// loading executable code; this host/billion chain speaks the public 7.x API.
// Installed bundles should depend on 7.x. The profile fallback also supports
// workspace-authored bundles whose enclosing workspace happens to use 8.x.
function loadCompatibleUndici() {
  const resolvers = [createRequire(import.meta.url)]
  if (process.env.DSH_PROFILE_DIR) resolvers.push(createRequire(resolve(process.env.DSH_PROFILE_DIR, 'package.json')))
  for (const require of resolvers) {
    let version
    try { version = require('undici/package.json').version } catch (error) {
      if (error.code === 'MODULE_NOT_FOUND') continue
      throw error
    }
    if (version.startsWith('7.')) return require('undici')
  }
  throw new Error('Fast transport requires undici 7.x compatible with the host dispatcher; undici 8 was not imported')
}
const { fetch: upstreamFetch, getGlobalDispatcher, setGlobalDispatcher } = loadCompatibleUndici()

const scope = new AsyncLocalStorage()
const owners = new WeakMap()
const TOKEN_HEADER = 'x-dsh-fast-proxy-token'
const TIER_HEADER = 'x-service-tier'
const CONTEXT_HEADER = 'x-dsh-fast-context'
const MAX_BODY_BYTES = 64 * 1024 * 1024
const HOP_HEADERS = new Set([
  'connection', 'keep-alive', 'proxy-authenticate', 'proxy-authorization',
  'te', 'trailer', 'transfer-encoding', 'upgrade', 'proxy-connection',
])

function headersOf(input) {
  const headers = new Headers()
  if (Array.isArray(input) && (input.length === 0 || !Array.isArray(input[0]))) {
    for (let i = 0; i < input.length; i += 2) headers.append(String(input[i]), String(input[i + 1]))
  } else if (input && typeof input[Symbol.iterator] === 'function') {
    for (const [name, value] of input) headers.append(name, String(value))
  } else {
    for (const [name, value] of Object.entries(input ?? {})) {
      if (value === undefined) continue
      for (const item of Array.isArray(value) ? value : [value]) headers.append(name, String(item))
    }
  }
  return headers
}

function forwardingHeaders(input) {
  const headers = headersOf(input)
  const connectionHeaders = (headers.get('connection') ?? '').split(',').map(name => name.trim().toLowerCase())
  for (const name of [...HOP_HEADERS, ...connectionHeaders, 'host', 'content-length', TOKEN_HEADER, TIER_HEADER, CONTEXT_HEADER]) {
    if (name) headers.delete(name)
  }
  return headers
}

// Adapt only the Responses wire envelope. Tools, images and reasoning remain the
// original adapter's payload; credentials are never resolved again here.
function codexBody(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw new TypeError('Expected JSON object')
  const result = { ...body }
  let input = body.input
  const instructions = []
  if (Array.isArray(input)) {
    let firstUser = 0
    while (firstUser < input.length && ['system', 'developer'].includes(input[firstUser]?.role)) {
      const content = input[firstUser].content
      if (typeof content === 'string') instructions.push(content)
      else if (Array.isArray(content)) {
        for (const part of content) if (typeof part.text === 'string') instructions.push(part.text)
      }
      firstUser++
    }
    input = input.slice(firstUser)
  } else if (typeof input === 'string') {
    input = [{ role: 'user', content: [{ type: 'input_text', text: input }] }]
  }
  result.input = input
  result.instructions = body.instructions || instructions.join('\n\n') || 'You are a helpful assistant.'
  result.store = false
  result.stream = true
  result.service_tier = 'priority'
  result.text = { verbosity: 'low', ...body.text }
  result.include = [...new Set([...(body.include ?? []), 'reasoning.encrypted_content'])]
  result.tool_choice ??= 'auto'
  result.parallel_tool_calls ??= true
  delete result.max_output_tokens
  delete result.prompt_cache_retention
  delete result.prompt_cache_options
  return result
}

function respond(res, status, message) {
  res.writeHead(status, { 'content-type': 'application/json' })
  res.end(JSON.stringify({ error: { message } }))
}

/**
 * Install a scoped transport without replacing fetch or the llm adapter.
 * Endpoint overrides are construction-time values (primarily for loopback tests),
 * never taken from request headers or bodies. Only wrap() enables Fast routing.
 */
export async function createFastTransport({
  sourceURL,
  targetURL,
  onForward,
} = {}) {
  if (onForward !== undefined && typeof onForward !== 'function') throw new TypeError('onForward must be a function')
  const source = httpEndpoint(sourceURL)
  const target = httpEndpoint(targetURL)
  const original = getGlobalDispatcher()
  const token = randomBytes(32).toString('hex')
  const tokenBytes = Buffer.from(token)
  const state = { closed: false, previous: original }
  const active = new Set()
  const sockets = new Set()
  const server = createServer(async (req, res) => {
    const provided = req.headers[TOKEN_HEADER]
    const providedBytes = typeof provided === 'string' ? Buffer.from(provided) : null
    if (!providedBytes || providedBytes.length !== tokenBytes.length ||
        !timingSafeEqual(providedBytes, tokenBytes)) {
      req.resume()
      respond(res, 401, 'Unauthorized Fast proxy request')
      return
    }
    if (state.closed || req.method !== 'POST' || req.url !== '/responses' || req.headers[TIER_HEADER] !== 'priority') {
      req.resume()
      respond(res, 404, 'Unknown Fast proxy route')
      return
    }
    const controller = new AbortController()
    active.add(controller)
    const abort = () => controller.abort()
    req.once('aborted', abort)
    res.once('close', () => { if (!res.writableFinished) abort() })
    try {
      const chunks = []
      let size = 0
      for await (const chunk of req) {
        size += chunk.length
        if (size > MAX_BODY_BYTES) {
          respond(res, 413, 'Fast request body is too large')
          return
        }
        chunks.push(chunk)
      }
      let body
      let payload
      try {
        payload = codexBody(JSON.parse(Buffer.concat(chunks).toString('utf8')))
        body = JSON.stringify(payload)
      } catch {
        respond(res, 400, 'Invalid Fast Responses JSON body')
        return
      }
      const headers = forwardingHeaders(req.headers)
      headers.set('content-type', 'application/json')
      headers.set('accept-encoding', 'identity')
      if (onForward) {
        let sessionId
        try {
          const context = JSON.parse(Buffer.from(req.headers[CONTEXT_HEADER] ?? '', 'base64url').toString('utf8'))
          if (typeof context.sessionId === 'string') sessionId = context.sessionId
        } catch { /* Direct authenticated loopback calls need not carry metadata. */ }
        const event = Object.freeze({
          sourceURL: source.origin + source.pathname,
          targetURL: target.origin + target.pathname,
          model: typeof payload.model === 'string' ? payload.model : undefined,
          serviceTier: 'priority', sessionId,
        })
        // Observers cannot change transport behavior or surface credentials via errors.
        try { Promise.resolve(onForward(event)).catch(() => {}) } catch {}
      }
      // billion has already compressed the body and forwarded its private controls
      // here. Only now build/send Codex, using the original dispatcher, not its
      // global fetch wrapper; the fixed target can never be supplied by a client.
      const response = await scope.run(undefined, () => upstreamFetch(target, {
        method: 'POST', headers, body, signal: controller.signal,
        dispatcher: original, redirect: 'manual',
      }))
      const responseHeaders = forwardingHeaders(response.headers)
      // Fetch decompresses responses; their original encoding/length no longer apply.
      responseHeaders.delete('content-encoding')
      res.writeHead(response.status, Object.fromEntries(responseHeaders))
      res.flushHeaders()
      if (response.body) await pipeline(Readable.fromWeb(response.body), res, { signal: controller.signal })
      else res.end()
    } catch {
      if (!res.destroyed) {
        if (res.headersSent) res.destroy()
        else respond(res, 502, 'Fast upstream request failed')
      }
    } finally {
      controller.abort()
      active.delete(controller)
      req.off('aborted', abort)
    }
  })
  server.on('connection', socket => {
    sockets.add(socket)
    socket.once('close', () => sockets.delete(socket))
  })
  await new Promise((resolve, reject) => {
    server.once('error', reject)
    server.listen(0, '127.0.0.1', () => {
      server.off('error', reject)
      resolve()
    })
  })
  server.unref()
  const localOrigin = `http://127.0.0.1:${server.address().port}`
  const interceptor = dispatch => function dispatchFast(options, handler) {
    const context = scope.getStore()
    if (state.closed || context?.owner !== state || options.method !== 'POST' ||
        (options.query && Object.keys(options.query).length > 0)) {
      return dispatch(options, handler)
    }
    let origin = localOrigin
    let path = '/responses'
    if (String(options.origin) !== source.origin || options.path !== source.pathname + source.search) {
      let bili
      try { bili = new URL(String(options.origin)) } catch { return dispatch(options, handler) }
      // Only numeric HTTP loopback origins and the exact billion embedded source
      // URL qualify. Preserve billion as the first hop, changing only its embedded
      // destination to our authenticated proxy. ALS need not cross that process.
      if (bili.protocol !== 'http:' || !['127.0.0.1', '[::1]'].includes(bili.hostname) ||
          !bili.port || bili.username || bili.password || bili.search || bili.hash ||
          bili.pathname !== '/' || options.path !== '/bili/' + source.href) {
        return dispatch(options, handler)
      }
      origin = options.origin
      path = '/bili/' + localOrigin + '/responses'
    }
    const headers = headersOf(options.headers)
    headers.delete('host')
    headers.set(TIER_HEADER, 'priority')
    headers.set(TOKEN_HEADER, token)
    headers.set(CONTEXT_HEADER, Buffer.from(JSON.stringify({ sessionId: context.sessionId })).toString('base64url'))
    return dispatch({ ...options, origin, path, headers: [...headers].flat() }, handler)
  }
  // The 7.x compose helper wraps legacy handlers even on passthrough. Compose the
  // same interceptor directly so standard options AND handlers remain untouched.
  const dispatchFast = interceptor(original.dispatch.bind(original))
  const installed = new Proxy(original, {
    get(target, key) { return key === 'dispatch' ? dispatchFast : Reflect.get(target, key, target) },
  })
  owners.set(installed, state)
  try {
    setGlobalDispatcher(installed)
  } catch (error) {
    await new Promise(resolve => server.close(resolve))
    throw error
  }

  let closing
  return {
    wrap(next, metadata = {}) {
      if (typeof next !== 'function') throw new TypeError('Fast wrap requires an iterator factory')
      const context = { owner: state, sessionId: typeof metadata?.sessionId === 'string' ? metadata.sessionId : undefined }
      return {
        [Symbol.asyncIterator]() {
          if (state.closed) throw new Error('Fast transport is closed')
          // next() may start eager work before the iterator's first next().
          const iterator = scope.run(context, () => {
            const iterable = next()
            return iterable[Symbol.asyncIterator]?.() ?? iterable[Symbol.iterator]?.() ?? iterable
          })
          const invoke = (method, value) => scope.run(context, () => {
            if (method === 'return' && !iterator.return) return Promise.resolve({ done: true, value })
            if (method === 'throw' && !iterator.throw) return Promise.reject(value)
            return Promise.resolve(iterator[method](value))
          })
          return {
            next: value => invoke('next', value),
            return: value => invoke('return', value),
            throw: error => invoke('throw', error),
            [Symbol.asyncIterator]() { return this },
          }
        },
      }
    },
    close() {
      if (closing) return closing
      state.closed = true
      // Do not overwrite a dispatcher installed later by another owner.
      if (getGlobalDispatcher() === installed) {
        let previous = original
        while (owners.get(previous)?.closed) previous = owners.get(previous).previous
        setGlobalDispatcher(previous)
      }
      for (const controller of active) controller.abort()
      closing = new Promise((resolve, reject) => {
        server.close(error => error ? reject(error) : resolve())
        for (const socket of sockets) socket.destroy()
      })
      return closing
    },
  }
}
