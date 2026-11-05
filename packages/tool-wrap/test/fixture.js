import assert from 'node:assert/strict';
import { mkdtemp, realpath, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, dirname, basename } from 'node:path';
import { Readable } from 'node:stream';
import { Context } from '@deepseek-ai/cordis';
import { SystemPrompt } from '@deepseek-ai/dsh-system-prompt';
import { ToolRuntime, defineTool } from '@deepseek-ai/dsh-tools';
import { PtcExecutor } from '@deepseek-ai/dsh-tool-executor-ptc';
import { NativeToolExecutor } from '@deepseek-ai/dsh-tool-executor-native';
import { createScope } from '@deepseek-ai/dsh-scope';
import { PtcRuntime } from '@deepseek-ai/dsh-ptc-runtime';
import { SessionStore } from '@deepseek-ai/dsh-session';
import { SessionProjectionRegistry } from '@deepseek-ai/dsh-session-projection';

// Controlled runtime seam: only test-authored named callbacks, no eval, processes, files or network.
// This separately verifies the host bridge when OS confinement cannot launch NodePtcRuntime.
class HostBindingRuntime extends PtcRuntime {
  language = 'typescript';
  programFormat = 'function-body';
  isolation = 'fixture';
  programs = new Map();
  constructor(ctx, dir) { super(ctx); this.dir = dir; }
  resolve(request) { return { ...request, cwd: request.cwd ?? this.dir, timeoutMs: null }; }
  async run(spec) {
    const program = this.programs.get(spec.program);
    assert.ok(program, `unknown fixture program: ${spec.program}`);
    assert.equal(spec.bindings.length, 1);
    assert.equal(spec.bindings[0].global, 'tools');
    try {
      spec.signal.throwIfAborted();
      const value = await program(spec.bindings[0].functions, spec.signal);
      spec.signal.throwIfAborted();
      return { logs: [], value };
    } catch (error) {
      return { logs: [], error: { kind: spec.signal.aborted ? 'abort' : 'exception', message: error.message } };
    }
  }
}
import { ConfigStore } from '../core.js';
import * as discoveryPlugin from '../index.js';
import { installOrigins } from '../origins.js';

export const pluginIds = { browser: 'dsh-ego-browser', image: 'dsh-image-gen', schedule: '@deepseek-ai/dsh-tool-schedule' };
export const enabledConfig = (overrides = {}) => ({ version: 3, enabled: true, groups: Object.values(pluginIds).sort(), tools: [], exclude: [], descriptions: {}, ...overrides });

// A real Cordis plugin fiber, with the same Loader entry metadata as installed modules.
// Starting below the supplied context preserves its actual agent/scope inheritance.
export async function fixturePlugin(ctx, id, definitions = []) {
  let child;
  await ctx.plugin({ name: `fixture:${id}`, apply(pluginCtx) {
    child = pluginCtx;
    child.fiber.entry = { options: { name: id } };
    for (const definition of definitions) child.tools.register(definition);
  } });
  assert.ok(child, `fixture plugin ${id} must mount`);
  return child;
}
export const tsRuntime = { language: 'typescript', programFormat: 'function-body' };

export async function temporaryDirectory(t) {
  const parent = await realpath(tmpdir());
  const dir = await mkdtemp(join(parent, 'dsh-discovery-test-'));
  t.after(async () => {
    // Only remove the exact directory created here, never a profile or computed ancestor.
    const target = await realpath(dir);
    assert.equal(dirname(target), parent);
    assert.ok(basename(target).startsWith('dsh-discovery-test-'));
    await rm(target, { recursive: true });
  });
  return dir;
}

export function fixtureTool(name, { description = `${name} fixture`, marker = 'globalMarker', execute, safe = false } = {}) {
  return defineTool({
    name, description,
    parameters: { input: { type: 'string', required: true, description: `${marker} input documentation` } },
    output: {
      schema: {
        type: 'object', additionalProperties: false,
        properties: {
          [marker]: { type: 'string', required: true, description: `${marker} full output documentation` },
          details: { type: 'object', required: true, additionalProperties: false, properties: { values: { type: 'array', required: true, items: { type: 'integer' } } } },
        },
      },
      render: (_args, value) => [{ type: 'text', text: JSON.stringify(value) }],
    },
    isConcurrencySafe: () => safe,
    execute: execute ?? (async args => ({ [marker]: args.input, details: { values: [1, 2] } })),
  });
}

