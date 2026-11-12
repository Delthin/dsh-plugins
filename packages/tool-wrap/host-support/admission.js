import { createUserMessage, freezeMessage } from '@deepseek-ai/dsh-llm';
import { createHash } from 'node:crypto';

// ContextFormed is the host's explicit semantic envelope, not a text/title heuristic.
export function promptMessageDescriptor(message) {
  const source = message?.source;
  const mnemon = source?.kind === 'dsh-mnemon';
  if (message?.role !== 'user' || !source || typeof source.kind !== 'string' || ['user', 'model', 'tool', 'system-prompt', 'runtime-context', 'agent-instructions', 'prompt-composition', 'prompt-composition-cleared', 'prompt-composition-state'].includes(source.kind) || mnemon && source.form !== 'instructions' || !['instructions', 'catalog', 'snapshot'].includes(source.form)) return undefined;
  if (source.form === 'snapshot' && (!Array.isArray(source.sections) || source.sections.some(section => typeof section?.name !== 'string' || typeof section.text !== 'string'))) return undefined;
  const name = typeof source.name === 'string' ? source.name : '';
  // Only Mnemon instructions participate; recall and memory-snapshot lifecycle stays producer-owned.
  const owner = mnemon ? 'dsh-mnemon' : null;
  const groupId = owner ? 'owner:' + encodeURIComponent(owner) : 'message-source:' + encodeURIComponent(source.kind);
  return { id: `message:${encodeURIComponent(source.kind)}:${source.form}:${encodeURIComponent(name)}`, owner, kind: 'message', label: name ? `${source.kind}: ${name}` : `${source.kind} (${source.form})`, name: source.kind, groupId, groupLabel: source.kind, parent: groupId, defaultRole: 'user', form: source.form,
    defaultPlacement: source.form === 'snapshot' ? 'state' : 'fixed',
    opaque: message.content.some(block => block.type !== 'text'), text: message.content.filter(block => block.type === 'text').map(block => block.text).join('\n') };
}
const managedInjection = message => {
  const descriptor = promptMessageDescriptor(message);
  return descriptor !== undefined && !descriptor.opaque;
};

const messageOf = event => event?.type === 'user/message' ? event.data : event?.data?.message;
const owned = message => message?.source?.kind === 'prompt-composition';
const replace = (session, seq, message) => session.append('user/message', message, { surfaceOp: { op: 'replace', startSeq: seq, endSeq: seq }, sourceEventSeqs: [seq] });
const empty = source => createUserMessage({ content: [], source });
const mnemonData = source => source?.kind === 'dsh-mnemon' && ['recall', 'memory-snapshot'].includes(source.form);
const mnemonDataId = id => typeof id === 'string' && /^message:dsh-mnemon:(recall|memory-snapshot):/.test(id);
function restoreAuthority(message) {
  const { compositionAuthority, compositionOriginalContent, compositionOriginalId, ...source } = message.source;
  return freezeMessage({ ...message, id: compositionOriginalId ?? message.id, content: compositionOriginalContent ?? [], source });
}

