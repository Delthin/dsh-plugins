import { readFile, open, rename, unlink } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { randomUUID, createHash } from 'node:crypto';
import { SummaryGenerator, excerpt, summaryFallback, compactSummary, phoneLine } from './summary.js';

export const DEFAULT_CONFIG = Object.freeze({ appId: '', appSecret: '', receive_id: '', enabled: false, quietHours: { enabled: false, start: '22:00', end: '08:00', timeZone: 'Asia/Shanghai' } });
export class NotifyError extends Error {
  constructor(message, code = 'INTERNAL', status = 400) { super(message); this.code = code; this.status = status; }
}
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
export function receiveIdType(id) {
  if (id.startsWith('ou_')) return 'open_id';
  if (id.startsWith('oc_')) return 'chat_id';
  return null;
}
export function validateConfig(patch, current = DEFAULT_CONFIG) {
  if (!object(patch)) throw new NotifyError('config 必须是对象', 'INVALID_CONFIG');
  const allowed = ['appId', 'appSecret', 'receive_id', 'enabled', 'quietHours'];
  if (Object.keys(patch).some(key => !allowed.includes(key))) throw new NotifyError('存在未知配置字段', 'INVALID_CONFIG');
  const config = { ...current, ...patch, quietHours: { ...current.quietHours, ...patch.quietHours } };
  for (const key of ['appId', 'appSecret', 'receive_id']) {
    if (typeof config[key] !== 'string' || config[key].length > 4096) throw new NotifyError(`${key} 必须是长度不超过 4096 的字符串`, 'INVALID_CONFIG');
    config[key] = config[key].trim();
  }
  if (config.appSecret === '***') config.appSecret = current.appSecret;
  if (typeof config.enabled !== 'boolean') throw new NotifyError('enabled 必须是布尔值', 'INVALID_CONFIG');
  if (patch.quietHours !== undefined && (!object(patch.quietHours) || Object.keys(patch.quietHours).some(key => !['enabled', 'start', 'end', 'timeZone'].includes(key)))) throw new NotifyError('quietHours 配置无效', 'INVALID_CONFIG');
  const q = config.quietHours;
  if (typeof q.enabled !== 'boolean' || !/^([01]\d|2[0-3]):[0-5]\d$/.test(q.start) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(q.end) || typeof q.timeZone !== 'string') throw new NotifyError('免打扰时间必须使用 HH:mm', 'INVALID_CONFIG');
  try { new Intl.DateTimeFormat('en', { timeZone: q.timeZone }).format(); } catch { throw new NotifyError('时区无效', 'INVALID_CONFIG'); }
  if (config.receive_id && !receiveIdType(config.receive_id)) throw new NotifyError('receive_id 必须以 ou_（open_id）或 oc_（chat_id）开头', 'INVALID_CONFIG');
  return config;
}
export function maskConfig(config) { return { ...config, appSecret: config.appSecret ? '***' : '', quietHours: { ...config.quietHours } }; }
export function isSubagent(session) { return session?.header?.origin === 'subagent' || (session?.header?.delegationDepth ?? 0) > 0; }
export function inQuietHours(config, time = Date.now()) {
  const q = config.quietHours;
  if (!q.enabled) return false;
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone: q.timeZone, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(time);
  const now = parts.find(p => p.type === 'hour').value + ':' + parts.find(p => p.type === 'minute').value;
  return q.start === q.end || (q.start < q.end ? now >= q.start && now < q.end : now >= q.start || now < q.end);
}
export class ConfigStore {
  constructor(profileDir) { this.path = resolve(profileDir, 'feishu-notify.json'); this.config = structuredClone(DEFAULT_CONFIG); this.queue = Promise.resolve(); }
  serial(fn) { const job = this.queue.then(fn); this.queue = job.catch(() => {}); return job; }
  async read() {
    try { this.config = validateConfig(JSON.parse(await readFile(this.path, 'utf8')), DEFAULT_CONFIG); }
    catch (error) { if (error.code !== 'ENOENT') throw new NotifyError('无法读取飞书配置，请检查 feishu-notify.json', 'CONFIG_READ', 500); this.config = structuredClone(DEFAULT_CONFIG); }
    return structuredClone(this.config);
  }
  load() { return this.serial(() => this.read()); }
  save(patch) {
    return this.serial(async () => {
      const next = validateConfig(patch, await this.read());
      const temp = this.path + '.' + randomUUID() + '.tmp';
      // Both resolved rename targets are deliberately confined to the profile directory.
      if (dirname(temp) !== dirname(this.path) || !this.path.endsWith('/feishu-notify.json')) throw new NotifyError('配置路径无效', 'CONFIG_PATH', 500);
      let handle;
      try {
        handle = await open(temp, 'wx', 0o600);
        await handle.writeFile(JSON.stringify(next, null, 2) + '\n');
        await handle.sync(); await handle.close(); handle = undefined;
        await rename(temp, this.path); this.config = next;
      } catch {
        await handle?.close().catch(() => {});
        await unlink(temp).catch(() => {});
        throw new NotifyError('无法保存飞书配置', 'CONFIG_WRITE', 500);
      }
      return structuredClone(next);
    });
  }
}

