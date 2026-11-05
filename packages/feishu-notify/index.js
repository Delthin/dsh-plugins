import { AsyncLocalStorage } from 'node:async_hooks';
import { defineTool } from '@deepseek-ai/dsh-tools';
import { FeishuNotifyService, NotifyError, eventNotification, questionNotification } from './core.js';
import { summaryProjection, SUMMARY_KEY, turnSummary } from './summary.js';

export const name = 'feishu-notify';
export const inject = ['profileContext'];
const API = '/api/feishu-notify';
const output = { schema: { type: 'object', additionalProperties: true }, render: (_args, value) => [{ type: 'text', text: JSON.stringify(value) }] };

export async function apply(ctx) {
  const profile = ctx.get('profileContext');
  if (!profile?.dir || !profile?.name) throw new Error('飞书通知需要 profileContext.name/dir');
  const service = new FeishuNotifyService({ profile });
  await service.status();
  ctx.provide('feishuNotify', service);
  ctx.effect(() => () => service.dispose(), 'feishu-notify:dispose');
  let projections;
  ctx.inject(['sessionProjections'], projectionCtx => {
    const registry = projectionCtx.sessionProjections;
    projections = registry;
    registry.register(summaryProjection);
    projectionCtx.effect(() => () => { if (projections === registry) projections = undefined; }, 'feishu-notify:projection-reader');
  });
  ctx.inject(['systemPrompt'], promptCtx => {
    promptCtx.systemPrompt.section({
      name: 'feishu-notify:completion', order: 90,
      text: '用户请求的整体工作持续至少 3 分钟时，在完成或收尾时调用 notify_user 一次。简短说明 ✅ 结果、❌ 仍未完成、👉 待用户处理事项，无对应事项则省略。子任务、中间进度、简短问答、内部异常不通知；同一整体任务已成功通知则不重复。'
    });
  });
  const observe = (notification, session) => {
    if (notification) void service.notify({ ...notification, session }).catch(() => {});
  };
  ctx.on('session/event', (session, event) => {
    observe(eventNotification(session, event), session);
  });
  // Legacy ask_user_question does not pass wait.callId and renames multi_select.
  // Borrow the immutable dispatch identity instead of correlating question text.
  const questionCalls = new AsyncLocalStorage();
  ctx.effect(() => () => questionCalls.disable(), 'feishu-notify:question-calls');
  ctx.on('tools/execute', (execution, next) => execution.name === 'ask_user_question'
    ? questionCalls.run(execution, next) : next(), { prepend: true });
  // A prepended observer sees requests before the existing UI answerer claims them.
  // Approval uses its durable audit event instead; no approval waterfall is needed.
  ctx.on('user-questions/request', (request, next) => {
    const execution = questionCalls.getStore();
    const correlated = !request.wait?.callId && execution?.agent === request.agent && execution?.callId
      ? { ...request, wait: { ...request.wait, callId: execution.callId } } : request;
    observe(questionNotification(request.agent?.session, correlated));
    return next();
  }, { prepend: true });

  ctx.inject(['tools'], toolCtx => {
    toolCtx.tools.register(defineTool({
      name: 'feishu_notify',
      description: '查看当前 profile 的飞书通知状态与最近 20 条结果，保存通知配置，或向保存的接收方发送固定测试消息。测试会发送真实飞书消息且忽略启用开关和免打扰。应用密钥仅在设置页填写，不通过工具读取或提交。',
      parameters: {
        action: { type: 'string', enum: ['status', 'test', 'configure'], required: true, description: 'status 查看；test 发送固定测试消息；configure 保存提供的字段。' },
        config: { type: 'object', description: 'configure 使用的部分配置；省略字段保留原值。', additionalProperties: false, properties: {
          appId: { type: 'string' }, receive_id: { type: 'string', description: 'ou_ 开头为用户 open_id，oc_ 开头为群 chat_id。' }, enabled: { type: 'boolean' },
          quietHours: { type: 'object', additionalProperties: false, properties: { enabled: { type: 'boolean' }, start: { type: 'string', description: 'HH:mm，含起点。' }, end: { type: 'string', description: 'HH:mm，不含终点；与起点相同表示全天。' }, timeZone: { type: 'string', description: 'IANA 时区，例如 Asia/Shanghai。' } } }
        } }
      }, output,
      async execute(args, execution) {
        if (args.action === 'status') return service.status();
        if (args.action === 'test') return service.test(execution.signal);
        if (args.action === 'configure') {
          if (!args.config || Object.hasOwn(args.config, 'appSecret')) throw new NotifyError('请提供非密钥配置；应用密钥请在设置页修改', 'INVALID_CONFIG');
          return service.configure(args.config);
        }
        throw new NotifyError('未知操作', 'INVALID_ACTION');
      }
    }));
    toolCtx.tools.register(defineTool({
      name: 'notify_user',
      description: '向当前 profile 保存的接收方真实发送飞书工作摘要。遵守通知总开关、免打扰和子代理过滤，返回实际 success/skipped/failed 回执。',
      parameters: {
        message: { type: 'string', required: true, description: '非空工作摘要，1200 字以内。' },
        title: { type: 'string', description: '简短通知标题，120 字以内；默认“工作摘要”。' }
      }, output,
      async execute(args, execution) {
        const session = execution.agent?.session;
        const state = session && projections ? projections.stateOf(session, SUMMARY_KEY) : undefined;
        const current = state?.turns.find(row => row.calls.includes(execution.callId)) ?? turnSummary(state);
        return service.manual(session, current?.turn, args, { callId: execution.callId, signal: execution.signal, manualSent: current?.manualSent });
      }
    }));
  });

  // The host owns both route registration and trust/authentication checks.
  ctx.inject(['webServer'], webCtx => {
    webCtx.inject(['connection'], routeCtx => {
      const respond = (res, status, value) => {
        res.statusCode = status;
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.setHeader('Cache-Control', 'no-store');
        res.setHeader('X-Content-Type-Options', 'nosniff');
        res.end(JSON.stringify(value));
      };
      async function handler(req, res) {
        const rejection = routeCtx.connection.requestRejection(req);
        if (rejection !== undefined) return respond(res, rejection, { error: { message: '请通过已登录的 DSH 同源页面访问', code: 'UNAUTHORIZED' } });
        const path = new URL(req.url, 'http://localhost').pathname;
        const isTest = path === API + '/test';
        if ((isTest && req.method !== 'POST') || (!isTest && !['GET', 'PUT'].includes(req.method))) return respond(res, 405, { error: { message: '不支持的 HTTP 方法', code: 'METHOD_NOT_ALLOWED' } });
        const controller = new AbortController();
        const cancel = () => controller.abort();
        req.once('aborted', cancel);
        const closed = () => { if (!res.writableEnded) cancel(); };
        res.once('close', closed);
        try {
          if (req.method === 'GET') return respond(res, 200, await service.status());
          if (!String(req.headers['content-type'] ?? '').toLowerCase().startsWith('application/json')) throw new NotifyError('请求必须使用 application/json', 'CONTENT_TYPE', 415);
          const chunks = []; let bytes = 0;
          for await (const chunk of req) {
            bytes += Buffer.byteLength(chunk);
            if (bytes > 16384) throw new NotifyError('请求不能超过 16 KiB', 'BODY_TOO_LARGE', 413);
            chunks.push(Buffer.from(chunk));
          }
          let body;
          try { body = JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}'); } catch { throw new NotifyError('无效 JSON', 'INVALID_JSON'); }
          if (!body || typeof body !== 'object' || Array.isArray(body)) throw new NotifyError('请求必须是 JSON 对象', 'INVALID_JSON');
          // Test deliberately ignores arbitrary request content and uses saved configuration only.
          const result = isTest ? await service.test(controller.signal) : await service.configure(body.config ?? body);
          return respond(res, 200, result);
        } catch (error) {
          const safe = error instanceof NotifyError ? error : new NotifyError('飞书通知操作失败', 'INTERNAL', 500);
          if (!res.destroyed && !res.writableEnded) respond(res, safe.status, { error: { message: service.client.redact(safe.message), code: safe.code } });
        } finally {
          req.off('aborted', cancel); res.off('close', closed);
        }
      }
      routeCtx.effect(() => routeCtx.webServer.register({ kind: 'exact', path: API, handler }), 'feishu-notify:api');
      routeCtx.effect(() => routeCtx.webServer.register({ kind: 'exact', path: API + '/test', handler }), 'feishu-notify:test');
    });
  });
}
