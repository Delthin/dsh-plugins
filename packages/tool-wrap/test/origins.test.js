import test from 'node:test';
import assert from 'node:assert/strict';
import { Context } from '@deepseek-ai/cordis';
import { SystemPrompt } from '@deepseek-ai/dsh-system-prompt';
import { ToolRuntime } from '@deepseek-ai/dsh-tools';
import { createScope } from '@deepseek-ai/dsh-scope';
import { installOrigins, registeredPlugins, toolOrigin } from '../origins.js';
import { fixturePlugin, fixtureTool } from './fixture.js';

function root(t) {
  const ctx = new Context();
  new SystemPrompt(ctx, { includeHarnessIdentity: false });
  new ToolRuntime(ctx);
  t.after(() => ctx.fiber.dispose());
  return ctx;
}

test('registration observation preserves receiver, arguments, exact disposer and original exceptions; install is reference counted', () => {
  const descriptor = Object.getOwnPropertyDescriptor(ToolRuntime.prototype, 'register');
  const disposer = () => {};
  const sentinel = new Error('original validation failed');
  const receiver = {};
  const definition = { name: 'opaque' };
  const calls = [];
  const original = function (...args) { calls.push([this, args]); if (args[0] === null) throw sentinel; return disposer; };
  Object.defineProperty(ToolRuntime.prototype, 'register', { ...descriptor, value: original });
  const first = installOrigins();
  const wrapper = ToolRuntime.prototype.register;
  const second = installOrigins();
  try {
    assert.equal(ToolRuntime.prototype.register, wrapper);
    assert.equal(Reflect.apply(wrapper, receiver, [definition, 'extra']), disposer);
    assert.deepEqual(calls, [[receiver, [definition, 'extra']]]);
    assert.throws(() => Reflect.apply(wrapper, receiver, [null]), error => error === sentinel);
    first(); first();
    assert.equal(ToolRuntime.prototype.register, wrapper);
    second();
    assert.equal(ToolRuntime.prototype.register, original);
  } finally { first(); second(); Object.defineProperty(ToolRuntime.prototype, 'register', descriptor); }
});

test('historical same-object scoped shadow remains unknown rather than borrowing new ancestor provenance', async t => {
  const ctx = root(t);
  const key = {};
  const scope = createScope(ctx, key);
  const shared = fixtureTool('reused_definition');
  await fixturePlugin(scope.ctx, '@fixture/historical', [shared]);
  const release = installOrigins();
  t.after(release);
  await fixturePlugin(ctx, '@fixture/new-global', [shared]);
  assert.equal(toolOrigin(ctx.tools, shared.name).id, '@fixture/new-global');
  assert.equal(toolOrigin(ctx.tools, shared.name, key), null);
  assert.equal(ctx.tools.get(shared.name, key), shared);
});

test('same name and definition can belong to distinct runtimes and scopes; origin results are detached', async t => {
  const release = installOrigins();
  t.after(release);
  const a = root(t), b = root(t);
  const shared = fixtureTool('shared_object');
  await fixturePlugin(a, '@fixture/owner-a', [shared]);
  await fixturePlugin(b, '@fixture/owner-b', [shared]);
  const key = {};
  const scope = createScope(a, key);
  const child = await fixturePlugin(scope.ctx, '@fixture/child', [shared]);
  assert.equal(toolOrigin(a.tools, shared.name).id, '@fixture/owner-a');
  assert.equal(toolOrigin(b.tools, shared.name).id, '@fixture/owner-b');
  assert.equal(toolOrigin(a.tools, shared.name, key).id, '@fixture/child');
  const identity = toolOrigin(a.tools, shared.name, key);
  identity.id = 'mutated';
  const list = registeredPlugins(a.tools);
  assert.deepEqual(list.map(plugin => plugin.id), ['@fixture/child', '@fixture/owner-a']);
  list[0].id = 'mutated';
  assert.equal(toolOrigin(a.tools, shared.name, key).id, '@fixture/child');
  await child.fiber.dispose();
  assert.equal(toolOrigin(a.tools, shared.name, key).id, '@fixture/owner-a');
  assert.deepEqual(registeredPlugins(a.tools).map(plugin => plugin.id), ['@fixture/owner-a']);
});

test('manual disposer removes active identity and later registration is tracked without retaining disposed ownership', async t => {
  const release = installOrigins();
  t.after(release);
  const ctx = root(t);
  const plugin = await fixturePlugin(ctx, '@fixture/manual');
  const definition = fixtureTool('manual_tool');
  const dispose = plugin.tools.register(definition);
  assert.equal(toolOrigin(ctx.tools, definition.name).id, '@fixture/manual');
  dispose();
  assert.equal(ctx.tools.get(definition.name), undefined);
  assert.deepEqual(registeredPlugins(ctx.tools), []);
  await fixturePlugin(ctx, '@fixture/replacement', [definition]);
  assert.equal(toolOrigin(ctx.tools, definition.name).id, '@fixture/replacement');
});

test('unavailable or throwing package metadata preserves observed ownership without inventing a description', async t => {
  const release = installOrigins();
  t.after(release);
  const ctx = root(t);
  ctx.provide('pluginPackages', { metaOf(id) { if (id === '@fixture/throwing-metadata') throw new Error('fixture unavailable metadata'); return undefined; } });
  for (const id of ['@fixture/no-metadata', '@fixture/throwing-metadata']) {
    const name = id.endsWith('no-metadata') ? 'no_metadata_tool' : 'throwing_metadata_tool';
    await fixturePlugin(ctx, id, [fixtureTool(name)]);
    assert.deepEqual(toolOrigin(ctx.tools, name), { id, label: id });
    assert.ok(ctx.tools.get(name));
  }
  assert.deepEqual(registeredPlugins(ctx.tools).map(plugin => plugin.id), ['@fixture/no-metadata', '@fixture/throwing-metadata']);
});
