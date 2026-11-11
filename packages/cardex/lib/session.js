/**
 * Read the archived transcript out of the DSH session log.
 *
 * The log is the durable source of truth (compaction rewrites the model surface,
 * so it is not usable for archival). Only events after the draft's start
 * sequence participate, and only user-authored messages qualify: the harness
 * also stores injected user-role messages (schedules, approvals, titles) that
 * are not part of the discussion.
 */
import { createHash } from 'node:crypto';

const USER = 'user/message';
const ASSISTANT = 'assistant/message';
const SELECTION = 'model/selection';

/** Stable record identity: the draft plus the exact transcript, so a retry cannot duplicate. */
export function recordId(draftId, messages) {
  return createHash('sha256').update(JSON.stringify({ draftId, messages })).digest('hex').slice(0, 20);
}

function textOf(content) {
  if (!Array.isArray(content)) return '';
  return content
    .filter((block) => block && block.type === 'text' && typeof block.text === 'string')
    .map((block) => block.text)
    .join('\n')
    .trim();
}

function timeOf(event) {
  const value = event.time;
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = Date.parse(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return Date.now();
}

export function maxSeq(events) {
  let max = 0;
  for (const event of events) if (typeof event.seq === 'number' && event.seq > max) max = event.seq;
  return max;
}

/** Latest recorded model selection, used when the plugin has no fixed model. */
export function selectedModel(events, limit = Infinity) {
  let model;
  for (const event of events) {
    if (typeof event.seq === 'number' && event.seq > limit) continue;
    if (event.type !== SELECTION) continue;
    const data = event.data ?? {};
    if (typeof data.provider === 'string' && data.provider && typeof data.model === 'string' && data.model) model = `${data.provider}/${data.model}`;
  }
  return model;
}

/**
 * Extract the discussion as `{messages, model, pending}`.
 * `pending` is true when the last user turn has no visible answer yet, so an
 * archive would capture a question without its answer.
 */
export function extractTranscript(events, startSeq) {
  const messages = [];
  let model;
  let pending = false;
  for (const event of events) {
    if (typeof event.seq === 'number' && event.seq <= startSeq) continue;
    if (event.type === SELECTION) {
      const data = event.data ?? {};
      if (typeof data.provider === 'string' && data.provider && typeof data.model === 'string' && data.model) model = `${data.provider}/${data.model}`;
      continue;
    }
    if (event.type === USER) {
      const data = event.data ?? {};
      if (data.source?.kind !== 'user') continue;
      const text = textOf(data.content);
      if (!text) continue;
      messages.push({ role: 'user', text, timestamp: timeOf(event) });
      pending = true;
      continue;
    }
    if (event.type === ASSISTANT) {
      const data = event.data ?? {};
      const text = textOf(data.message?.content);
      if (!text) continue;
      const message = { role: 'assistant', text, timestamp: timeOf(event) };
      if (model) message.model = model;
      messages.push(message);
      pending = false;
    }
  }
  return { messages, model, pending };
}

/** Read one session log through the harness query service and extract the discussion. */
export async function readDiscussion(sessionQuery, sessionId, startSeq) {
  const snapshot = await sessionQuery.readSession(sessionId);
  const events = Array.isArray(snapshot?.events) ? snapshot.events : [];
  return { ...extractTranscript(events, startSeq), events };
}