const BASE = 'https://open.feishu.cn/open-apis';
export class FeishuClient {
  constructor({ fetch: fetchImpl = globalThis.fetch, now = Date.now, timeoutMs = 5000 } = {}) {
    this.fetch = fetchImpl; this.now = now; this.timeoutMs = timeoutMs;
    this.credentials = ''; this.generation = 0; this.token = null; this.flight = null;
    this.controllers = new Set(); this.closed = false; this.sensitive = new Set();
  }
  redact(value, limit = 500) {
    let text = String(value ?? '');
    for (const secret of this.sensitive) if (secret) text = text.split(secret).join('***');
    return text.replace(/Bearer\s+\S+/gi, 'Bearer ***').slice(0, limit);
  }
  setCredentials(config) {
    const credentials = JSON.stringify([config.appId, config.appSecret]);
    if (credentials !== this.credentials) {
      this.credentials = credentials; this.generation++; this.token = null; this.flight = null;
      if (config.appSecret) this.sensitive.add(config.appSecret);
    }
  }
  async request(path, body, token, signal) {
    for (let attempt = 0; attempt < 4; attempt++) {
      if (this.closed || signal?.aborted) throw new NotifyError('请求已取消', 'CANCELLED', 499);
      const controller = new AbortController(); this.controllers.add(controller);
      const abort = () => controller.abort(); signal?.addEventListener('abort', abort, { once: true });
      const timer = setTimeout(abort, this.timeoutMs);
      let detach;
      const cancelled = new Promise((_, reject) => {
        const listener = () => reject(new NotifyError(this.closed || signal?.aborted ? '请求已取消' : '飞书请求超时', this.closed || signal?.aborted ? 'CANCELLED' : 'TIMEOUT', this.closed || signal?.aborted ? 499 : 504));
        controller.signal.addEventListener('abort', listener, { once: true });
        detach = () => controller.signal.removeEventListener('abort', listener);
      });
      try {
        const result = await Promise.race([(async () => {
          const response = await this.fetch(BASE + path, { method: 'POST', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) }, body: JSON.stringify(body), signal: controller.signal });
          let data;
          try { data = await response.json(); }
          catch { if (response.status >= 500) throw new NotifyError('飞书服务暂时不可用', 'HTTP_5XX', 502); throw new NotifyError('飞书返回了无效 JSON', 'INVALID_RESPONSE', 502); }
          if (data && Object.hasOwn(data, 'code') && data.code !== 0) throw new NotifyError('飞书业务错误：' + this.redact(data.msg ?? '请求失败'), typeof data.code === 'number' && Number.isFinite(data.code) ? 'FEISHU_' + data.code : 'FEISHU_BUSINESS', 502);
          if (response.status >= 500) throw new NotifyError('飞书服务暂时不可用', 'HTTP_5XX', 502);
          if (!response.ok) throw new NotifyError('飞书 HTTP 请求失败（' + response.status + '）', 'HTTP_' + response.status, 502);
          if (data?.code !== 0) throw new NotifyError('飞书响应缺少成功 code', 'INVALID_RESPONSE', 502);
          return data;
        })(), cancelled]);
        return result;
      } catch (error) {
        const safe = error instanceof NotifyError ? error : new NotifyError('无法连接飞书服务', 'NETWORK', 502);
        if (attempt === 3 || !['NETWORK', 'HTTP_5XX', 'TIMEOUT'].includes(safe.code)) throw safe;
      } finally {
        clearTimeout(timer); detach(); signal?.removeEventListener('abort', abort); this.controllers.delete(controller);
      }
    }
  }
  getToken(config) {
    this.setCredentials(config);
    if (this.token && this.now() < this.token.expiresAt - 60000) return Promise.resolve(this.token.value);
    if (this.flight) return this.flight;
    const generation = this.generation;
    const startedAt = this.now();
    const flight = this.request('/auth/v3/tenant_access_token/internal', { app_id: config.appId, app_secret: config.appSecret }).then(data => {
      if (typeof data.tenant_access_token !== 'string' || !data.tenant_access_token || !Number.isFinite(data.expire) || data.expire <= 0) throw new NotifyError('飞书 token 响应无效', 'INVALID_TOKEN', 502);
      this.sensitive.add(data.tenant_access_token);
      if (generation === this.generation) this.token = { value: data.tenant_access_token, expiresAt: startedAt + data.expire * 1000 };
      return data.tenant_access_token;
    }).finally(() => { if (this.flight === flight) this.flight = null; });
    this.flight = flight; return flight;
  }
  async send(config, text, uuid, signal) {
    const token = await this.getToken(config);
    if (signal?.aborted) throw new NotifyError('请求已取消', 'CANCELLED', 499);
    const data = await this.request('/im/v1/messages?receive_id_type=' + receiveIdType(config.receive_id), { receive_id: config.receive_id, msg_type: 'text', content: JSON.stringify({ text }), uuid }, token, signal);
    return data.data?.message_id;
  }
  dispose() { this.closed = true; for (const controller of this.controllers) controller.abort(); this.controllers.clear(); this.token = null; this.flight = null; this.sensitive.clear(); }
}

