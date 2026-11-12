import { symbols } from '@deepseek-ai/cordis';
import { SystemPrompt } from '@deepseek-ai/dsh-system-prompt';
import { scopeOf, scopeChainOf } from '@deepseek-ai/dsh-scope';
import { sourceId, ownerId } from './prompt-composition.js';

const definitionOrigins = new WeakMap();
const registryOrigins = new WeakMap();
const explicitOrigins = new WeakMap();
export const UNWRAP_OWNER = '@delthin/dsh-tool-wrap';
export const DIRECTORY_NAME = 'tool-discovery:directory';
function observeRegistration(receiver, definition, kind) {
  try {
    const runtime = originalOf(receiver), scope = scopeOf(receiver.ctx);
    const layer = scope === undefined ? runtime.layers.global : runtime.layers.peek(scope);
    if (layer?.[kind + 's'].get(definition.name) !== definition) return;
    const record = { reference: new WeakRef(definition), owner: ownerOf(receiver.ctx), kind };
    definitionOrigins.set(definition, record);
    let state = registryOrigins.get(runtime);
    if (!state) registryOrigins.set(runtime, state = { global: { section: new Map(), context: new Map() }, scoped: new WeakMap() });
    let records = state.global;
    if (scope !== undefined) {
      records = state.scoped.get(scope);
      if (!records) state.scoped.set(scope, records = { section: new Map(), context: new Map() });
    }
    records[kind].set(definition.name, record);
  } catch { /* Observation must not alter registration behavior. */ }
}
export function registrationMetadata(definition, kind, scope, registry) {
  let record;
  if (registry) {
    const runtime = originalOf(registry), state = registryOrigins.get(runtime);
    for (const key of [...scopeChainOf(scope), undefined]) {
      const layer = key === undefined ? runtime.layers.global : runtime.layers.peek(key);
      const actual = layer?.[kind + 's'].get(definition.name);
      if (actual === undefined) continue;
      const candidate = (key === undefined ? state?.global : state?.scoped.get(key))?.[kind].get(definition.name);
      if (actual === definition && candidate?.reference.deref() === definition) record = candidate;
      break;
    }
  } else record = definitionOrigins.get(definition);
  return record && record.kind === kind ? { id: sourceId(kind, record.owner, definition.name), owner: record.owner, kind, label: definition.name, name: definition.name, required: definition.required === true, complete: definition.complete === true, defaultPlacement: registrationPlacement(definition) } : undefined;
}
/** Classify only literal registration data; getters and providers stay unevaluated. */
function registrationPlacement(definition) {
  const descriptor = Object.getOwnPropertyDescriptor(definition, 'text');
  return descriptor && Object.hasOwn(descriptor, 'value') && typeof descriptor.value === 'string' ? 'fixed' : 'state';
}
/** Providers use their actual registration context, never an owner string supplied by config. */
export function attributePromptContribution(ctx, contribution, kind = 'section') {
  const owner = ownerOf(ctx);
  if (!owner || !['section', 'context'].includes(kind) || !contribution?.name) throw new TypeError('A real plugin registration context and named contribution are required');
  explicitOrigins.set(contribution, { id: sourceId(kind, owner, contribution.name), owner, kind, label: contribution.name, name: contribution.name, defaultPlacement: registrationPlacement(contribution) });
  return contribution;
}
export function contributionMetadata(contribution) { return explicitOrigins.get(contribution) ?? contribution.compositionSource; }
/** Read registration literals only; never evaluate providers, getters or interpolation variables. */
function registrationPreview(definition) {
  const descriptor = Object.getOwnPropertyDescriptor(definition, 'text');
  if (descriptor && Object.hasOwn(descriptor, 'value')) {
    if (typeof descriptor.value === 'string') return { kind: 'static', text: descriptor.value };
    if (typeof descriptor.value === 'function') return {
      kind: 'dynamic', reason: 'session-context-required',
      message: '需会话上下文动态生成；全局预览不会执行 provider。',
    };
  }
  return { kind: 'unavailable', reason: 'static-text-unavailable', message: '注册定义没有可安全读取的静态 text 字符串。' };
}
/** Global registration previews only, never scoped definitions or observed assembly bodies. */
export function registeredPromptSources(registry) {
  try {
    const runtime = originalOf(registry);
    return ['section', 'context'].flatMap(kind => [...runtime.layers.global[kind + 's'].values()].map(definition => {
      const source = registrationMetadata(definition, kind, undefined, registry) ?? { id: sourceId(kind, null, definition.name), owner: null, kind, label: definition.name, name: definition.name };
      const directory = kind === 'section' && source.owner === UNWRAP_OWNER && definition.name === DIRECTORY_NAME;
      return { ...source, label: directory ? 'tool-wrap:directory' : source.label,
        required: definition.required === true, complete: definition.complete === true, defaultPlacement: registrationPlacement(definition), catalogOrigin: 'registered',
        // The empty registration is a placeholder; assembly supplies the caller-visible directory.
        preview: directory ? { kind: 'dynamic', reason: 'tool-directory-assembly-required', message: '按当前会话可见工具与按需配置生成。' } : registrationPreview(definition),
      };
    }));
  } catch { return []; }
}

