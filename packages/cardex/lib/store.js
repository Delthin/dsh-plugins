import { randomUUID } from "node:crypto";
import { join } from "node:path";
import { rm } from "node:fs/promises";
import { atomicWrite, readOptional, syncDirectory, withLock } from "./files.js";
import { catalog, route } from "./intelligence.js";
import { renderGraph } from "./graph.js";
import { MAX_KNOWLEDGE_DEPTH } from "./constants.js";


const INDEX = "index.json";
const PENDING = ".pi-cardex-transaction.json";
const validId = (id         )               => typeof id === "string" && /^[a-zA-Z0-9_-]{1,160}$/.test(id);
const nonempty = (value         )                  => typeof value === "string" && value.trim().length > 0;
const object = (value         )                                   => !!value && typeof value === "object" && !Array.isArray(value);

export function emptyIndex()                 {
  return { version: 2, revision: 0, updatedAt: new Date().toISOString(), nodes: [], edges: [], discussions: [] };
}

/** V1 records have no discussion files. Migration never fabricates those sources. */
export function parseIndex(value         )                 {
  if (!object(value) || (value.version !== 1 && value.version !== 2) || !Number.isSafeInteger(value.revision) || (value.revision          ) < 0 ||
      !nonempty(value.updatedAt) || !Array.isArray(value.nodes) || !Array.isArray(value.edges) || (value.version === 2 && !Array.isArray(value.discussions))) {
    throw new Error("知识索引结构无效，请从备份恢复 index.json。");
  }
  const index = {
    ...value, version: 2,
    nodes: value.nodes.map(node => value.version === 1 && object(node) ? { ...node, kind: "knowledge", parentId: null } : node),
    discussions: value.version === 1 ? [] : value.discussions,
  }                  ;
  const nodes = new Map                       ();
  for (const node of index.nodes) {
    if (!node || !validId(node.id) || nodes.has(node.id) || ![node.title, node.summary, node.createdAt, node.updatedAt].every(nonempty) ||
        (node.parentId !== null && !validId(node.parentId)) || !Array.isArray(node.recordIds) ||
        node.recordIds.some(id => !validId(id)) || new Set(node.recordIds).size !== node.recordIds.length ||
        (node.kind === "knowledge" ? node.file !== `cards/${node.id}.md` : node.kind !== "group" || node.file !== null || node.recordIds.length !== 0)) {
      throw new Error("知识索引中的卡片条目无效。");
    }
    nodes.set(node.id, node);
  }
  for (const node of index.nodes) {
    const ancestors = new Set([node.id]);
    let parentId = node.parentId;
    while (parentId !== null) {
      const parent = nodes.get(parentId);
      if (!parent) throw new Error("知识索引中的父节点不存在。");
      if (ancestors.has(parentId)) throw new Error("知识索引中的父子结构存在环。");
      ancestors.add(parentId);
      parentId = parent.parentId;
    }
    if (ancestors.size > MAX_KNOWLEDGE_DEPTH) throw new Error(`知识索引的层级不能超过 ${MAX_KNOWLEDGE_DEPTH} 级。`);
  }
  const pairs = new Set        ();
  for (const edge of index.edges) {
    if (!edge || !nodes.has(edge.source) || !nodes.has(edge.target) || edge.source === edge.target || !nonempty(edge.relation) || !nonempty(edge.reason)) throw new Error("知识索引中的关系无效。");
    const pair = [edge.source, edge.target].sort().join(":");
    if (pairs.has(pair)) throw new Error("知识索引中的关系重复。");
    pairs.add(pair);
  }
  const discussions = new Map                     ();
  for (const discussion of index.discussions) {
    if (!discussion || !validId(discussion.id) || discussions.has(discussion.id) || discussion.file !== `discussions/${discussion.id}.md` ||
        !nonempty(discussion.createdAt) || !nonempty(discussion.organizer) || !Array.isArray(discussion.nodeIds) || !discussion.nodeIds.length ||
        discussion.nodeIds.some(id => !validId(id) || nodes.get(id)?.kind !== "knowledge" || !nodes.get(id)?.recordIds.includes(discussion.id)) ||
        new Set(discussion.nodeIds).size !== discussion.nodeIds.length) throw new Error("知识索引中的讨论来源条目或双向关联无效。");
    discussions.set(discussion.id, new Set(discussion.nodeIds));
  }
  for (const node of index.nodes) {
    for (const id of node.recordIds) {
      // Unindexed record IDs are retained from V1; indexed discussions must agree in both directions.
      if (discussions.has(id) && !discussions.get(id) .has(node.id)) throw new Error("知识索引中的讨论来源双向关联不一致。");
    }
  }
  return index;
}

async function readIndex(directory        )                          {
  const raw = await readOptional(join(directory, INDEX));
  return raw === undefined ? emptyIndex() : parseIndex(JSON.parse(raw));
}