export function hasPromptComposition(session) {
  return session.surface.nodes.some(seq => {
    const source = messageOf(session.eventAt(seq))?.source;
    return source?.kind === 'prompt-composition-state' || source?.kind === 'prompt-composition' || source?.compositionAuthority === true;
  });
}
/** Append while all previous system authorities survive in their original relative order. */
export function canAppendPromptCompositionSystem(session, plan) {
  if (!Array.isArray(plan?.systemSourceIds)) return false;
  for (const seq of [...session.surface.nodes].reverse()) {
    const source = messageOf(session.eventAt(seq))?.source;
    if (source?.kind !== 'prompt-composition-state') continue;
    if (!Array.isArray(source.systemSourceIds)) return false;
    let retained = 0;
    for (const id of plan.systemSourceIds) if (id === source.systemSourceIds[retained]) retained++;
    return retained === source.systemSourceIds.length;
  }
  return false;
}
/** Explicit host-owned validation, before session admission and request freezing. */
export function validatePromptComposition(plan) {
  if (plan?.version !== 1 || typeof plan.systemText !== 'string' || !Array.isArray(plan.contributions) || plan.contributions.some(item => !item || typeof item.id !== 'string' || item.role !== 'user' || typeof item.text !== 'string' || Object.hasOwn(item, 'placement') && !['fixed', 'state'].includes(item.placement)) || new Set(plan.contributions.map(item => item.id)).size !== plan.contributions.length || Object.hasOwn(plan, 'configKey') && typeof plan.configKey !== 'string' || Object.hasOwn(plan, 'systemSourceIds') && (!Array.isArray(plan.systemSourceIds) || plan.systemSourceIds.some(id => typeof id !== 'string') || new Set(plan.systemSourceIds).size !== plan.systemSourceIds.length) || Object.hasOwn(plan, 'excludedIds') && (!Array.isArray(plan.excludedIds) || plan.excludedIds.some(id => typeof id !== 'string' || plan.contributions.some(item => item.id === id)))) throw new Error('Invalid trusted prompt-composition admission plan');
}
const placementOf = item => item.placement ?? 'fixed'; // Legacy v1 plans.
const digest = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const textOf = message => message.content.filter(block => block.type === 'text').map(block => block.text).join('\n');
const descriptor = item => ({ id: item.id, contentKey: digest(item.text) });
const clear = (session, seq) => replace(session, seq, empty({ kind: 'prompt-composition-cleared' }));
function reconcileGroup(session, retained, contributions, placement, previousOrder, configured) {
  const key = digest(contributions.map(descriptor));
  const projected = (contribution, slot, text, extra = {}) => createUserMessage({
    content: [{ type: 'text', text }],
    source: { kind: 'prompt-composition', version: 1, placement, key, slot, contributionId: contribution.id, contentKey: digest(contribution.text), ...extra },
  });
  const append = message => session.append('user/message', message, { surfaceOp: 'append' });
  if (placement === 'state') {
    const latest = retained.at(-1)?.message.source;
    const present = latest?.snapshotKey ? retained.filter(record => record.message.source.snapshotKey === latest.snapshotKey && record.message.source.operation !== 'remove') : retained;
    const prior = present.map(({ message }) => ({ id: message.source.contributionId, contentKey: message.source.contentKey ?? digest(textOf(message)) }));
    if (digest(prior) === key) return latest?.snapshotKey ?? key;
    // A value can recur after an intervening snapshot; generation identity must remain unique.
    const snapshotKey = key + ':' + (session.seq + 1);
    const intro = 'Updated prompt-composition state snapshot. This complete snapshot supersedes all earlier prompt-composition state snapshots, including legacy state projections. Only the sources listed here remain active; omitted state sources no longer apply.\nActive state sources: ' + JSON.stringify(contributions.map(item => item.id)) + '\n\n';
    if (!contributions.length) append(projected({ id: '', text: '' }, 0, intro + 'The state snapshot is empty.', { snapshotKey, operation: 'remove' }));
    contributions.forEach((item, slot) => append(projected(item, slot, (slot === 0 ? intro : '') + item.text, { snapshotKey, operation: 'set' })));
    return snapshotKey;
  }
  const current = new Map();
  for (const record of retained) {
    const { contributionId, operation } = record.message.source;
    if (operation === 'remove') current.delete(contributionId);
    else current.set(contributionId, record);
  }
  const ids = contributions.map(item => item.id), expected = new Set(ids);
  const oldOrder = (previousOrder ?? [...current.keys()]).filter(id => current.has(id) && expected.has(id));
  const commonOrder = ids.filter(id => current.has(id));
  // A content update never reorders existing slots. Explicit ordering changes may
  // reproject only the necessary fixed suffix; unrelated state settings leave it alone.
  let suffix = ids.length;
  if (JSON.stringify(oldOrder) !== JSON.stringify(commonOrder) || configured && JSON.stringify(previousOrder ?? []) !== JSON.stringify(ids)) {
    suffix = 0;
    while (suffix < ids.length && ids[suffix] === oldOrder[suffix]) suffix++;
    const moved = new Set(ids.slice(suffix));
    for (const { seq, message } of retained) if (moved.has(message.source.contributionId)) clear(session, seq);
    for (const id of moved) current.delete(id);
  }
  for (const id of current.keys()) if (!expected.has(id)) append(projected({ id, text: '' }, -1, 'Instructions removed: ' + id + '\n\nThe previously loaded instructions from this source no longer apply.', { operation: 'remove' }));
  contributions.forEach((item, slot) => {
    const old = current.get(item.id);
    if (old && (old.message.source.contentKey ?? digest(textOf(old.message))) === digest(item.text)) return;
    const intro = old || retained.length ? 'Updated instructions from prompt source: ' + item.id + '\n\nUse the following content instead of all previously loaded instructions from this source. Other fixed sources remain in effect.\n\n' : '';
    append(projected(item, slot, intro + item.text, { operation: 'set' }));
  });
  return key;
}
export function commitPromptComposition(session, plan, messages, firstAttempt) {
  validatePromptComposition(plan);
  const controls = session.surface.nodes.map(seq => ({ seq, message: messageOf(session.eventAt(seq)) })).filter(record => record.message?.source?.kind === 'prompt-composition-state');
  const control = controls.at(-1), previous = control?.message.source;
  const retained = { fixed: [], state: [] }, groups = { fixed: [], state: [] };
  const placements = new Map(plan.contributions.map(item => [item.id, placementOf(item)]));
  const excluded = new Set(plan.excludedIds ?? []), legacyStateIds = new Set(previous?.legacyStateIds ?? previous?.stateIds ?? []);
  for (const contribution of plan.contributions) groups[placementOf(contribution)].push(contribution);
  for (const seq of [...session.surface.nodes]) {
    const event = session.eventAt(seq), message = messageOf(event);
    if (event?.type === 'user/message' && message.source?.compositionAuthority && mnemonData(message.source)) {
      // Restore producer identity and position before withdrawing its legacy projections.
      replace(session, seq, restoreAuthority(message));
    } else if (owned(message) && mnemonDataId(message.source.contributionId)) clear(session, seq);
    else if (owned(message)) {
      // Old mixed projections carried no placement; infer it without rewriting their
      // visible messages. The hidden control preserves this inference across reopen.
      const id = message.source.contributionId;
      const placement = message.source.placement ?? (legacyStateIds.has(id) ? 'state' : placements.get(id) ?? 'fixed');
      if (!message.source.placement && placement === 'state') legacyStateIds.add(id);
      if (excluded.has(id) || placements.has(id) && placements.get(id) !== placement) clear(session, seq);
      else retained[placement].push({ seq, message });
    } else if (event?.type === 'user/message' && (message.source.kind === 'runtime-context' || (message.source.kind === 'agent-instructions' || managedInjection(message)) && !message.source.compositionAuthority)) {
      // Preserve instruction authority for its owner while moving only trusted prompt content.
      const source = message.source.kind === 'runtime-context' ? { kind: 'prompt-composition-cleared' } : { ...message.source, compositionAuthority: true, compositionOriginalId: message.id, compositionOriginalContent: message.content };
      replace(session, seq, empty(source));
    }
  }
  const configured = previous?.configKey !== undefined && plan.configKey !== undefined && previous.configKey !== plan.configKey;
  const fixedKey = reconcileGroup(session, retained.fixed, groups.fixed, 'fixed', previous?.fixedOrder, configured);
  if (firstAttempt) for (const message of messages) {
    if (message.source.kind === 'runtime-context') continue;
    if (message.source.kind === 'agent-instructions' || managedInjection(message)) {
      // Retain exact producer input in a durable authority node without briefly admitting
      // and replacing a visible message that no model request has seen.
      session.append('user/message', empty({ ...message.source, compositionAuthority: true, compositionOriginalId: message.id, compositionOriginalContent: message.content }), { surfaceOp: 'append' });
    } else session.append('user/message', message, { surfaceOp: 'append' });
  }
  const stateKey = reconcileGroup(session, retained.state, groups.state, 'state');
  const source = { kind: 'prompt-composition-state', version: 1, ...(plan.configKey !== undefined ? { configKey: plan.configKey } : {}), ...(plan.systemSourceIds !== undefined ? { systemSourceIds: [...plan.systemSourceIds] } : {}), fixedOrder: groups.fixed.map(item => item.id), legacyStateIds: [...legacyStateIds], fixedKey, stateKey };
  // Empty control nodes never enter model context. Replacing this bookkeeping node
  // preserves visible message bytes and lets replay identify latest vs historical snapshots.
  if (JSON.stringify(previous) !== JSON.stringify(source)) {
    if (control) replace(session, control.seq, empty(source));
    else session.append('user/message', empty(source), { surfaceOp: 'append' });
  }
}

/** Disabling composition restores original source messages, with durable surface replacements. */
export function restorePromptComposition(session) {
  for (const seq of [...session.surface.nodes]) {
    const event = session.eventAt(seq), message = messageOf(event);
    if (owned(message) || message?.source?.kind === 'prompt-composition-state') replace(session, seq, empty({ kind: 'prompt-composition-cleared' }));
    else if (event?.type === 'user/message' && message.source?.compositionAuthority) replace(session, seq, restoreAuthority(message));
  }
}
