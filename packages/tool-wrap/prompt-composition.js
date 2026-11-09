import { readFile, writeFile, rename, unlink } from 'node:fs/promises';
import { resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import { DiscoveryError } from './core.js';

export const DEFAULT_COMPOSITION = Object.freeze({ version: 1, enabled: false, order: Object.freeze([]), rules: Object.freeze({}) });
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const validId = id => typeof id === 'string' && id.length > 0 && id.length <= 2048 && id.trim() === id && !/[\x00-\x1f\x7f]/.test(id);
export const ownerId = owner => 'owner:' + encodeURIComponent(owner);
export const sourceId = (kind, owner, name) => `${kind}:${encodeURIComponent(owner ?? '@host/unknown')}:${encodeURIComponent(name)}`;
export const instructionId = path => 'instructions:' + encodeURIComponent(path);
export function validateComposition(value) {
  if (!object(value) || Object.keys(value).some(key => !['version', 'enabled', 'order', 'sourceOrder', 'rules'].includes(key)) || value.version !== 1) throw new DiscoveryError('提示词编排配置字段或版本无效');
  if (typeof value.enabled !== 'boolean') throw new DiscoveryError('编排开关必须是布尔值');
  if (!Array.isArray(value.order) || value.order.length > 1024 || value.order.some(id => !validId(id)) || new Set(value.order).size !== value.order.length) throw new DiscoveryError('提示词顺序必须是不重复的来源 ID 数组');
  if (Object.hasOwn(value, 'sourceOrder') && (!Array.isArray(value.sourceOrder) || value.sourceOrder.length > 1024 || value.sourceOrder.some(id => !validId(id)) || new Set(value.sourceOrder).size !== value.sourceOrder.length)) throw new DiscoveryError('提示词逐项顺序必须是不重复的来源 ID 数组');
  if (!object(value.rules) || Object.keys(value.rules).length > 1024) throw new DiscoveryError('提示词规则必须是来源 ID 对象');
  const rules = Object.fromEntries(Object.entries(value.rules).map(([id, rule]) => {
    if (!validId(id) || !object(rule) || Object.keys(rule).some(key => !['role', 'delivery', 'enabled'].includes(key)) || !['inherit', 'system', 'developer', 'user'].includes(rule.role) || !['inherit', 'always', 'pack'].includes(rule.delivery) || Object.hasOwn(rule, 'enabled') && typeof rule.enabled !== 'boolean') throw new DiscoveryError('提示词角色、投递或注入规则无效');
    return [id, { role: rule.role, delivery: rule.delivery, ...(Object.hasOwn(rule, 'enabled') ? { enabled: rule.enabled } : {}) }];
  }));
  return { version: 1, enabled: value.enabled, order: [...value.order], ...(Object.hasOwn(value, 'sourceOrder') ? { sourceOrder: [...value.sourceOrder] } : {}), rules };
}
export function validateCapabilities(config, sources, capabilities, previous = DEFAULT_COMPOSITION) {
  const all = new Map(sources.map(source => [source.id, source]));
  if (config.enabled && !capabilities.admission) throw new DiscoveryError('完整提示词编排需要审核并启用宿主适配', 409);
  for (const [id, rule] of Object.entries(config.rules)) {
    const source = all.get(id);
    const unchanged = previous.rules[id]?.role === rule.role && previous.rules[id]?.delivery === rule.delivery && previous.rules[id]?.enabled === rule.enabled;
    if (!source || source.kind === 'unavailable') {
      if (unchanged) continue;
      throw new DiscoveryError('提示词来源已变化，请刷新后重新保存', 409);
    }
    if (Object.hasOwn(rule, 'enabled') && !source.canToggleInjection) {
      if (!config.enabled && unchanged) continue;
      throw new DiscoveryError(`来源 ${source.label} 不支持更改注入开关`, 409);
    }
    if (!source.roles.includes(rule.role) || !source.deliveryModes.includes(rule.delivery)) {
      if (!config.enabled && unchanged) continue;
      throw new DiscoveryError(`来源 ${source.label} 不支持所选角色或投递方式`, 409);
    }
  }
  if (config.order.some(id => !all.has(id) && !previous.order.includes(id))) throw new DiscoveryError('排序包含未知提示词来源，请刷新后重试', 409);
  if (config.sourceOrder?.some(id => (!all.has(id) || all.get(id).kind === 'unavailable') && !previous.order.includes(id) && !previous.sourceOrder?.includes(id))) throw new DiscoveryError('排序包含未知提示词来源，请刷新后重试', 409);
}
export class CompositionStore {
  constructor(profileDir) { this.path = resolve(profileDir, 'prompt-composition.json'); this.legacyPath = resolve(profileDir, 'prompt-order.json'); this.config = structuredClone(DEFAULT_COMPOSITION); this.queue = Promise.resolve(); }
  async load() {
    try { this.config = validateComposition(JSON.parse(await readFile(this.path, 'utf8'))); }
    catch (error) {
      if (error.code !== 'ENOENT') throw new DiscoveryError('无法读取 prompt-composition.json，请检查配置', 500);
      let legacy;
      try { legacy = JSON.parse(await readFile(this.legacyPath, 'utf8')); }
      catch (cause) { if (cause.code === 'ENOENT') return structuredClone(this.config); throw new DiscoveryError('无法迁移 prompt-order.json，原文件保留', 500); }
      if (legacy.version !== 1 || typeof legacy.enabled !== 'boolean' || !Array.isArray(legacy.plugins) || legacy.plugins.some(id => !validId(id))) throw new DiscoveryError('旧版提示词排序配置无效，原文件保留', 500);
      // Preserve the intent, but require explicit activation of the broader admission policy.
      await this.save({ version: 1, enabled: false, order: [...new Set(legacy.plugins.map(ownerId))], rules: {} });
    }
    return structuredClone(this.config);
  }
  save(value) {
    const next = validateComposition(value);
    const job = this.queue.then(async () => {
      const temp = this.path + '.' + randomUUID() + '.tmp';
      try {
        await writeFile(temp, JSON.stringify(next, null, 2) + '\n', { flag: 'wx', mode: 0o600 });
        await rename(temp, this.path);
        this.config = next;
      } catch { await unlink(temp).catch(() => {}); throw new DiscoveryError('无法保存提示词编排，原配置保留', 500); }
      return structuredClone(next);
    });
    this.queue = job.catch(() => {});
    return job;
  }
}
export function effectiveRule(config, source) {
  const result = { role: 'inherit', delivery: 'inherit', enabled: true };
  for (const id of [ownerId(source.owner), source.parent ?? source.groupId, source.id]) {
    const rule = config.rules[id];
    if (typeof rule?.enabled === 'boolean') result.enabled = rule.enabled;
    for (const field of ['role', 'delivery']) if (rule?.[field] && rule[field] !== 'inherit') result[field] = rule[field];
  }
  return result;
}
export function orderContributions(contributions, config) {
  let ordered = contributions;
  if (config.order.length) {
    const ranks = new Map(config.order.map((id, index) => [id, index]));
    const groups = new Map();
    contributions.forEach((source, index) => {
      const id = source.groupId ?? source.parent ?? ownerId(source.owner);
      if (!groups.has(id)) groups.set(id, { id, index, items: [] });
      groups.get(id).items.push({ source, index });
    });
    ordered = [...groups.values()].sort((a, b) => (ranks.get(a.id) ?? Infinity) - (ranks.get(b.id) ?? Infinity) || a.index - b.index)
      .flatMap(group => group.items.sort((a, b) => (ranks.get(a.source.id) ?? Infinity) - (ranks.get(b.source.id) ?? Infinity) || a.index - b.index).map(({ source }) => source));
  }
  if (!config.sourceOrder?.length) return ordered;
  // Flat source ranks override grouping; new and unavailable sources keep the legacy baseline.
  const ranks = new Map(config.sourceOrder.map((id, index) => [id, index]));
  return ordered.map((source, index) => ({ source, index }))
    .sort((a, b) => (ranks.get(a.source.id) ?? Infinity) - (ranks.get(b.source.id) ?? Infinity) || a.index - b.index)
    .map(({ source }) => source);
}