function parseTransaction(value         )              {
  if (!object(value) || (value.version !== 1 && value.version !== 2)) throw new Error("待恢复的归档事务损坏，请保留目录并从备份恢复。");
  const index = parseIndex(value.index);
  const files          = value.version === 1 ? [value.card] : value.files;
  if (!Array.isArray(files) || !files.length || (value.version === 2 && (!object(value.index) || value.index.version !== 2))) throw new Error("待恢复的归档事务损坏，请保留目录并从备份恢复。");
  const allowed = new Set        (index.nodes.flatMap(node => node.file === null ? [] : [node.file]));
  if (value.version === 2) for (const discussion of index.discussions) allowed.add(discussion.file);
  const seen = new Set        ();
  for (const file of files) {
    if (!object(file) || typeof file.file !== "string" || !allowed.has(file.file) || seen.has(file.file) || typeof file.content !== "string") throw new Error("待恢复事务的文件路径或内容无效。");
    seen.add(file.file);
  }
  return { version: 2, index, files: files                      };
}

async function apply(directory        , tx             )                {
  for (const file of tx.files) await atomicWrite(join(directory, file.file), file.content);
  await atomicWrite(join(directory, INDEX), JSON.stringify(tx.index, null, 2) + "\n");
  await renderGraph(directory, tx.index);
  await rm(join(directory, PENDING));
  await syncDirectory(directory);
}

/** Called only while holding the directory lock. Replays a durable, fully validated transaction. */
async function recover(directory        )                {
  const raw = await readOptional(join(directory, PENDING));
  if (raw === undefined) return;
  const tx = parseTransaction(JSON.parse(raw));
  const current = await readIndex(directory);
  if (current.revision !== tx.index.revision && current.revision + 1 !== tx.index.revision) throw new Error("待恢复事务与索引版本冲突，请保留目录并检查备份。");
  await apply(directory, tx);
}

export async function loadIndex(directory        )                          {
  return withLock(directory, async () => { await recover(directory); return readIndex(directory); });
}

function messageText(message                   )         {
  const heading = message.role === "user" ? "用户问题（user）" : `模型回答（assistant） · ${message.model ?? "unknown"}`;
  const status = message.status === "aborted" ? "（回答已中断）" : message.status === "error" ? "（回答出错，以下为已生成内容）" : message.status === "length" ? "（回答达到长度限制）" : "";
  return `### ${heading}${status} · ${new Date(message.timestamp).toISOString()}\n\n${message.text}`;
}

function discussionText(input              , now        )         {
  return `# 讨论 ${input.recordId}\n\n归档时间：${now}\n整理模型：${input.organizer}\n\n${input.messages.map((message, i) => `<a id="message-${i}"></a>\n\n${messageText(message)}`).join("\n\n")}\n`;
}

function cardText(node               , previous                    , notes                 , input              )         {
  const frontmatter = `---\nid: ${JSON.stringify(node.id)}\ntitle: ${JSON.stringify(node.title)}\nsummary: ${JSON.stringify(node.summary)}\ncreated: ${JSON.stringify(node.createdAt)}\nupdated: ${JSON.stringify(node.updatedAt)}\n---\n\n`;
  const body = previous === undefined ? `# ${node.title}\n` : previous.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n\s*/, "");
  const organized = notes.map(note => `### ${note.title}\n\n${note.background ? `#### 背景\n\n${note.background}\n\n` : ""}#### 知识整理\n\n${note.content}`).join("\n\n");
  const indices = [...new Set(notes.flatMap(note => note.messageIndices))].sort((a, b) => a - b);
  const transcript = indices.map(i => `[原始消息 message-${i}](../discussions/${input.recordId}.md#message-${i})\n\n${messageText(input.messages[i] )}`).join("\n\n");
  return `${frontmatter}${body.trimEnd()}\n\n---\n\n## ${node.updatedAt}\n\n<!-- record:${input.recordId} -->\n整理模型：${input.organizer}\n\n${organized}\n\n### 相关原始问答\n\n${transcript}\n`;
}








function validateInput(input              )       {
  if (!validId(input.recordId) || !nonempty(input.organizer) || !Array.isArray(input.notes) || !input.notes.length || !Array.isArray(input.messages) || !input.messages.length) throw new Error("归档输入无效。");
  for (const message of input.messages) {
    if (!message || !["user", "assistant"].includes(message.role) || typeof message.text !== "string" || !Number.isFinite(message.timestamp) ||
        !Number.isFinite(new Date(message.timestamp).getTime()) || (message.model !== undefined && !nonempty(message.model)) ||
        (message.status !== undefined && !["error", "aborted", "length"].includes(message.status))) throw new Error("归档讨论消息无效。");
  }
  const ids = new Set        ();
  for (const note of input.notes) {
    if (!note || !nonempty(note.id) || ids.has(note.id) || ![note.title, note.summary, note.content].every(nonempty) || typeof note.background !== "string" ||
        !Array.isArray(note.messageIndices) || !note.messageIndices.length || note.messageIndices.some(i => !Number.isSafeInteger(i) || i < 0 || i >= input.messages.length)) throw new Error("归档知识点或来源消息索引无效。");
    ids.add(note.id);
  }
}

