import { readFile, writeFile, rename, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { randomUUID, createHash } from 'node:crypto';

export const TOOLS = ['read','glob','grep','bash','edit','write','web_search','web_fetch','cache_search','advanced_search','platform_search','domain_search'];
export const hash = text => createHash('sha256').update(text).digest('hex');
export function validateRole(input) {
  if (!input || typeof input !== 'object') throw new Error('角色内容必须是对象');
  const string = (key, max, empty = false) => {
    if (typeof input[key] !== 'string' || input[key].length > max || (!empty && !input[key].trim())) throw new Error('无效字段：' + key);
    return input[key];
  };
  const id = string('id', 64);
  const name = string('name', 64);
  if (!/^[a-z0-9][a-z0-9-]*$/.test(id) || !/^[a-z][a-z0-9-]*$/.test(name)) throw new Error('标识和名称只允许小写字母、数字及连字符');
  if (typeof input.enabled !== 'boolean') throw new Error('enabled 必须为布尔值');
  if (input.fast !== undefined && typeof input.fast !== 'boolean') throw new Error('fast 必须为布尔值');
  const skills=input.skills??[];
  if (!Array.isArray(skills) || skills.length>64 || skills.some(s=>typeof s!=='string' || s.length>128 || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(s))) throw new Error('技能必须是有效名称列表（最多 64 项）');
  if (!Array.isArray(input.tools) || input.tools.some(t => !TOOLS.includes(t))) throw new Error('工具不在允许的 DSH 工具清单中');
  return { id, name, displayName:string('displayName',100), description:string('description',4000), prompt:string('prompt',100000), enabled:input.enabled,
    provider:string('provider',100), model:string('model',200), reasoningEffort:string('reasoningEffort',80,true), fast:input.fast??false, tools:[...new Set(input.tools)], skills:[...new Set(skills)] };
}
// The launch snapshot, never the current catalog or parent session, owns the tier.
export function roleTierForRun(record) {
  return record?{locked:true,fast:record.selection?.fast===true}:null;
}
export class RoleStore {
  constructor(directory) { this.directory=directory; this.queue=Promise.resolve(); }
  async load(seed) {
    await mkdir(this.directory,{recursive:true,mode:0o700});
    try { this.catalog=JSON.parse(await readFile(join(this.directory,'roles.json'),'utf8')); }
    catch(e) { if(e.code!=='ENOENT') throw e; this.catalog={version:1,revision:1,roles:seed.map(validateRole)}; await this.atomic('roles.json',this.catalog); }
    if(this.catalog.version!==1 || !Number.isSafeInteger(this.catalog.revision)) throw new Error('不支持的角色目录格式');
    const roles=this.catalog.roles.map(validateRole);
    if(JSON.stringify(roles)!==JSON.stringify(this.catalog.roles)) {
      const next={...this.catalog,revision:this.catalog.revision+1,roles};
      await this.atomic('roles.json',next); this.catalog=next;
    }
    try { this.runs=JSON.parse(await readFile(join(this.directory,'runs.json'),'utf8')); }
    catch(e) { if(e.code!=='ENOENT') throw e; this.runs={version:1,items:[]}; }
    if(this.runs.version!==1 || !Array.isArray(this.runs.items)) throw new Error('不支持的成员记录格式');
    const items=this.runs.items.map(r=>r.selection && r.selection.fast===undefined?{...r,selection:{...r.selection,fast:false}}:r);
    if(JSON.stringify(items)!==JSON.stringify(this.runs.items)) {
      const next={...this.runs,items}; await this.atomic('runs.json',next); this.runs=next;
    }
  }
  async atomic(name,value) {
    const path=join(this.directory,name), temporary=path+'.'+randomUUID()+'.tmp';
    await writeFile(temporary,JSON.stringify(value,null,2)+'\n',{mode:0o600});
    await rename(temporary,path);
  }
  transaction(fn) { const result=this.queue.then(fn); this.queue=result.catch(()=>{}); return result; }
  change(revision,transform) {
    return this.transaction(async()=>{
      if(revision!==this.catalog.revision) throw new Error('角色目录已被其他页面修改，请刷新后重试');
      const roles=transform(structuredClone(this.catalog.roles)).map(validateRole);
      if(new Set(roles.map(r=>r.name)).size!==roles.length || new Set(roles.map(r=>r.id)).size!==roles.length) throw new Error('角色名称或标识重复');
      if(roles.length>100) throw new Error('最多保存 100 个角色');
      const next={version:1,revision:revision+1,roles}; await this.atomic('roles.json',next); this.catalog=next; return next;
    });
  }
  saveRun(record) {
    return this.transaction(async()=>{
      const next=structuredClone(this.runs), index=next.items.findIndex(r=>r.sessionId===record.sessionId);
      if(index<0) next.items.push(record); else next.items[index]={...next.items[index],...record};
      await this.atomic('runs.json',next); this.runs=next;
    });
  }
  run(id) { return this.runs.items.find(r=>r.sessionId===id); }
}
