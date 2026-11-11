/**
 * Per-session recording state, keyed by the DSH session id.
 *
 * The session log already carries every message; this table only stores what the
 * log cannot: which discussion is open, where it starts, and the frozen
 * transcript of an archive that failed before it wrote anything. That freeze is
 * what makes `/cardex end` retryable with byte-identical input.
 */
import { z } from 'zod';

const transcriptMessage = z.object({
  role: z.enum(['user', 'assistant']),
  text: z.string(),
  timestamp: z.number(),
  model: z.string().optional(),
  status: z.enum(['error', 'aborted', 'length']).optional(),
});

const draft = z.object({
  id: z.string().min(1),
  directory: z.string().min(1),
  question: z.string(),
  startedAt: z.string(),
  /** Session log sequence at start; only later events belong to this discussion. */
  startSeq: z.number(),
});

const prepared = z.object({
  draftId: z.string().min(1),
  recordId: z.string().min(1),
  messages: z.array(transcriptMessage),
});

export const sessionState = z.object({
  draft: draft.nullable().optional(),
  prepared: prepared.nullable().optional(),
});

/** Table value schema handed to `ctx.storageDomain.open`. */
export const tableValueSchema = sessionState;

function normalize(value) {
  if (!value || typeof value !== 'object') return {};
  return { draft: value.draft ?? null, prepared: value.prepared ?? null };
}

/**
 * Serialize writes per table so two commands cannot interleave a read-modify-write
 * on the same session.
 */
export function createSessionState(table) {
  let writes = Promise.resolve();
  const get = (sessionId) => normalize(table.get(sessionId));
  const update = (sessionId, mutate) => {
    const operation = writes.then(async () => {
      const next = normalize(mutate(get(sessionId)));
      await table.put(sessionId, next);
      return next;
    });
    writes = operation.catch(() => {});
    return operation;
  };
  return {
    get,
    update,
    setDraft: (sessionId, value) => update(sessionId, (current) => ({ ...current, draft: value })),
    setPrepared: (sessionId, value) => update(sessionId, (current) => ({ ...current, prepared: value })),
    clear: (sessionId) => update(sessionId, () => ({})),
    clearDraft: (sessionId) => update(sessionId, (current) => ({ draft: null, prepared: null })),
  };
}
