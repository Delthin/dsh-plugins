/**
 * Settings for the cardex plugin.
 *
 * Two layers exist on purpose:
 * - the plugin `Config` in the DSH profile (live defaults, read at command start);
 * - a JSON settings file (`$DSH_HOME/cardex.json`) written by `/cardex dir` and
 *   `/cardex model`, so everyday settings never require a profile edit.
 *
 * The file keeps the same shape as the old Pi plugin config
 * (`~/.pi/agent/pi-cardex.json`), so an existing file can be copied over.
 */
import { homedir } from 'node:os';
import { join, resolve } from 'node:path';
import { readFile, writeFile, mkdir } from 'node:fs/promises';

const VERSION = 1;

export function dshHome() {
  const configured = process.env.DSH_HOME?.trim();
  return configured ? resolve(configured) : join(homedir(), '.dsh');
}

/** Default settings file, inside the harness home unless the profile overrides it. */
export function defaultSettingsPath() {
  return join(dshHome(), 'cardex.json');
}

export function defaultDirectory() {
  return join(homedir(), 'journal', 'cardex');
}

/** Expand a leading `~` and resolve against the process cwd; reject an empty value. */
export function resolveDirectory(value) {
  if (typeof value !== 'string' || !value.trim()) throw new Error('归档目录不能为空。');
  const text = value.trim();
  const expanded = text === '~' ? homedir() : text.startsWith('~/') ? join(homedir(), text.slice(2)) : text;
  return resolve(expanded);
}

/** Parse `provider/model-id` into the stored model choice; `` and `follow` mean "follow the session". */
export function parseModelChoice(value) {
  if (value === undefined || value === null || value === '' || value === 'follow') return null;
  if (typeof value === 'string') {
    const slash = value.indexOf('/');
    if (slash > 0 && slash < value.length - 1) return { provider: value.slice(0, slash), id: value.slice(slash + 1) };
    throw new Error('模型请写成 provider/model-id，请使用宿主已配置的提供方和模型 ID。');
  }
  const provider = value.provider;
  const id = value.id ?? value.model;
  if (typeof provider !== 'string' || !provider.trim() || typeof id !== 'string' || !id.trim()) throw new Error('模型配置缺少 provider 或 id。');
  return { provider: provider.trim(), id: id.trim() };
}

export function resolveTimeout(value) {
  if (value === undefined || value === null || value === '') return 120_000;
  const number = Number(value);
  if (!Number.isFinite(number) || number < 5_000 || number > 900_000) throw new Error('timeoutMs 必须在 5000 到 900000 之间。');
  return Math.floor(number);
}

/** Validate one settings object; unknown keys are ignored, missing keys fall back. */
export function parseConfig(raw, defaults = {}) {
  const base = {
    version: VERSION,
    directory: defaults.directory ? resolveDirectory(defaults.directory) : defaultDirectory(),
    model: parseModelChoice(defaults.model),
    timeoutMs: resolveTimeout(defaults.timeoutMs),
  };
  if (raw === undefined || raw === null) return base;
  if (typeof raw !== 'object' || Array.isArray(raw)) throw new Error('cardex 配置必须是对象。');
  if (raw.version !== undefined && raw.version !== VERSION) throw new Error(`cardex 配置版本不受支持：${String(raw.version)}。`);
  return {
    version: VERSION,
    directory: raw.directory === undefined ? base.directory : resolveDirectory(raw.directory),
    model: raw.model === undefined ? base.model : parseModelChoice(raw.model),
    timeoutMs: raw.timeoutMs === undefined ? base.timeoutMs : resolveTimeout(raw.timeoutMs),
  };
}

/** Read the settings file; a missing file means "use the profile defaults". */
export async function loadConfig(path, defaults = {}) {
  if (!path) return parseConfig(undefined, defaults);
  let text;
  try {
    text = await readFile(path, 'utf8');
  } catch (error) {
    if (error.code === 'ENOENT') return parseConfig(undefined, defaults);
    throw error;
  }
  let raw;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new Error(`配置文件不是有效 JSON：${path}`);
  }
  return parseConfig(raw, defaults);
}

/** Merge a patch into the settings file, creating the directory when needed. */
export async function updateConfig(path, patch, defaults = {}) {
  const current = await loadConfig(path, defaults);
  const next = parseConfig({ ...current, ...patch }, defaults);
  await mkdir(join(path, '..'), { recursive: true });
  await writeFile(path, `${JSON.stringify(next, null, 2)}\n`, 'utf8');
  return next;
}

export function modelLabel(model) {
  return model ? `${model.provider}/${model.id}` : '';
}
