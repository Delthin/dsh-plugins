import { symbols } from '@deepseek-ai/cordis';
import { ToolRuntime } from '@deepseek-ai/dsh-tools';
import { scopeOf, scopeChainOf } from '@deepseek-ai/dsh-scope';

let installation;
const originalOf = value => value?.[symbols.original] ?? value;
const protectedNames = new Set(['run_code', 'discover_tools']);

// 0.2.2-rc.1 stores registration records, not bare definitions. Unsupported layouts stay unidentified.
function layersOf(runtime) {
  const layers = runtime?.layers;
  return typeof layers?.global?.tools?.get === 'function' && typeof layers?.peek === 'function' ? layers : null;
}
function tableOf(layers, scope) {
  return (scope === undefined ? layers.global : layers.peek(scope))?.tools;
}
function ownerOf(ctx) {
  const seen = new Set();
  for (let fiber = ctx.fiber; fiber && !seen.has(fiber); fiber = fiber.parent?.fiber) {
    seen.add(fiber);
    const id = fiber.entry?.options?.name;
    if (typeof id === 'string' && id) {
      let description = '';
      try {
        const meta = ctx.get('pluginPackages')?.metaOf(id, fiber.entry.parent?.tree?.ctx?.baseUrl);
        const value = meta?.description;
        // Stable deployment language; no current/other conversation state is consulted.
        description = typeof value === 'string' ? value : value?.['zh-cn'] || value?.['zh-CN'] || value?.zh || value?.en || '';
      } catch { /* Missing package metadata never invalidates a tool's registration origin. */ }
      return Object.freeze({ id, label: id, ...(typeof description === 'string' && description.trim() ? { description: description.trim() } : {}) });
    }
  }
  return null;
}
function prune(state, layers) {
  const clean = (records, scope) => {
    const table = layers && tableOf(layers, scope);
    for (const [name, record] of records) if (table?.get(name)?.definition !== record.definition) records.delete(name);
  };
  clean(state.global, undefined);
  for (const reference of state.scopes) {
    const scope = reference.deref();
    if (!scope) { state.scopes.delete(reference); continue; }
    const records = state.scoped.get(scope);
    if (records) clean(records, scope);
    if (!records?.size) { state.scoped.delete(scope); state.scopes.delete(reference); }
  }
}
function stateOf(epoch, runtime) {
  let state = epoch.runtimes.get(runtime);
  if (state) return state;
  state = { global: new Map(), scoped: new WeakMap(), scopes: new Set() };
  const weakRuntime = new WeakRef(runtime);
  const dispose = runtime.ctx.on('tools/change', () => {
    // Metadata must never make the registry's own notification fail.
    try { prune(state, layersOf(weakRuntime.deref())); } catch { state.global.clear(); state.scoped = new WeakMap(); state.scopes.clear(); }
  });
  epoch.observers.add(new WeakRef(originalOf(dispose)));
  epoch.runtimes.set(runtime, state);
  return state;
}

/** Reference-counted registration observation; returns the original registry disposer unchanged. */
export function installOrigins() {
  if (!installation) {
    const descriptor = Object.getOwnPropertyDescriptor(ToolRuntime.prototype, 'register');
    if (typeof descriptor?.value !== 'function') throw new Error('Unsupported ToolRuntime.register contract');
    const epoch = { active: true, references: 0, runtimes: new WeakMap(), observers: new Set() };
    const register = descriptor.value;
    const wrapper = function (...args) {
      // The host alone owns registration validation, errors, effects and disposal.
      const result = Reflect.apply(register, this, args);
      if (!epoch.active) return result;
      try {
        const runtime = originalOf(this);
        const layers = layersOf(runtime);
        if (!layers) return result;
        const scope = scopeOf(this.ctx);
        const definition = args[0];
        if (tableOf(layers, scope)?.get(definition.name)?.definition !== definition) return result;
        const state = stateOf(epoch, runtime);
        let records = state.global;
        if (scope !== undefined) {
          records = state.scoped.get(scope);
          if (!records) {
            records = new Map();
            state.scoped.set(scope, records);
            state.scopes.add(new WeakRef(scope));
          }
        }
        records.set(definition.name, { definition, owner: ownerOf(this.ctx) });
      } catch { /* An unsupported metadata contract must not break a registered tool. */ }
      return result;
    };
    Object.defineProperty(ToolRuntime.prototype, 'register', { ...descriptor, value: wrapper });
    installation = { epoch, descriptor, wrapper };
  }
  const current = installation;
  current.epoch.references++;
  let active = true;
  return () => {
    if (!active) return;
    active = false;
    if (--current.epoch.references) return;
    current.epoch.active = false;
    for (const reference of current.epoch.observers) {
      try { reference.deref()?.(); } catch { /* Host may already have disposed its root. */ }
    }
    current.epoch.observers.clear();
    current.epoch.runtimes = new WeakMap();
    if (ToolRuntime.prototype.register === current.wrapper) Object.defineProperty(ToolRuntime.prototype, 'register', current.descriptor);
    if (installation === current) installation = undefined;
  };
}

/** Resolve the physical binding only after the public registry permits the caller to see it. */
export function toolOrigin(registry, name, scope, toolSet) {
  const definition = registry.get(name, scope, toolSet);
  if (!definition) return null;
  try {
    const runtime = originalOf(registry);
    const layers = layersOf(runtime);
    const state = installation?.epoch.runtimes.get(runtime);
    if (!layers || !state) return null;
    for (const key of [...scopeChainOf(scope), undefined]) {
      const bound = tableOf(layers, key)?.get(name)?.definition;
      if (bound === undefined) continue;
      // Unknown historical shadows may reuse an observed ancestor's exact object.
      if (bound !== definition) return null;
      const record = (key === undefined ? state.global : state.scoped.get(key))?.get(name);
      return record?.definition === definition && record.owner ? { ...record.owner } : null;
    }
  } catch { /* Incompatible internals are unknown provenance, not an authority change. */ }
  return null;
}

/** Active plugin identities only: never return another scope's names or definitions. */
export function registeredPlugins(registry) {
  try {
    const runtime = originalOf(registry);
    const layers = layersOf(runtime);
    const state = installation?.epoch.runtimes.get(runtime);
    if (!layers || !state) return [];
    prune(state, layers);
    const plugins = new Map();
    const collect = records => {
      for (const [name, record] of records) if (!protectedNames.has(name) && record.owner) plugins.set(record.owner.id, { ...record.owner });
    };
    collect(state.global);
    for (const reference of state.scopes) {
      const scope = reference.deref();
      const records = scope && state.scoped.get(scope);
      if (records) collect(records);
    }
    return [...plugins.values()].sort((a, b) => a.id.localeCompare(b.id));
  } catch { return []; }
}