export function eventNotification(session, event) {
  if (isSubagent(session)) return null;
  const d = event.data;
  const sessionId = String(session.id);
  if (event.type === 'approval/asked') return { kind: 'approval', key: `${sessionId}:approval:${d.id}`, sessionId, title: '工具权限待确认', detail: d.toolName };
  if (event.type === 'tool/call' || event.type === 'tool/ptc-dispatch-start') {
    if (d.name !== 'ask_user_question') return null;
    let args; try { args = typeof d.arguments === 'string' ? JSON.parse(d.arguments) : d.arguments; } catch { return null; }
    if (!Array.isArray(args?.questions) || !args.questions.length) return null;
    return questionNotification(session, { questions: args.questions, wait: { callId: d.subCallId ?? d.callId } });
  }
  return null;
}
export function questionNotification(session, req) {
  if (!session || isSubagent(session)) return null;
  const plan = req.questions?.some(q => q.intent?.kind === 'plan-review');
  const callId = req.wait?.callId ?? req.questions?.find(q => q.intent?.callId)?.intent.callId;
  const fingerprint = createHash('sha256').update(JSON.stringify(req.questions ?? [])).digest('hex');
  return { kind: plan ? 'plan' : 'question', key: `${session.id}:question:${callId ?? fingerprint}`, sessionId: String(session.id), title: plan ? '计划待确认' : '问题待回答' };
}

function notificationText(notification, body) {
  if (notification.kind === 'test') return 'DSH 飞书通知测试：连接成功。';
  if (notification.kind === 'completed' || notification.kind === 'manual') return compactSummary(body);
  if (notification.kind === 'error' || notification.kind === 'interrupted') {
    const status = notification.kind === 'error' ? '本轮错误' : '本轮中断';
    const first = '❌ ' + phoneLine(notification.reason ? status + '：' + notification.reason : status);
    return first + (!notification.reason && notification.summary?.text ? '\n' + compactSummary(notification.summary.text).split('\n').slice(0, 2).join('\n') : '');
  }
  return '👉 ' + phoneLine(notification.title + (notification.detail ? '：' + notification.detail : ''));
}

