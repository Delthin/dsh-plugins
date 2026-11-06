import { readFile, writeFile, rename, unlink } from 'node:fs/promises';
import { resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import { DiscoveryError } from './core.js';

export const DEFAULT_PROMPT_ORDER = Object.freeze({ version: 1, enabled: false, plugins: Object.freeze([]) });
export function validatePromptOrder(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).some(key => !['version', 'enabled', 'plugins'].includes(key)) || value.version !== 1) throw new DiscoveryError('提示词排序配置字段或版本无效');
  if (typeof value.enabled !== 'boolean') throw new DiscoveryError('排序开关必须是布尔值');
  if (!Array.isArray(value.plugins) || value.plugins.length > 128 || value.plugins.some(id => typeof id !== 'string' || !id || id.length > 512 || id.trim() !== id || /[\x00-\x1f\x7f]/.test(id)) || new Set(value.plugins).size !== value.plugins.length) throw new DiscoveryError('插件顺序须为不重复的插件名称数组，最多 128 项');
  return { version: 1, enabled: value.enabled, plugins: [...value.plugins] };
}

/** Independent storage: saving an older tool-discovery form cannot erase prompt placement. */
export class PromptOrderStore {
  constructor(profileDir) { this.path = resolve(profileDir, 'prompt-order.json'); this.config = structuredClone(DEFAULT_PROMPT_ORDER); this.queue = Promise.resolve(); }
  async load() {
    try { this.config = validatePromptOrder(JSON.parse(await readFile(this.path, 'utf8'))); }
    catch (error) { if (error.code !== 'ENOENT') throw new DiscoveryError('无法读取 prompt-order.json，请检查配置', 500); }
    return structuredClone(this.config);
  }
  save(value) {
    const next = validatePromptOrder(value);
    const job = this.queue.then(async () => {
      // Both paths are the fixed config and a fresh temporary file in the same directory.
      const temp = this.path + '.' + randomUUID() + '.tmp';
      try {
        await writeFile(temp, JSON.stringify(next, null, 2) + '\n', { flag: 'wx', mode: 0o600 });
        await rename(temp, this.path);
        this.config = next;
      } catch {
        await unlink(temp).catch(() => {});
        throw new DiscoveryError('无法保存提示词排序，原配置保留', 500);
      }
      return structuredClone(next);
    });
    this.queue = job.catch(() => {});
    return job;
  }
}
