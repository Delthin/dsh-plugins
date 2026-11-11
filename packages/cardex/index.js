/**
 * DSH port of pi-cardex: record a discussion in any conversation, then split it
 * into Markdown knowledge cards, a three-level knowledge tree, and an offline graph.
 *
 * Interaction model (deliberate difference from the Pi extension):
 * - No input interception. Messages are never swallowed, swiped back into the
 *   editor, or blocked while an archive runs; the transcript is read from the
 *   durable session log at archive time instead of being captured per message.
 * - `/cardex <question>` opens the recording and sends the question; every later
 *   turn in the same conversation belongs to the discussion automatically.
 * - Starting may call the model to search an existing catalog. `/cardex end`
 *   organizes the discussion and freezes its transcript before archive writes.
 */
import { randomUUID } from 'node:crypto';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import Schema from '@deepseek-ai/schemastery';
import { createUserMessage } from '@deepseek-ai/dsh-llm';
import { defaultSettingsPath, loadConfig, modelLabel, parseModelChoice, resolveDirectory, updateConfig } from './lib/config.js';
import { createModelCaller } from './lib/llm.js';
import { maxSeq, readDiscussion, recordId, selectedModel } from './lib/session.js';
import { createSessionState, tableValueSchema } from './lib/state.js';
import { catalog, organize, retrieve } from './lib/intelligence.js';
import { archive, loadIndex, rebuildGraph } from './lib/store.js';

const EXACT = new Set(['status', 'end', 'cancel', 'graph', 'help']);

const HELP = [
  '/cardex 问题 — 开始记录这次讨论；之后直接追问即可，所有回合都算在内',
  '/cardex end — 结束记录：拆知识点、归入三级知识树、生成离线图谱',
  '/cardex cancel — 放弃本次记录（聊天内容保留）',
  '/cardex status — 查看正在记录的讨论、归档目录与整理模型',
  '/cardex model follow — 整理时跟随当前会话模型（默认）',
  '/cardex model current — 固定为当前会话模型',
  '/cardex model provider/model-id — 指定整理模型',
  '/cardex dir ~/journal/cardex — 设置归档目录',
  '/cardex graph — 只重建离线图谱',
  '/cardex -- 问题 — 问题本身以 end、model 等命令词开头时使用',
].join('\n');

export const name = 'cardex';
export const inject = ['commands', 'storageDomain', 'sessionQuery', 'llm'];
export const Config = Schema.object({
  directory: Schema.string().default('').description('归档目录；留空则用 ~/journal/cardex'),
  configPath: Schema.string().default('').description('设置文件；留空则用 $DSH_HOME/cardex.json'),
  model: Schema.string().default('').description('整理模型 provider/model-id；留空跟随当前会话'),
  timeoutMs: Schema.number().default(120_000).description('单次整理模型调用超时（毫秒）'),
});

const ok = (text) => ({ kind: 'success', text });
const fail = (text) => ({ kind: 'error', text });

function errorText(error) {
  return error instanceof Error ? error.message : String(error);
}