export class FeishuNotifyService {
  constructor({ profile, store = new ConfigStore(profile.dir), client = new FeishuClient(), now = Date.now, llm, summaryTimeoutMs = 8000 }) {
    this.profile = profile; this.store = store; this.client = client; this.now = now;
    this.summaries = new SummaryGenerator({ llm, timeoutMs: summaryTimeoutMs });
    this.results = []; this.seen = new Map(); this.closed = false; this.pending = new Set();
    this.manualTurns = new WeakMap(); this.manualPending = new WeakMap(); this.controllers = new Set();
  }
  wasManualSent(session, turn) { return Boolean(session && this.manualTurns.get(session)?.has(turn)); }
  async manual(session, turn, args, { callId, signal, manualSent = false } = {}) {
    if (!session) return this.record({ kind: 'manual', status: 'failed', code: 'NO_AGENT_SESSION', message: 'notify_user 需要当前 agent 的会话上下文' });
    const base = { kind: 'manual', sessionId: String(session.id), turn };
    if (isSubagent(session)) return this.record({ ...base, status: 'skipped', code: 'SUBAGENT', message: '子代理不发送通知' });
    if (!Number.isSafeInteger(turn) || turn < 0) return this.record({ ...base, status: 'failed', code: 'NO_CURRENT_TURN', message: '无法确定当前回合，未发送通知' });
    if (typeof args.message !== 'string' || !args.message.trim() || args.message.length > 1200 || (args.title !== undefined && (typeof args.title !== 'string' || args.title.length > 120))) return this.record({ ...base, status: 'failed', code: 'INVALID_MESSAGE', message: 'message 必须为 1–1200 字的非空文本，title 不超过 120 字' });
    const title = args.title?.trim() || '工作摘要';
    const body = args.message.trim();
    const hash = createHash('sha256').update(JSON.stringify([title, body])).digest('hex');
    if (manualSent || this.wasManualSent(session, turn)) return this.record({ ...base, status: 'skipped', code: 'MANUAL_SENT', message: '本轮已通过 notify_user 成功发送摘要' });
    const pending = this.manualPending.get(session) ?? new Set();
    if (pending.has(turn)) return this.record({ ...base, status: 'skipped', code: 'MANUAL_PENDING', message: '本轮 notify_user 正在发送，未重复发送' });
    // Reserve before awaiting; different call IDs and bodies still share this turn.
    pending.add(turn); this.manualPending.set(session, pending);
    try {
      const result = await this.notify({ ...base, session, title, body, key: `${session.id}:manual-call:${callId ?? hash}`, dedupeKeys: [`${session.id}:manual-call:${callId ?? hash}`, `${session.id}:manual-content:${hash}`] }, { signal });
      if (result?.status === 'success') {
        const turns = this.manualTurns.get(session) ?? new Set(); turns.add(turn);
        while (turns.size > 8) turns.delete(turns.values().next().value);
        this.manualTurns.set(session, turns);
      }
      return result ?? this.record({ ...base, status: 'failed', code: 'DISPOSED', message: '插件已停止，未发送通知' });
    } finally {
      pending.delete(turn);
      if (!pending.size) this.manualPending.delete(session);
    }
  }
  async config() { const config = await this.store.load(); this.client.setCredentials(config); return config; }
  snapshot(config) { return { config: maskConfig(config), results: this.results.map(row => ({ ...row })), profile: { name: this.profile.name }, configured: Boolean(config.appId && config.appSecret && receiveIdType(config.receive_id)), receiveIdType: receiveIdType(config.receive_id) }; }
  async status() { return this.snapshot(await this.config()); }
  async configure(patch) { if (this.closed) throw new NotifyError('插件已停止', 'DISPOSED', 503); const config = await this.store.save(patch); this.client.setCredentials(config); return this.snapshot(config); }
  record(row) { const result = { id: randomUUID(), time: new Date(this.now()).toISOString(), ...row, ok: row.status === 'success', ...(row.status === 'failed' ? { error: row.message } : {}) }; this.results.unshift(result); this.results.length = Math.min(this.results.length, 20); return result; }
  notify(notification, { bypass = false, signal } = {}) {
    if (!notification || this.closed) return Promise.resolve(null);
    // Reserve synchronously, before the first await: concurrent event deliveries cannot both send.
    const now = this.now();
    for (const [key, value] of this.seen) if (!value.pending && value.until <= now) this.seen.delete(key);
    const keys = notification.dedupeKeys ?? [notification.key];
    if (keys.some(key => this.seen.has(key))) return Promise.resolve(this.record({ kind: notification.kind, sessionId: notification.sessionId, ...(notification.turn !== undefined ? { turn: notification.turn } : {}), status: 'skipped', code: 'DUPLICATE', message: '60 秒内重复事件或内容已跳过' }));
    const reservation = { until: now + 60000, pending: true }; for (const key of keys) this.seen.set(key, reservation);
    const controller = new AbortController(); this.controllers.add(controller);
    const abort = () => controller.abort(); signal?.addEventListener('abort', abort, { once: true });
    if (signal?.aborted) abort();
    const job = this.deliver(notification, bypass, controller.signal).finally(() => { reservation.pending = false; reservation.until = this.now() + 60000; this.pending.delete(job); this.controllers.delete(controller); signal?.removeEventListener('abort', abort); });
    this.pending.add(job); return job;
  }
  async deliver(notification, bypass, signal) {
    const base = { kind: notification.kind, sessionId: notification.sessionId, ...(notification.turn !== undefined ? { turn: notification.turn } : {}) };
    let summaryInfo = {};
    try {
      const config = await this.config();
      if (this.closed) throw new NotifyError('插件已停止', 'DISPOSED', 503);
      if (signal?.aborted) throw new NotifyError('请求已取消', 'CANCELLED', 499);
      if (!bypass && isSubagent(notification.session)) return this.record({ ...base, status: 'skipped', code: 'SUBAGENT', message: '子代理不发送通知' });
      if (!bypass && (!config.enabled || inQuietHours(config, this.now()))) return this.record({ ...base, status: 'skipped', code: !config.enabled ? 'DISABLED' : 'QUIET_HOURS', message: !config.enabled ? '通知未启用' : '免打扰时段' });
      const suppressed = () => notification.kind === 'completed' && (notification.summary?.manualSent || this.wasManualSent(notification.session, notification.turn));
      if (suppressed()) return this.record({ ...base, status: 'skipped', code: 'MANUAL_SENT', message: '本轮已通过 notify_user 成功发送摘要' });
      if (!config.appId || !config.appSecret || !receiveIdType(config.receive_id)) throw new NotifyError('请先保存 appId、appSecret 和 receive_id', 'NOT_CONFIGURED');
      let body = notification.body;
      if (notification.kind === 'completed') {
        const summary = notification.summary ? { ...notification.summary, text: this.client.redact(notification.summary.text, 6000) } : undefined;
        const unavailable = this.summaries.unavailableReason(summary);
        const result = unavailable ? summaryFallback(summary, unavailable) : await this.summaries.generateResult(summary, { signal, sessionId: notification.session?.id });
        body = result.text;
        summaryInfo = { summaryStatus: result.summaryStatus, summaryReason: result.summaryReason, ...(result.summaryFailureClass ? { summaryFailureClass: result.summaryFailureClass } : {}), ...(result.summaryHttpStatus !== undefined ? { summaryHttpStatus: result.summaryHttpStatus } : {}), ...(result.summaryFailureHint ? { summaryFailureHint: result.summaryFailureHint } : {}) };
      } else if (notification.kind === 'error' || notification.kind === 'interrupted') {
        body = [notification.reason ? '原因：' + notification.reason : '', notification.summary?.text ? excerpt(notification.summary.text) : ''].filter(Boolean).join('\n');
      }
      if (this.closed || signal?.aborted) throw new NotifyError('请求已取消', 'CANCELLED', 499);
      if (suppressed()) return this.record({ ...base, status: 'skipped', code: 'MANUAL_SENT', message: '本轮已通过 notify_user 成功发送摘要' });
      // Redact before the phone-length cut, so a cut cannot expose a secret prefix.
      const safeNotification = { ...notification, title: this.client.redact(notification.title, 2400), reason: this.client.redact(notification.reason, 2400), detail: this.client.redact(notification.detail, 2400), ...(notification.summary ? { summary: { text: this.client.redact(notification.summary.text, 6000) } } : {}) };
      const text = notificationText(safeNotification, this.client.redact(body, 6000));
      const safeText = this.client.redact(text, 2400);
      const messageId = await this.client.send(config, safeText, randomUUID(), signal);
      return this.record({ ...base, ...summaryInfo, status: 'success', message: notification.kind === 'test' ? '测试消息已发送' : this.client.redact(safeText, 1200), preview: this.client.redact(safeText, 1600), ...(typeof messageId === 'string' && messageId ? { messageId: this.client.redact(messageId) } : {}) });
    } catch (error) {
      const safe = error instanceof NotifyError ? error : new NotifyError('通知发送失败', 'INTERNAL', 500);
      const result = this.record({ ...base, ...summaryInfo, status: 'failed', code: safe.code, message: this.client.redact(safe.message) });
      if (bypass) { safe.result = result; throw safe; }
      return result;
    }
  }
  async test(signal) { const result = await this.notify({ kind: 'test', key: 'test:' + randomUUID(), title: '通知测试' }, { bypass: true, signal }); return { ...await this.status(), result }; }
  async dispose() { this.closed = true; this.summaries.dispose(); for (const controller of this.controllers) controller.abort(); this.client.dispose(); await Promise.allSettled([...this.pending]); this.seen.clear(); this.controllers.clear(); this.manualTurns = new WeakMap(); this.manualPending = new WeakMap(); }
}
