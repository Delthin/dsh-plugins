/**
 * One-shot auxiliary model calls for card organization.
 *
 * These calls never run an agent loop: no tools, one user message, isolated
 * context. They share the harness route/credentials through `ctx.llm.prepareCall`
 * and are assembled with `BlockAssembler`, matching how other auxiliary
 * producers in the harness issue requests.
 */
import { BlockAssembler, createUserMessage } from '@deepseek-ai/dsh-llm';

const MAX_OUTPUT_TOKENS = 16_000;

/**
 * Build the `ModelCall` used by `src/intelligence.js`
 * (`(system, data) => Promise<string>`).
 *
 * @param options.ctx - plugin context exposing the harness `llm` service.
 * @param options.route - resolved `{provider, model}`.
 * @param options.timeoutMs - per-call deadline.
 * @param options.signal - caller cancellation (the invoking command's signal).
 */
export function createModelCaller({ ctx, route, timeoutMs, signal }) {
  const name = `${route.provider}/${route.model}`;

  const request = async (system, data) => {
    if (signal?.aborted) throw signal.reason ?? new Error('整理已取消。');
    const controller = new AbortController();
    const relay = () => controller.abort(signal?.reason ?? new Error('整理已取消。'));
    signal?.addEventListener('abort', relay, { once: true });
    const timer = setTimeout(() => {
      controller.abort(new Error(`整理模型调用超过 ${Math.round(timeoutMs / 1000)} 秒未结束；记录仍在，可重试 /cardex end。`));
    }, timeoutMs);
    try {
      const call = await ctx.llm.prepareCall(
        { provider: route.provider, model: route.model, maxTokens: MAX_OUTPUT_TOKENS },
        controller.signal,
        (controls) => controls,
      );
      const options = {
        ...call.config,
        messages: [createUserMessage({ content: [{ type: 'text', text: JSON.stringify(data) }], source: { kind: 'cardex' } })],
        system,
        signal: controller.signal,
      };
      const assembler = new BlockAssembler();
      for await (const chunk of call.stream(options)) assembler.push(chunk);
      const finish = assembler.finish;
      if (finish.kind === 'error' || finish.kind === 'aborted') {
        const message = finish.failure?.message ?? `整理模型 ${name} 调用失败。`;
        const error = new Error(message);
        if (finish.failure?.code !== undefined) error.code = finish.failure.code;
        throw error;
      }
      if (finish.kind === 'tool-calls') throw new Error(`整理模型 ${name} 请求了工具调用；本次调用只接受文本。请换一个模型或重试 /cardex end。`);
      if (finish.kind !== 'stop') throw new Error(`整理模型 ${name} 未完成输出（${finish.kind}）。请缩短本次讨论或换用输出更长的模型后重试。`);
      const text = assembler
        .blocks()
        .filter((block) => block && block.type === 'text' && typeof block.text === 'string')
        .map((block) => block.text)
        .join('\n');
      if (!text.trim()) throw new Error(`整理模型 ${name} 返回了空内容。`);
      return text;
    } catch (error) {
      if (error?.name === 'AbortError' && controller.signal.aborted) throw controller.signal.reason ?? error;
      throw error;
    } finally {
      clearTimeout(timer);
      signal?.removeEventListener('abort', relay);
    }
  };

  return {
    name,
    call: request,
  };
}
