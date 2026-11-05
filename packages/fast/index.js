import Schema from '@deepseek-ai/schemastery';
import { z } from 'zod';
import { createFastTransport } from './transport.js';
import { createTierState, readRoleTier } from './state.js';
import { configuredRoute, assertFastProvider } from './config.js';

export const name = 'fast';
export const inject = ['llm', 'storageDomain', 'sessionController', 'connection', 'commands'];
export const Config = Schema.object({
  provider: Schema.string().default(''),
  sourceURL: Schema.string().default(''),
  targetURL: Schema.string().default(''),
  roleRunsPath: Schema.string(),
});

export async function apply(ctx, config = {}) {
  const route = configuredRoute(config);
  const domain = await ctx.storageDomain.open({
    name: 'dsh_fast', version: 1,
    tables: { sessions: { valueSchema: z.object({ fast: z.boolean() }) } },
  });
  ctx.effect(() => () => domain.close());
  const state = createTierState(domain.table('sessions'), id => readRoleTier(config.roleRunsPath, id));
  // Ephemeral routing receipts contain no prompts, headers, or credentials.
  const deliveries = new Map();
  const transport = route ? await createFastTransport({ sourceURL: route.sourceURL, targetURL: route.targetURL,
    onForward(receipt) {
      if (!receipt.sessionId) return;
      const previous = deliveries.get(receipt.sessionId);
      deliveries.delete(receipt.sessionId);
      deliveries.set(receipt.sessionId, { ...receipt, count: (previous?.count ?? 0) + 1, at: new Date().toISOString() });
      if (deliveries.size > 1000) deliveries.delete(deliveries.keys().next().value);
    },
  }) : undefined;
  if (transport) ctx.effect(() => () => transport.close());

  const configured = Boolean(route);
  async function setTier(sessionId, value) {
    if (!configured && value !== false) {
      // Resolve unconfigured toggles to an explicit off write so concurrent
      // toggles can never re-enable a persisted Fast session.
      if (value === 'toggle' && (await state.get(sessionId)).fast) return state.set(sessionId, false);
      assertFastProvider(route);
    }
    return state.set(sessionId, value);
  }

  ctx.on('llm/stream', async function* (options, next) {
    const tier = options.sessionId ? await state.get(options.sessionId) : { fast: false };
    if (!tier.fast) { yield* next(); return; }
    assertFastProvider(route, options.provider);
    yield* transport.wrap(next, { sessionId: options.sessionId });
  });

  async function assertSession(sessionId) {
    if (typeof sessionId !== 'string' || !sessionId || sessionId.length > 200) throw new Error('缺少有效 sessionId');
    const controller = ctx.sessionController;
    if (typeof controller.inspect === 'function') await controller.inspect(sessionId);
    else await controller.state({ sessionId }, new AbortController().signal);
  }
  // Same mutation for the model picker and /fast. No parent-session inheritance.
  ctx.effect(() => ctx.commands.register({
    name: 'fast', description: '切换当前会话标准 / Fast 档位（角色使用启动时的固定档位）',
    input: { hint: 'on | off | toggle | status' },
    async handler({ agent, rawInput }) {
      try {
        const action = rawInput.trim().toLowerCase() || 'toggle';
        if (!['on', 'off', 'toggle', 'status'].includes(action)) throw new Error('用法：/fast on | off | toggle | status');
        const value = action === 'status' ? await state.get(agent.id) : await setTier(agent.id, action === 'toggle' ? action : action === 'on');
        return { kind: 'success', text: `${value.fast ? 'Fast' : '标准'}${value.locked ? '（角色固定）' : '（当前会话）'}${configured ? '' : '；Fast 尚未配置'}` };
      } catch (error) { return { kind: 'error', text: error.message }; }
    },
  }));
  ctx.effect(() => ctx.connection.fetch.register({
    path: '/api/fast', methods: ['POST'], requestBody: 'buffered',
    async fetch(request) {
      const reply = (body, status = 200) => Response.json(body, { status, headers: { 'cache-control': 'no-store' } });
      const admission = ctx.connection.admit(request);
      if ('rejection' in admission || admission.peer.principal.kind !== 'owner') return reply({ error: '请登录 DSH 后重试' }, 403);
      try {
        const text = await request.text();
        if (text.length > 4096) throw new Error('请求过大');
        const body = JSON.parse(text);
        await assertSession(body.sessionId);
        if (body.action === 'get') return reply({ ...await state.get(body.sessionId), configured, provider: route?.provider ?? '', lastDelivery: deliveries.get(body.sessionId) });
        if (body.action === 'set') return reply({ ...await setTier(body.sessionId, body.fast), configured, provider: route?.provider ?? '' });
        throw new Error('未知操作');
      } catch (error) { return reply({ error: error.message }, 400); }
    },
  }));
}
