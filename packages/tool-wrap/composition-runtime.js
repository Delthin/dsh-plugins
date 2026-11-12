import { renderPrompt, renderContextSections } from '@deepseek-ai/dsh-system-prompt';
import { hiddenTools, sdkSchemas, DISCOVER } from './core.js';
import { sourceId, ownerId, instructionId, effectiveRule, orderContributions } from './prompt-composition.js';
import { registeredPromptSources, registrationMetadata, contributionMetadata, DIRECTORY_NAME, UNWRAP_OWNER } from './prompt-origins.js';
import { registeredPlugins } from './origins.js';
import { appendPluginRecord } from '@deepseek-ai/dsh-session';
import { promptMessageDescriptor } from './host-support/admission.js';

const INSTRUCTIONS_OWNER = '@deepseek-ai/dsh-agent-instructions';
// Admission state is durable plugin state: it must be an ignorable plugin record, because a
// session log holding an unmarked unknown event cannot be opened by a harness without this plugin.
const PACK_ADMITTED = 'plugin:tool-wrap/pack-admitted';
const LEGACY_PACK_ADMITTED = 'tool-wrap/pack-admitted';
function recordAdmission(session, data) {
  // An adapted Session class commits with its own private brand; the package export only
  // reaches Sessions of the module instance it was imported from.
  if (typeof session.toolWrapRecordPluginEvent === 'function') { session.toolWrapRecordPluginEvent(PACK_ADMITTED, data); return true; }
  try { appendPluginRecord(session, PACK_ADMITTED, data); return true; } catch { return false; }
}
const parentOf = block => block.scope === 'global' ? 'instructions:global' : 'instructions:project';
export class CompositionRuntime {
  constructor(ctx, store, toolsConfig) {
    this.ctx = ctx; this.store = store; this.toolsConfig = toolsConfig;
    this.observed = new Map(); this.stepAssemblies = new WeakMap();
  }
  get enabled() { return this.store.config.enabled; }
  registrationMetadata(definition, kind, scope) { return registrationMetadata(definition, kind, scope, this.ctx.systemPrompt); }
  capabilities() {
    const admission = this.ctx.systemPrompt.promptCompositionVersion === 1;
    return { available: admission, admission, version: admission ? 1 : 0, roles: admission ? ['inherit', 'system', 'user'] : ['inherit'], developer: false,
      injection: admission, delivery: admission, placements: admission ? ['inherit', 'fixed', 'state'] : ['inherit'], structuredInstructions: admission, reason: admission ? null : 'host-adapter-required' };
  }
  observe(source) {
    if (!source?.id) return;
    // Global UI state holds identities only, never another caller's prompt body or toolSet.
    const { id, owner, kind, label, name, parent, groupId, groupLabel, required, complete, opaque, form, defaultPlacement } = source;
    this.observed.set(id, { id, owner, kind, label, name, parent, groupId, groupLabel, required, complete, opaque, form, defaultPlacement, catalogOrigin: 'observed' });
  }
  observeInstructions(message) {
    for (const block of message?.source?.compositionSections ?? []) this.observe({ id: instructionId(block.key), owner: INSTRUCTIONS_OWNER, kind: 'instructions', label: block.path, parent: parentOf(block), groupId: parentOf(block), groupLabel: block.scope === 'global' ? 'Global AGENTS' : 'Project AGENTS', defaultPlacement: 'fixed' });
  }
  sources() {
    const caps = this.capabilities();
    const plugins = registeredPlugins(this.ctx.tools);
    const knownPlugins = new Set(plugins.map(plugin => plugin.id));
    const records = new Map([...this.observed.values(), ...registeredPromptSources(this.ctx.systemPrompt)].map(source => [source.id, source]));
    const sources = [...records.values()].map(source => {
      const directory = source.owner === UNWRAP_OWNER && source.name === DIRECTORY_NAME;
      const groupId = source.groupId ?? ownerId(source.owner ?? '@host/unknown');
      const attributed = Boolean(source.owner);
      const pack = caps.admission && attributed && knownPlugins.has(source.owner) && !directory && !source.complete && source.kind !== 'instructions' && !source.opaque;
      return { ...source, groupId, groupLabel: source.groupLabel ?? source.owner ?? 'Unattributed host contributions',
        defaultRole: source.kind === 'section' ? 'system' : 'user',
        defaultPlacement: source.defaultPlacement ?? (source.kind === 'instructions' || source.kind === 'message' && ['instructions', 'catalog'].includes(source.form) ? 'fixed' : 'state'),
        placements: source.opaque ? ['inherit'] : caps.placements,
        canToggleInjection: caps.admission && !source.opaque && !directory,
        roles: source.opaque ? ['inherit'] : caps.roles,
        deliveryModes: caps.admission && !source.opaque ? ['inherit', 'always', ...(pack ? ['pack'] : [])] : ['inherit'],
        reason: !caps.admission ? 'host-adapter-required' : !attributed ? 'owner-unattributed-pack-unavailable' : directory ? 'entrypoint-always' : source.complete ? 'complete-persona-always' : null };
    });
    for (const group of [{ id: 'instructions:global', label: 'Global AGENTS' }, { id: 'instructions:project', label: 'Project AGENTS' }]) sources.push({ ...group, owner: INSTRUCTIONS_OWNER, kind: 'group', groupId: group.id, groupLabel: group.label, defaultRole: 'user', defaultPlacement: 'fixed', placements: caps.placements, canToggleInjection: caps.admission, roles: caps.roles, deliveryModes: caps.admission ? ['inherit', 'always'] : ['inherit'], reason: caps.reason });
    for (const groupId of new Set(sources.filter(source => source.kind !== 'group').map(source => source.groupId))) {
      if (sources.some(source => source.id === groupId)) continue;
      const children = sources.filter(source => source.groupId === groupId && source.kind !== 'group');
      const { owner, groupLabel } = children[0];
      const pack = children.every(source => source.deliveryModes.includes('pack'));
      sources.push({ id: groupId, label: groupLabel, owner, kind: 'group', groupId, groupLabel, defaultRole: 'inherit', defaultPlacement: children.every(source => source.defaultPlacement === 'fixed') ? 'fixed' : 'state', placements: children.every(source => !source.opaque) ? caps.placements : ['inherit'], roles: caps.roles,
        canToggleInjection: caps.admission && children.every(source => source.canToggleInjection),
        deliveryModes: caps.admission ? ['inherit', 'always', ...(pack ? ['pack'] : [])] : ['inherit'], reason: caps.reason ?? (!owner ? 'owner-unattributed-pack-unavailable' : null), children: children.map(source => source.id) });
    }
    const present = new Set(sources.map(source => source.id));
    // A trusted tools-only plugin still needs a durable ordering identity. Existing
    // custom prompt groups already represent their owner and must not be duplicated.
    const groupedOwners = new Set(sources.filter(source => source.kind === 'group').map(source => source.owner));
    for (const plugin of plugins) {
      const id = ownerId(plugin.id);
      if (groupedOwners.has(plugin.id) || present.has(id)) continue;
      const label = plugin.label ?? plugin.id;
      sources.push({ id, label, owner: plugin.id, kind: 'group', groupId: id, groupLabel: label, defaultRole: 'inherit',
        defaultPlacement: 'state', placements: ['inherit'], canToggleInjection: false, roles: ['inherit'], deliveryModes: ['inherit'], reason: caps.reason, children: [] });
      present.add(id);
    }
    for (const id of new Set([...this.store.config.order, ...(this.store.config.sourceOrder ?? []), ...Object.keys(this.store.config.rules)])) if (!present.has(id)) sources.push({ id, label: id, owner: null, kind: 'unavailable', groupId: id, groupLabel: id, defaultRole: 'inherit', defaultPlacement: 'state', placements: ['inherit'], canToggleInjection: false, roles: ['inherit'], deliveryModes: ['inherit'], reason: 'source-unavailable' });
    return sources;
  }
  status() { return { config: structuredClone(this.store.config), sources: this.sources(), capabilities: this.capabilities() }; }
  collectAssembly(assembly) {
    const renderedContexts = new Map(renderContextSections(assembly).map(section => [section.name, section.text]));
    const collect = (item, kind) => {
      const metadata = contributionMetadata(item);
      const source = { ...(metadata ?? { id: sourceId(kind, null, item.name), owner: null, kind, name: item.name, label: item.name }), defaultPlacement: metadata?.defaultPlacement ?? 'state' };
      this.observe(source);
      const text = kind === 'section' ? renderPrompt({ ...assembly, sections: [item] }) : renderedContexts.get(item.name) ?? '';
      return { ...source, groupId: source.groupId ?? ownerId(source.owner ?? '@host/unknown'), defaultRole: kind === 'section' ? 'system' : 'user', text, attributed: Boolean(metadata?.owner) };
    };
    return [...assembly.sections.map(item => collect(item, 'section')), ...assembly.contexts.map(item => collect(item, 'context'))];
  }
  instructions(agent, messages) {
    const files = new Map();
    let baselineIdentity;
    const apply = message => {
      if (message?.source?.kind !== 'agent-instructions') return;
      this.observeInstructions(message);
      const source = message.source;
      if (source.baseline === true || typeof source.baselineIdentity === 'string' && source.baselineIdentity !== baselineIdentity) files.clear();
      if (source.baselineIdentity) baselineIdentity = source.baselineIdentity;
      for (const block of source.compositionSections ?? []) {
        if (typeof block.key !== 'string') continue;
        if (block.action === 'remove') { files.delete(block.key); continue; }
        files.set(block.key, { id: instructionId(block.key), owner: INSTRUCTIONS_OWNER, kind: 'instructions', label: block.path, parent: parentOf(block), groupId: parentOf(block), defaultRole: 'user', defaultPlacement: 'fixed', attributed: true, text: block.text });
      }
    };
    for (const seq of agent.session.surface.nodes) {
      const event = agent.session.eventAt(seq);
      if (event?.type === 'user/message') apply(event.data);
    }
    for (const message of messages) apply(message);
    return [...files.values()];
  }
  injectedMessages(agent, messages) {
    const records = new Map(), seen = new Set();
    const apply = message => {
      const original = message.source?.compositionOriginalContent ? { ...message, content: message.source.compositionOriginalContent } : message;
      const source = promptMessageDescriptor(original);
      if (!source) return;
      this.observe(source);
      if (source.opaque) return;
      const messageId = message.source.compositionOriginalId ?? message.id;
      if (seen.has(messageId)) return;
      seen.add(messageId);
      const previous = records.get(source.id);
      records.set(source.id, { ...source, attributed: Boolean(source.owner), text: source.form === 'instructions' && previous ? previous.text + '\n\n' + source.text : source.text });
    };
    for (const seq of agent.session.surface.nodes) {
      const event = agent.session.eventAt(seq);
      if (event?.type === 'user/message') apply(event.data);
    }
    messages.forEach(apply);
    return [...records.values()];
  }
  recordPack(execution, plugin) {
    const accepted = this.accepted(execution);
    if (!plugin || !accepted?.config.enabled || !accepted.canDefer || !execution.agent?.session) return false;
    execution.signal.throwIfAborted();
    return recordAdmission(execution.agent.session, { version: 1, plugin, rootCallId: String(execution.rootCallId ?? execution.callId) });
  }
  loadedPlugins(agent) {
    const session = agent?.session;
    if (!session) return new Set();
    const visible = new Set();
    for (const seq of session.surface.nodes) {
      const event = session.eventAt(seq);
      if (event?.type === 'tool/result' && event.data.message.isError === false) visible.add(String(event.data.message.source.callId));
    }
    return new Set(session.snapshotEvents().filter(event => (event.type === PACK_ADMITTED || event.type === LEGACY_PACK_ADMITTED) && event.data.version === 1 && visible.has(event.data.rootCallId)).map(event => event.data.plugin));
  }
  delivery(source, schemas, config, toolsConfig, canDefer) {
    if (!canDefer || !source.attributed || source.owner === UNWRAP_OWNER || source.kind === 'instructions' || source.complete) return 'always';
    const rule = effectiveRule(config, source);
    if (rule.delivery === 'always') return 'always';
    // Independent state snapshots remain present unless deliberately deferred.
    if (source.kind === 'message' && source.form !== 'instructions' && rule.delivery !== 'pack') return 'always';
    return hiddenTools(schemas, toolsConfig).some(tool => tool.plugin?.id === source.owner) ? 'pack' : 'always';
  }
  async admit(input) {
    const { assembly, agent, messages, toolSet, signal } = input;
    signal.throwIfAborted();
    const config = structuredClone(this.store.config);
    const toolsConfig = structuredClone(assembly.toolDiscoveryProjection?.config ?? this.toolsConfig.config);
    const schemas = sdkSchemas(this.ctx.tools, agent, toolSet);
    const canDefer = assembly.tools?.length === 1 && assembly.tools[0].name === 'run_code' && schemas.some(tool => tool.name === DISCOVER) && assembly.sections.some(section => section.name === DIRECTORY_NAME && section.text);
    const assembled = this.collectAssembly(assembly);
    messages.forEach(message => this.observeInstructions(message));
    const injected = this.injectedMessages(agent, messages);
    const contributions = [...assembled, ...this.instructions(agent, messages), ...injected];
    if (toolSet) this.stepAssemblies.set(toolSet, { agent, assembly, config, toolsConfig, canDefer, contributions });
    if (!config.enabled) return undefined;
    const loaded = this.loadedPlugins(agent);
    const ordered = orderContributions(contributions, config);
    const system = [], systemSourceIds = [], projected = [], excludedIds = [];
    for (const source of ordered) {
      const rule = effectiveRule(config, source);
      // The unwrap directory remains resident even if a stored parent draft predates it.
      const entrypoint = source.owner === UNWRAP_OWNER && source.name === DIRECTORY_NAME;
      if (!rule.enabled && !entrypoint || this.delivery(source, schemas, config, toolsConfig, canDefer) === 'pack' && !loaded.has(source.owner)) { excludedIds.push(source.id); continue; }
      const role = rule.role === 'inherit' ? source.defaultRole : rule.role;
      if (!['system', 'user'].includes(role)) throw new Error('Unsupported trusted prompt-composition role');
      if (role === 'system') { excludedIds.push(source.id); if (source.text) { system.push(source.text); systemSourceIds.push(source.id); } }
      else if (source.text) projected.push({ id: source.id, role, placement: rule.placement === 'inherit' ? source.defaultPlacement ?? 'state' : rule.placement, text: source.text });
    }
    // An unavailable source can still have an explicit off/system/pack rule. Its observed
    // identity is sufficient to revoke old user projections without retaining prompt bodies.
    const present = new Set(ordered.map(source => source.id));
    for (const observed of this.observed.values()) {
      if (present.has(observed.id) || observed.owner === UNWRAP_OWNER && observed.name === DIRECTORY_NAME) continue;
      const source = { ...observed, attributed: Boolean(observed.owner) }, rule = effectiveRule(config, source);
      const role = rule.role === 'inherit' ? source.kind === 'section' ? 'system' : 'user' : rule.role;
      if (!rule.enabled || role === 'system' || this.delivery(source, schemas, config, toolsConfig, canDefer) === 'pack' && !loaded.has(source.owner)) excludedIds.push(source.id);
    }
    // Direct source rules also revoke unavailable legacy sources after process restart,
    // before their producer has supplied identity metadata to this runtime instance.
    for (const [id, rule] of Object.entries(config.rules)) if (rule.enabled === false || rule.role === 'system') excludedIds.push(id);
    const projectedIds = new Set(projected.map(source => source.id));
    // Only sorting identity permits fixed-slot reprojection. Off/role/loading changes
    // revoke their own source and later restore it by append, preserving unrelated fixed slots.
    return { version: 1, systemText: system.join('\n\n'), systemSourceIds, contributions: projected, excludedIds: [...new Set(excludedIds)].filter(id => !projectedIds.has(id)),
      configKey: JSON.stringify({ order: config.order, sourceOrder: config.sourceOrder ?? [] }) };
  }
  accepted(execution) {
    const accepted = execution.toolSet && this.stepAssemblies.get(execution.toolSet);
    return accepted?.agent === execution.agent ? accepted : undefined;
  }
  async guidance(execution, plugin, toolNames) {
    if (!plugin || !toolNames.length || !this.capabilities().admission) return [];
    const accepted = this.accepted(execution);
    if (!accepted) return [];
    execution.signal.throwIfAborted();
    const schemas = sdkSchemas(this.ctx.tools, execution.agent, execution.toolSet);
    const { config, toolsConfig, canDefer } = accepted;
    return orderContributions(accepted.contributions, config).filter(source => source.owner === plugin && source.text && (!config.enabled || effectiveRule(config, source).enabled && this.delivery(source, schemas, config, toolsConfig, canDefer) === 'pack')).map(source => {
      const rule = config.enabled ? effectiveRule(config, source) : { role: 'inherit', placement: 'inherit' };
      return { id: source.id, kind: source.kind, role: rule.role === 'inherit' ? source.defaultRole : rule.role, placement: rule.placement === 'inherit' ? source.defaultPlacement ?? 'state' : rule.placement, text: source.text };
    });
  }
}