/** Allocate every ID before resolving references, including forward target/group references. */
function planNodes(index                , routing         , input              , now        )                                                     {
  // route validates the model plan; the store validates the fully resolved, persisted index below.
  const existing = new Map(index.nodes.map(node => [node.id, node]));
  const refs = new Map                 (index.nodes.map(node => [`existing:${node.id}`, node.id]));
  for (const target of routing.targets) refs.set(`target:${target.key}`, target.matchId ?? randomUUID());
  for (const group of routing.groups) refs.set(`group:${group.key}`, randomUUID());
  const resolve = (ref                )                => {
    if (ref === null) return null;
    const id = refs.get(ref);
    if (!id) throw new Error("归档路由引用了不存在的节点。");
    return id;
  };
  const targets = routing.targets.map(target => {
    const old = target.matchId === null ? undefined : existing.get(target.matchId) ;
    // Resolve even an ignored parent to reject invalid references; matched nodes keep their location.
    const parentId = resolve(target.parent);
    const id = refs.get(`target:${target.key}`) ;
    return {
      id, kind: "knowledge"         , parentId: old ? old.parentId : parentId, title: old ? old.title : target.title,
      summary: target.summary, file: `cards/${id}.md`, createdAt: old?.createdAt ?? now, updatedAt: now,
      recordIds: [...(old?.recordIds ?? []), input.recordId],
    };
  });
  const groups                  = routing.groups.map(group => ({
    id: refs.get(`group:${group.key}`) , kind: "group", parentId: resolve(group.parent), title: group.title, summary: group.summary,
    file: null, createdAt: now, updatedAt: now, recordIds: [],
  }));
  const updates = new Map(targets.map(node => [node.id, node]));
  const nodes = [...index.nodes.map(node => updates.get(node.id) ?? node), ...targets.filter(node => !existing.has(node.id)), ...groups];
  const next                 = {
    version: 2, revision: index.revision + 1, updatedAt: now, nodes,
    edges: [
      ...index.edges.filter(edge => !updates.has(edge.source) && !updates.has(edge.target)),
      ...routing.relations.map(edge => ({ source: resolve(edge.source) , target: resolve(edge.target) , relation: edge.relation, reason: edge.reason })),
    ],
    discussions: [...index.discussions, { id: input.recordId, file: `discussions/${input.recordId}.md`, createdAt: now, organizer: input.organizer, nodeIds: targets.map(node => node.id) }],
  };
  parseIndex(next);
  return { targets, next };
}

export async function archive(directory        , input              , call           )                                                                                            {
  return withLock(directory, async () => {
    await recover(directory);
    const index = await readIndex(directory);
    if (!validId(input.recordId)) throw new Error("归档记录 ID 无效。");
    const duplicates = index.nodes.filter(node => node.kind === "knowledge" && node.recordIds.includes(input.recordId));
    if (duplicates.length) return { nodes: duplicates, created: 0, updated: 0, duplicate: true };
    validateInput(input);
    const routing = await route(input.notes, catalog(index), call);
    const now = new Date().toISOString();
    const { targets, next } = planNodes(index, routing, input, now);
    const files                    = [{ file: `discussions/${input.recordId}.md`, content: discussionText(input, now) }];
    // Read every existing body before writing the WAL: missing sources cannot partially commit a plan.
    const previous = new Map                ();
    for (const old of index.nodes) {
      if (old.file === null) continue;
      const content = await readOptional(join(directory, old.file));
      if (content === undefined) throw new Error(`卡片文件缺失：${old.file}。请恢复文件后重试。`);
      previous.set(old.id, content);
    }
    for (let i = 0; i < targets.length; i++) {
      const node = targets[i] ;
      const ids = new Set(routing.targets[i] .noteIds);
      files.push({ file: node.file , content: cardText(node, previous.get(node.id), input.notes.filter(note => ids.has(note.id)), input) });
    }
    const tx              = { version: 2, index: next, files };
    parseTransaction(tx);
    // All source content and the complete index are planned and validated before any durable change.
    await atomicWrite(join(directory, PENDING), JSON.stringify(tx));
    await apply(directory, tx);
    const updated = targets.filter(node => index.nodes.some(old => old.id === node.id)).length;
    return { nodes: targets, created: targets.length - updated, updated, duplicate: false };
  });
}

export async function rebuildGraph(directory        )                {
  await withLock(directory, async () => { await recover(directory); await renderGraph(directory, await readIndex(directory)); });
}