let installation;
const originalOf = value => value?.[symbols.original] ?? value;
const tableOf = (runtime, scope) => (scope === undefined ? runtime.layers.global : runtime.layers.peek(scope))?.sections;
function ownerOf(ctx) {
  const seen = new Set();
  for (let fiber = ctx?.fiber; fiber && !seen.has(fiber); fiber = fiber.parent?.fiber) {
    seen.add(fiber);
    const id = fiber.entry?.options?.name;
    if (typeof id === 'string' && id) return id;
  }
  return null;
}

/** Observe registrations, never change validation, effects, exceptions or the returned disposer. */
export function installPromptOrigins() {
  if (!installation) {
    const descriptor = Object.getOwnPropertyDescriptor(SystemPrompt.prototype, 'section');
    const contextDescriptor = Object.getOwnPropertyDescriptor(SystemPrompt.prototype, 'context');
    if (typeof descriptor?.value !== 'function' || typeof contextDescriptor?.value !== 'function') throw new Error('Unsupported SystemPrompt registration contract');
    const epoch = { active: true, references: 0, runtimes: new WeakMap() };
    const wrapper = function (...args) {
      const result = Reflect.apply(descriptor.value, this, args);
      if (!epoch.active) return result;
      observeRegistration(this, args[0], 'section');
      try {
        const runtime = originalOf(this);
        const scope = scopeOf(this.ctx);
        const definition = args[0];
        if (tableOf(runtime, scope)?.get(definition.name) !== definition) return result;
        let state = epoch.runtimes.get(runtime);
        if (!state) epoch.runtimes.set(runtime, state = { global: new Map(), scoped: new WeakMap() });
        let records = state.global;
        if (scope !== undefined) {
          records = state.scoped.get(scope);
          if (!records) state.scoped.set(scope, records = new Map());
        }
        records.set(definition.name, { reference: new WeakRef(definition), owner: ownerOf(this.ctx) });
      } catch { /* Unsupported metadata stays unknown, without affecting the host. */ }
      return result;
    };
    const contextWrapper = function (...args) {
      const result = Reflect.apply(contextDescriptor.value, this, args);
      if (epoch.active) observeRegistration(this, args[0], 'context');
      return result;
    };
    Object.defineProperty(SystemPrompt.prototype, 'section', { ...descriptor, value: wrapper });
    Object.defineProperty(SystemPrompt.prototype, 'context', { ...contextDescriptor, value: contextWrapper });
    installation = { descriptor, wrapper, epoch, contextDescriptor, contextWrapper };
  }
  const current = installation;
  current.epoch.references++;
  let active = true;
  return () => {
    if (!active) return;
    active = false;
    if (--current.epoch.references) return;
    current.epoch.active = false;
    current.epoch.runtimes = new WeakMap();
    if (SystemPrompt.prototype.section === current.wrapper) Object.defineProperty(SystemPrompt.prototype, 'section', current.descriptor);
    if (SystemPrompt.prototype.context === current.contextWrapper) Object.defineProperty(SystemPrompt.prototype, 'context', current.contextDescriptor);
    if (installation === current) installation = undefined;
  };
}