export async function hostFixture(t, { mode = 'ptc', config = enabledConfig(), node = false, bridge = false, installPlugin = true } = {}) {
  const dir = await temporaryDirectory(t);
  const ctx = new Context();
  const cleanupOrigins = installOrigins();
  t.after(async () => { try { await ctx.fiber.dispose(); } finally { cleanupOrigins(); } });
  const routes = new Map();
  const events = [];
  ctx.provide('profileContext', { dir });
  ctx.provide('webServer', { register(route) { routes.set(route.path, route.handler); return () => routes.delete(route.path); } });
  ctx.provide('connection', { requestRejection: req => req.headers['x-fixture-reject'] ? 403 : undefined });
  ctx.provide('workingDirectory', { ensure: async (_agent, signal) => { signal.throwIfAborted(); return dir; } });
  await ctx.plugin(SessionStore);
  await ctx.plugin(SessionProjectionRegistry);
  ctx.on('session/event', (session, event) => { events.push({ agent: session.id.slice('session-'.length), type: event.type, data: event.data }); });
  new SystemPrompt(ctx, { includeHarnessIdentity: false });
  new ToolRuntime(ctx);
  if (node) {
    const [{ LocalFileSystem }, { LocalSubprocessRuntime }, { LocalSandboxProvider }, { NodePtcRuntime }] = await Promise.all([
      import('@deepseek-ai/dsh-fs-local'), import('@deepseek-ai/dsh-subprocess-local'),
      import('@deepseek-ai/dsh-sandbox-local'), import('@deepseek-ai/dsh-ptc-runtime-node'),
    ]);
    // Fixture-only policy. The real local sandbox confines every Node program read-only.
    ctx.provide('sandboxPolicy', { defaultMode: 'read-only', resolve: () => ({ mode: 'read-only', workspaceRoot: dir }) });
    await ctx.plugin(LocalFileSystem, { cwd: dir });
    await ctx.plugin(LocalSubprocessRuntime);
    await ctx.plugin(LocalSandboxProvider);
    await ctx.plugin(NodePtcRuntime, { timeoutMs: 10000, maxTimeoutMs: 15000, maxOutputBytes: 1048576, maxMessageBytes: 2097152, graceMs: 1000 });
    assert.ok(ctx.get('ptcRuntime'), 'real NodePtcRuntime must mount');
  } else if (bridge) {
    new HostBindingRuntime(ctx, dir);
  } else {
    ctx.provide('ptcRuntime', tsRuntime);
  }
  const tools = ctx.get('tools');
  tools.setExecutor(mode === 'ptc' ? new PtcExecutor(ctx, { maxParallelSubCalls: 2 }) : new NativeToolExecutor(ctx));
  // Isolated capability-policy tests use the same public native pipeline. Full
  // nested PTC transport, parent tokens and scheduling are tested in host-bridge.
  const capabilityExecutor = new NativeToolExecutor(ctx);
  const calls = [];
  const definitions = [
    ['ego_visit', 'Browser visit webpage 浏览器访问网页。Original usage: preserve login and approval rules.', pluginIds.browser],
    ['ego_capture', 'Browser screenshot 浏览器截图', pluginIds.browser],
    ['generate_image', 'Generate image 图片生成', pluginIds.image],
    ['schedule_list', 'List reminders 查看定时提醒', pluginIds.schedule],
    ['virtual_echo', 'Echo a harmless value 无副作用回显', null],
    ['always_visible', 'Unselected capability 完整保留', null],
    ['ego_secret', 'RESTRICTED_SECRET_DESCRIPTION', pluginIds.browser],
  ];
  for (const id of [pluginIds.browser, pluginIds.image, pluginIds.schedule, null]) {
    const owned = definitions.filter(([, , owner]) => owner === id).map(([name, description]) => fixtureTool(name, { description, execute: async args => {
      calls.push({ name, input: args.input });
      return { globalMarker: args.input, details: { values: [1, 2] } };
    } }));
    if (id) await fixturePlugin(ctx, id, owned);
    else for (const definition of owned) tools.register(definition); // Deliberately unknown provenance.
  }
  const store = new ConfigStore(dir);
  await store.save(config);
  const mount = async () => {
    await ctx.plugin(discoveryPlugin);
    assert.ok(tools.get('discover_tools'), 'discovery plugin must mount');
    assert.ok(routes.has('/api/tool-discovery'), 'settings route must mount');
  };
  if (installPlugin) await mount();
  let n = 0;
  const execute = async (name, args, { agent, signal = new AbortController().signal, nested = false, toolSet: supplied } = {}) => {
    const toolSet = supplied ?? (signal.aborted ? undefined : await tools.resolve({ agent, modelSelection: { provider: 'fixture', model: 'fixture' }, signal }));
    try {
      const input = { calls: [{ type: 'tool-call', id: `fixture-${++n}`, name, arguments: JSON.stringify(args) }], agent, signal, ...(toolSet ? { toolSet } : {}) };
      const batch = await (nested ? capabilityExecutor.execute(input) : tools.execute(input));
      assert.equal(batch.results.length, 1);
      return batch.results[0].result;
    } finally { if (!supplied) toolSet?.dispose(); }
  };
  const agent = id => {
    // Real in-memory Sessions publish committed events to the real projection
    // registry, including ApprovalService's turn-open and policy state.
    const session = ctx.sessions.create(`session-${id}`);
    session.append('turn/start', { turn: 1 });
    const key = { id, session };
    const scope = createScope(ctx, key);
    key.ctx = scope.ctx;
    return key;
  };
  const request = async (method = 'GET', value, headers = {}) => {
    const body = value === undefined ? [] : [typeof value === 'string' ? value : JSON.stringify(value)];
    const req = Readable.from(body);
    req.method = method;
    req.headers = { 'content-type': 'application/json', ...headers };
    const res = { statusCode: 0, headers: {}, destroyed: false, setHeader(key, value) { this.headers[key] = value; }, end(body) { this.body = JSON.parse(body); } };
    await routes.get('/api/tool-discovery')(req, res);
    return res;
  };
  return { ctx, dir, tools, calls, events, execute, agent, request, mount, routes };
}

export function success(result) {
  assert.equal(result.isError, false, JSON.stringify(result));
  return result.value;
}

export function sdkSection(assembly) {
  return assembly.sections.find(section => section.name === 'tools:sdk').text;
}

// Model-step assembly carries the real caller-bound admission snapshot in rc.1.
export async function assemble(ctx, scope) {
  const toolSet = await ctx.tools.resolve({ agent: scope, modelSelection: { provider: 'fixture', model: 'fixture' }, signal: new AbortController().signal });
  try { return await ctx.systemPrompt.assemble({ scope, toolSet }); }
  finally { toolSet.dispose(); }
}