export async function apply(ctx, config = {}) {
  const settingsPath = config.configPath?.trim() ? resolveDirectory(config.configPath.replace(/^~/, homedir())) : defaultSettingsPath();
  const defaults = {
    directory: config.directory?.trim() ? resolveDirectory(config.directory) : undefined,
    model: config.model?.trim() ? parseModelChoice(config.model) : undefined,
    timeoutMs: config.timeoutMs,
  };
  const domain = await ctx.storageDomain.open({
    name: 'dsh_cardex',
    version: 1,
    tables: { sessions: { valueSchema: tableValueSchema } },
  });
  ctx.effect(() => () => domain.close());
  const state = createSessionState(domain.table('sessions'));
  const busy = new Set();

  /** Resolve the archiving model: explicit setting, then the live agent, then the session log. */
  async function resolveRoute(agent, settings, events) {
    if (settings.model) return { provider: settings.model.provider, model: settings.model.id };
    try {
      const current = agent.model?.current?.();
      if (current?.provider && (current.model ?? current.id)) return { provider: current.provider, model: current.model ?? current.id };
    } catch {
      // A role-locked selection may be unavailable here; the session log below is authoritative.
    }
    const recorded = events ? selectedModel(events) : undefined;
    if (recorded) {
      const slash = recorded.indexOf('/');
      return { provider: recorded.slice(0, slash), model: recorded.slice(slash + 1) };
    }
    throw new Error('还无法确定整理模型：先用 /cardex model provider/model-id 指定，或在本会话里正常提问一次后重试。');
  }

  async function finish(agent, draft, summary) {
    await state.clear(agent.id);
    return ok(`${summary}\n归档目录：${draft.directory}\n图谱：${pathToFileURL(join(draft.directory, 'index.html')).href}`);
  }

  async function end(agent, settings, session, signal) {
    const draft = session.draft;
    if (!draft) throw new Error('当前没有正在记录的讨论。先输入 /cardex 问题 开始。');
    if (agent.status === 'running') throw new Error('当前回合还没结束；等回答完成后再运行 /cardex end。');
    let messages;
    let id;
    let events;
    const frozen = session.prepared && session.prepared.draftId === draft.id ? session.prepared : null;
    if (frozen) {
      messages = frozen.messages;
      id = frozen.recordId;
      events = undefined;
    } else {
      const discussion = await readDiscussion(ctx.sessionQuery, agent.id, draft.startSeq);
      events = discussion.events;
      messages = discussion.messages;
      if (!messages.some((message) => message.role === 'user') || !messages.some((message) => message.role === 'assistant')) {
        throw new Error('这次讨论还没有可归档的问答文字；先继续提问，等模型回答后再 /cardex end。');
      }
      if (discussion.pending) throw new Error('最后一个问题还没有回答完；等回答结束后再 /cardex end。');
      id = recordId(draft.id, messages);
    }
    const index = await loadIndex(draft.directory);
    const existing = index.nodes.filter((node) => node.recordIds.includes(id));
    if (existing.length) return finish(agent, draft, `已恢复归档，本次问答落盘为 ${existing.length} 张卡片：\n${existing.map((node) => node.title).join('\n')}`);
    const route = await resolveRoute(agent, settings, events ?? frozen?.events);
    const caller = createModelCaller({ ctx, route, timeoutMs: settings.timeoutMs, signal });
    const notes = await organize(messages, caller.organizationCall);
    signal?.throwIfAborted();
    // Freeze before any archive write: a retry re-uses this exact transcript and record id.
    await state.setPrepared(agent.id, { draftId: draft.id, recordId: id, messages });
    const result = await archive(draft.directory, { recordId: id, notes, messages, organizer: caller.name }, caller.call);
    const lines = result.nodes.map((node) => `${node.title}：${join(draft.directory, node.file)}`).join('\n');
    return finish(agent, draft, `已归档 ${result.nodes.length} 个知识点（新建 ${result.created}，补充 ${result.updated}），整理模型 ${caller.name}。\n${lines}`);
  }

  async function handler({ agent, rawInput, signal }) {
    const args = (rawInput ?? '').trim();
    if (!args || args === 'help') return ok(HELP);
    if (busy.has(agent.id)) return fail('上一个 /cardex 操作还在处理中，请等它结束。');
    busy.add(agent.id);
    try {
      const settings = await loadConfig(settingsPath, defaults);
      const session = state.get(agent.id);
      const head = args.split(/\s+/, 1)[0];
      if (EXACT.has(head) && args !== head) return fail(`/cardex ${head} 不接受参数；要归档以命令词开头的问题，请用 /cardex -- ${args.slice(head.length).trim()}`);
      if (head === 'status') {
        const lines = [
          session.draft
            ? `正在记录：${session.draft.question}\n开始于：${session.draft.startedAt}\n本次目录：${session.draft.directory}`
            : '当前没有正在记录的讨论。',
          `默认目录：${settings.directory}`,
          `整理模型：${settings.model ? modelLabel(settings.model) : '跟随当前会话模型'}`,
          `设置文件：${settingsPath}`,
        ];
        if (session.prepared) lines.push('上次整理没有完成；记录已冻结，运行 /cardex end 可以重试。');
        return ok(lines.join('\n'));
      }
      if (head === 'dir') {
        const rest = args.slice(head.length).trim();
        if (!rest) return ok(`默认归档目录：${settings.directory}\n修改：/cardex dir ~/journal/cardex`);
        const next = await updateConfig(settingsPath, { directory: resolveDirectory(rest) }, defaults);
        return ok(`默认归档目录：${next.directory}${session.draft ? `\n正在记录的讨论仍归档到：${session.draft.directory}` : ''}`);
      }
      if (head === 'model') {
        const rest = args.slice(head.length).trim();
        if (!rest) {
          return ok(`整理模型：${settings.model ? modelLabel(settings.model) : '跟随当前会话模型'}\n/cardex model follow | current | provider/model-id`);
        }
        if (rest === 'follow') {
          await updateConfig(settingsPath, { model: null }, defaults);
          return ok('整理模型已设为跟随当前会话模型。');
        }
        if (rest === 'current') {
          const current = agent.model?.current?.();
          if (!current?.provider || !(current.model ?? current.id)) throw new Error('当前会话还没有确定模型；先提问一次，或用 /cardex model provider/model-id 指定。');
          const next = await updateConfig(settingsPath, { model: { provider: current.provider, id: current.model ?? current.id } }, defaults);
          return ok(`整理模型固定为 ${modelLabel(next.model)}。`);
        }
        const next = await updateConfig(settingsPath, { model: parseModelChoice(rest) }, defaults);
        return ok(`整理模型固定为 ${modelLabel(next.model)}。`);
      }
      if (head === 'graph') {
        const directory = session.draft?.directory ?? settings.directory;
        await rebuildGraph(directory);
        return ok(`离线图谱：${pathToFileURL(join(directory, 'index.html')).href}`);
      }
      if (head === 'cancel') {
        const draft = session.draft;
        if (!draft) throw new Error('当前没有正在记录的讨论。');
        let saved = [];
        if (session.prepared) {
          saved = (await loadIndex(draft.directory)).nodes.filter((node) => node.recordIds.includes(session.prepared.recordId));
        }
        await state.clear(agent.id);
        if (saved.length) return ok(`本次问答已经落盘（${saved.length} 张卡片），记录已结束。\n${saved.map((node) => node.title).join('\n')}`);
        return ok('已取消本次记录，聊天内容保留。');
      }
      if (head === 'end') {
        const text = await end(agent, settings, session, signal);
        return text;
      }

      // Fall through: a question.
      const question = head === '--' ? args.slice(2).trim() : args;
      if (!question) throw new Error('请在 /cardex 后面写上你的问题。');
      if (question.length > 20_000) throw new Error('问题太长；请拆成几次讨论。');
      if (session.prepared) throw new Error('上次整理还没有完成：用 /cardex end 重试，或 /cardex cancel 结束这次记录。');
      let notice = '';
      if (!session.draft) {
        const directory = settings.directory;
        const draft = { id: randomUUID(), directory, question, startedAt: new Date().toISOString(), startSeq: 0 };
        const snapshot = await ctx.sessionQuery.readSession(agent.id);
        const events = Array.isArray(snapshot?.events) ? snapshot.events : [];
        draft.startSeq = maxSeq(events);
        try {
          const index = await loadIndex(directory);
          const entries = catalog(index);
          if (entries.length) {
            const route = await resolveRoute(agent, settings, events);
            const caller = createModelCaller({ ctx, route, timeoutMs: settings.timeoutMs, signal });
            const matchId = await retrieve(question, entries, caller.call);
            const match = index.nodes.find((node) => node.id === matchId);
            if (match) notice = `发现已有知识点「${match.title}」，结束时会重新判断是补充还是新建。`;
          }
        } catch (error) {
          // Retrieval is a hint; never block starting a discussion because of it.
          notice = `（索引检索跳过：${errorText(error).split('\n')[0]}）`;
        }
        await state.setDraft(agent.id, draft);
        notice = notice || '已开始记录这次讨论。';
      } else {
        notice = `继续记录到「${session.draft.question.slice(0, 40)}」。`;
      }
      try {
        agent.followup(createUserMessage({ content: [{ type: 'text', text: question }], source: { kind: 'user' } }));
      } catch (error) {
        throw new Error(`记录已开启，但没能自动发送问题（${errorText(error)}）；请直接把问题发到输入框。`);
      }
      return ok(`${notice}\n追问会一起记录；结束后运行 /cardex end。`);
    } catch (error) {
      return fail(errorText(error));
    } finally {
      busy.delete(agent.id);
    }
  }

  ctx.effect(() => ctx.commands.register({
    name: 'cardex',
    description: '记录问答，整理 Markdown 知识卡片与离线图谱',
    input: { hint: '问题 | end | cancel | status | model | dir | graph | help' },
    handler,
  }));
}