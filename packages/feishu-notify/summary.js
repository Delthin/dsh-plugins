import { z } from 'zod';

const MAX_TURNS = 8;
const MAX_CALLS = 32;
export const SUMMARY_KEY = 'feishuNotifySummary';
// Strip obsolete v1 text/source fields on restore while retaining receipts and pending calls.
const turnSchema = z.object({
  turn: z.number().int().nonnegative(),
  manualSent: z.boolean(), calls: z.array(z.string().max(512)).max(MAX_CALLS)
});
const emptyTurn = turn => ({ turn, manualSent: false, calls: [] });
function successfulManual(content, turn) {
  for (const block of content ?? []) {
    if (block.type !== 'text' || typeof block.text !== 'string' || block.text.length > 10000) continue;
    try {
      const result = JSON.parse(block.text);
      if (result?.kind === 'manual' && result.status === 'success' && result.turn === turn) return true;
    } catch { /* Other tool output is not a notification receipt. */ }
  }
  return false;
}
export const summaryProjection = {
  key: SUMMARY_KEY, stateVersion: 1,
  stateSchema: z.object({ currentTurn: z.number().int().nonnegative().nullable(), turns: z.array(turnSchema).max(MAX_TURNS) }).strict(),
  init: () => ({ currentTurn: null, turns: [] }),
  apply(state, event) {
    const d = event.data;
    if (event.type === 'turn/start') {
      if (state.currentTurn === d.turn && state.turns.some(row => row.turn === d.turn)) return state;
      return { currentTurn: d.turn, turns: [...state.turns.filter(row => row.turn !== d.turn), emptyTurn(d.turn)].slice(-MAX_TURNS) };
    }
    const nested = event.type === 'tool/ptc-dispatch-start' || event.type === 'tool/ptc-dispatch';
    const turn = event.type === 'tool/ptc-dispatch' ? state.turns.find(row => row.calls.includes(d.subCallId))?.turn : nested ? state.currentTurn : d.turn;
    const index = state.turns.findIndex(row => row.turn === turn);
    if (index < 0) return state;
    const row = state.turns[index];
    let next = row;
    if ((event.type === 'tool/call' || event.type === 'tool/ptc-dispatch-start') && d.name === 'notify_user') {
      const id = nested ? d.subCallId : d.callId;
      if (typeof id !== 'string' || id.length > 512 || row.calls.includes(id)) return state;
      next = { ...row, calls: [...row.calls, id].slice(-MAX_CALLS) };
    } else if (event.type === 'tool/result' || event.type === 'tool/ptc-dispatch') {
      const message = nested ? { toolCallId: d.subCallId, isError: d.isError, content: d.content } : d.message;
      if (!row.calls.includes(message.toolCallId)) return state;
      next = { ...row, calls: row.calls.filter(id => id !== message.toolCallId), manualSent: row.manualSent || (!message.isError && successfulManual(message.content, row.turn)) };
    } else return state;
    return { ...state, turns: state.turns.map((value, i) => i === index ? next : value) };
  }
};
export function turnSummary(state, turn = state?.currentTurn) { return state?.turns.find(row => row.turn === turn); }
export function phoneLine(value, limit = 32) {
  const chars = Array.from(String(value ?? '').replace(/\s+/g, ' ').trim());
  return chars.length <= limit ? chars.join('') : chars.slice(0, limit - 1).join('') + '…';
}
export function compactSummary(value) {
  const raw = String(value ?? '').replace(/^状态：本轮已结束（摘要暂不可用）\s*\n回复摘录：/, '').replace(/^回复摘录：/, '').trim();
  const rows = [], seen = new Set(); let structured = false;
  for (const line of raw.split(/\r?\n/)) {
    const clean = line.trim().replace(/^[-*]\s+/, '').replace(/\*\*([^*\n]+)\*\*/g, '$1');
    const match = /^(已完成|未完成|需你处理)[：:]\s*(.+)$/.exec(clean) ?? /^(✅|❌|👉)\s*(.+)$/.exec(clean);
    if (!match) continue;
    structured = true;
    const fact = match[2].trim();
    if (/^(?:无|暂无|未说明|不适用|无需处理|无需你处理|无待办|无未完成事项|无待处理事项)[。.!！]?$/u.test(fact)) continue;
    const identity = fact.replace(/[\s，。,.；;！!？?]/g, '');
    if (seen.has(identity)) continue;
    seen.add(identity);
    const icon = ({ 已完成: '✅', 未完成: '❌', 需你处理: '👉' })[match[1]] ?? match[1];
    rows.push(icon + ' ' + phoneLine(fact));
    if (rows.length === 3) break;
  }
  return rows.length ? rows.join('\n') : structured ? 'ℹ️ 未说明具体工作状态' : 'ℹ️ ' + phoneLine(raw || '本轮没有可见回复');
}
