import { createUserMessage } from '@deepseek-ai/dsh-llm';
import { createHash } from 'node:crypto';

// ContextFormed is the host's explicit semantic envelope, not a text/title heuristic.
export function promptMessageDescriptor(message) {
  const source = message?.source;
  const mnemon = source?.kind === 'dsh-mnemon' && ['instructions', 'recall'].includes(source.form);
  if (message?.role !== 'user' || !source || typeof source.kind !== 'string' || ['user', 'model', 'tool', 'system-prompt', 'runtime-context', 'agent-instructions', 'prompt-composition', 'prompt-composition-cleared', 'prompt-composition-state'].includes(source.kind) || !(['instructions', 'catalog', 'snapshot'].includes(source.form) || mnemon)) return undefined;
  if (source.form === 'snapshot' && (!Array.isArray(source.sections) || source.sections.some(section => typeof section?.name !== 'string' || typeof section.text !== 'string'))) return undefined;
  const name = typeof source.name === 'string' ? source.name : '';
  // Explicit compatibility with dsh-mnemon's own createPluginMessage factory.
  // Its runtime-memory state uses recall; unrelated recall/relay messages stay data.
  const owner = mnemon ? 'dsh-mnemon' : null;
  const groupId = owner ? 'owner:' + encodeURIComponent(owner) : 'message-source:' + encodeURIComponent(source.kind);
  return { id: `message:${encodeURIComponent(source.kind)}:${source.form}:${encodeURIComponent(name)}`, owner, kind: 'message', label: name ? `${source.kind}: ${name}` : `${source.kind} (${source.form})`, name: source.kind, groupId, groupLabel: source.kind, parent: groupId, defaultRole: 'user', form: mnemon && source.form === 'recall' ? 'snapshot' : source.form,
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

export function hasPromptComposition(session) {
  return session.surface.nodes.some(seq => {
    const source = messageOf(session.eventAt(seq))?.source;
    return source?.kind === 'prompt-composition-state' || source?.kind === 'prompt-composition' || source?.compositionAuthority === true;
  });
}
/** Explicit host-owned validation, before session admission and request freezing. */
export function validatePromptComposition(plan) {
  if (plan?.version !== 1 || typeof plan.systemText !== 'string' || !Array.isArray(plan.contributions) || plan.contributions.some(item => !item || typeof item.id !== 'string' || item.role !== 'user' || typeof item.text !== 'string')) throw new Error('Invalid trusted prompt-composition admission plan');
}
export function commitPromptComposition(session, plan, messages, firstAttempt) {
  validatePromptComposition(plan);
  if (!session.surface.nodes.some(seq => messageOf(session.eventAt(seq))?.source?.kind === 'prompt-composition-state')) session.append('user/message', empty({ kind: 'prompt-composition-state', version: 1 }), { surfaceOp: 'append' });
  const key = createHash('sha256').update(JSON.stringify(plan.contributions)).digest('hex');
  const retained = [];
  for (const seq of [...session.surface.nodes]) {
    const event = session.eventAt(seq), message = messageOf(event);
    if (owned(message)) retained.push({ seq, message });
    else if (event?.type === 'user/message' && (message.source.kind === 'runtime-context' || (message.source.kind === 'agent-instructions' || managedInjection(message)) && !message.source.compositionAuthority)) {
      // Preserve instruction authority for its owner while moving only trusted prompt content.
      const source = message.source.kind === 'runtime-context' ? { kind: 'prompt-composition-cleared' } : { ...message.source, compositionAuthority: true, compositionOriginalId: message.id, compositionOriginalContent: message.content };
      replace(session, seq, empty(source));
    }
  }
  const unchanged = retained.length === plan.contributions.length && retained.every(({ message }, index) => message.source.key === key && message.source.slot === index);
  if (!unchanged) {
    for (const { seq } of retained) replace(session, seq, empty({ kind: 'prompt-composition-cleared' }));
    for (const [slot, contribution] of plan.contributions.entries()) session.append('user/message', createUserMessage({
      content: [{ type: 'text', text: contribution.text }],
      source: { kind: 'prompt-composition', version: 1, key, slot, contributionId: contribution.id }
    }), { surfaceOp: 'append' });
  }
  if (firstAttempt) for (const message of messages) {
    if (message.source.kind === 'runtime-context') continue;
    if (message.source.kind === 'agent-instructions' || managedInjection(message)) {
      // Original producer input remains a durable audit event; the authority node carries
      // exact file blocks and changes so its normal reconciliation can rebuild after resume.
      const recorded = session.append('user/message', message, { surfaceOp: 'append' });
      replace(session, recorded.seq, empty({ ...message.source, compositionAuthority: true, compositionOriginalId: message.id, compositionOriginalContent: message.content }));
    } else session.append('user/message', message, { surfaceOp: 'append' });
  }
}

/** Disabling composition restores original source messages, with durable surface replacements. */
export function restorePromptComposition(session) {
  for (const seq of [...session.surface.nodes]) {
    const event = session.eventAt(seq), message = messageOf(event);
    if (owned(message) || message?.source?.kind === 'prompt-composition-state') replace(session, seq, empty({ kind: 'prompt-composition-cleared' }));
    else if (event?.type === 'user/message' && message.source?.compositionAuthority) {
      const { compositionAuthority, compositionOriginalContent, compositionOriginalId, ...source } = message.source;
      replace(session, seq, createUserMessage({ content: compositionOriginalContent ?? [], source }));
    }
  }
}