function registration(runtime, name, scope) {
  const state = installation?.epoch.runtimes.get(runtime);
  for (const key of [...scopeChainOf(scope), undefined]) {
    const definition = tableOf(runtime, key)?.get(name);
    if (definition === undefined) continue;
    const records = key === undefined ? state?.global : state?.scoped.get(key);
    const record = records?.get(name);
    // An unobserved shadow is unknown even if it reuses an ancestor's exact definition.
    if (record?.reference.deref() !== definition) {
      records?.delete(name);
      return { definition, owner: null };
    }
    return { definition, owner: record.owner };
  }
  return null;
}
function metadata(name, record) {
  const plugin = record?.owner ?? null;
  const reserved = /^(harness|deployment|tools?|policy|permissions?|approval|sandbox|persona|identity|team|plan|structured-output)(:|$)/i.test(name);
  const locked = !plugin || plugin.startsWith('@deepseek-ai/') || reserved || record?.definition.complete === true;
  return { id: name, plugin, locked, reason: !plugin ? 'unknown-source' : locked ? 'protected' : 'plugin' };
}

/** Global registration metadata only. Never assemble/evaluate providers or enumerate scopes. */
export function globalPromptSections(registry) {
  try {
    const runtime = originalOf(registry);
    return [...runtime.layers.global.sections.entries()]
      .sort(([, a], [, b]) => a.order - b.order || (a.name < b.name ? -1 : a.name > b.name ? 1 : 0))
      .map(([name]) => metadata(name, registration(runtime, name)));
  } catch { return []; }
}

/** Capture only this call's original objects; dynamic replacements cannot inherit attribution. */
export function capturePromptSections(registry, sections, scope) {
  const captured = new Map();
  try {
    const runtime = originalOf(registry);
    for (const section of sections) captured.set(section, {
      ...metadata(section.name, registration(runtime, section.name, scope)),
      name: section.name, text: section.text, interpolate: section.interpolate, hasInterpolate: Object.hasOwn(section, 'interpolate'),
    });
  } catch { captured.clear(); /* Fail closed: no eligible objects on an unsupported host. */ }
  return captured;
}

/** In-place edits, like replacement objects, cannot inherit a captured source. */
export function capturedPromptMetadata(captured, section) {
  const record = captured.get(section);
  return record && section.name === record.name && section.text === record.text && section.interpolate === record.interpolate && Object.hasOwn(section, 'interpolate') === record.hasInterpolate ? record : null;
}

/** A pure stable permutation of eligible slots; fixed sections retain their exact positions. */
export function orderPromptSections(sections, config, metadataOf) {
  if (!config.enabled || !config.plugins.length) return sections;
  const ranks = new Map(config.plugins.map((id, index) => [id, index]));
  const eligible = sections.filter(section => metadataOf(section)?.locked === false);
  const sorted = eligible.map((section, index) => ({ section, index, rank: ranks.get(metadataOf(section).plugin) ?? Infinity }))
    .sort((a, b) => a.rank - b.rank || a.index - b.index).map(item => item.section);
  if (eligible.every((section, index) => section === sorted[index])) return sections;
  let index = 0;
  return sections.map(section => metadataOf(section)?.locked === false ? sorted[index++] : section);
}

export function promptOrderPreview(registry, config) {
  const sections = globalPromptSections(registry);
  return orderPromptSections(sections, config, section => section);
}
