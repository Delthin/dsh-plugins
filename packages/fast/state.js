import { readFile } from 'node:fs/promises';

// Role snapshots own their tier, including old snapshots whose tier is Standard.
export async function readRoleTier(path, sessionId) {
  if (path === undefined || path === null || (typeof path === 'string' && !path.trim())) return undefined;
  let data;
  try { data = JSON.parse(await readFile(path, 'utf8')); }
  catch (error) { if (error.code === 'ENOENT') return undefined; throw error; }
  if (!Array.isArray(data.items)) throw new Error('角色快照格式错误');
  const run = data.items.find(item => item.sessionId === sessionId);
  return run ? { fast: run.selection?.fast === true, locked: true, source: 'role' } : undefined;
}

export function createTierState(table, roleTier) {
  let writes = Promise.resolve();
  const get = async sessionId => (await roleTier(sessionId)) ?? {
    fast: table.get(sessionId)?.fast === true, locked: false, source: 'session',
  };
  const set = (sessionId, value) => {
    const operation = writes.then(async () => {
      const current = await get(sessionId);
      if (current.locked) throw new Error('角色档位固定在启动快照中，请在角色设置里修改新成员的 Fast 档位');
      const fast = value === 'toggle' ? !current.fast : value;
      if (typeof fast !== 'boolean') throw new Error('fast 必须是布尔值');
      await table.put(sessionId, { fast });
      return { fast, locked: false, source: 'session' };
    });
    writes = operation.catch(() => {});
    return operation;
  };
  return { get, set };
}
