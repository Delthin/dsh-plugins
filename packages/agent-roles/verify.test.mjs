import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {RoleStore,validateRole} from './store.js';
import {validateModel,selectionFor,roleSystem} from './index.js';
const seed=JSON.parse(await readFile(new URL('./fixtures/roles.json',import.meta.url),'utf8'));

test('旧角色目录移除模式与来源字段，保留正文、选择和历史快照',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'agent-roles-migration-'));
 try {const legacy={...seed[0],promptMode:'replace',source:'legacy',sourceModel:'old',sourceHash:'hash'};await writeFile(join(dir,'roles.json'),JSON.stringify({version:1,revision:5,roles:[legacy]}));await writeFile(join(dir,'runs.json'),JSON.stringify({version:1,items:[{sessionId:'existing',role:legacy}]}));const s=new RoleStore(dir);await s.load(seed);assert.deepEqual(s.catalog.roles,[{...seed[0],fast:false,skills:[]}]);assert.equal(s.catalog.revision,6);assert.deepEqual(s.run('existing').role,legacy);const restored=new RoleStore(dir);await restored.load(seed);assert.deepEqual(restored.catalog,s.catalog);}finally{await rm(dir,{recursive:true,force:true});}
});

test('并发保存只接受当前 revision；失败不破坏后续队列',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'agent-roles-test-'));
 try {const s=new RoleStore(dir);await s.load(seed);const results=await Promise.allSettled([s.change(1,r=>r),s.change(1,r=>r)]);assert.equal(results.filter(x=>x.status==='fulfilled').length,1);assert.match(results.find(x=>x.status==='rejected').reason.message,/刷新/);await s.change(2,r=>r);assert.equal(s.catalog.revision,3);}finally{await rm(dir,{recursive:true,force:true});}
});
test('启动快照在目录编辑、删除与重新加载后保持原文和模型',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'agent-roles-test-'));
 try {const s=new RoleStore(dir);await s.load(seed);const role=structuredClone(seed[0]);await s.saveRun({sessionId:'test',role,roleRevision:1});await s.change(1,rs=>rs.map(r=>({...r,prompt:'changed'})));await s.change(2,rs=>rs.filter(r=>r.id!==role.id));const restored=new RoleStore(dir);await restored.load(seed);assert.deepEqual(restored.run('test').role,role);assert.equal(restored.run('test').roleRevision,1);assert.ok(!restored.catalog.roles.some(r=>r.id===role.id));}finally{await rm(dir,{recursive:true,force:true});}
});
test('模型和推理档位精确校验，无隐式供应商替换',async()=>{
 const llm={listProviders:()=>[{id:'cpa'},{id:'gemini-web'}],listModels:async p=>[{id:p==='cpa'?'model':'gemini'}],resolveModelInfo:async p=>p==='cpa'?{reasoning:{efforts:[{id:'high'}]}}:{}};
 const role={...seed[0],provider:'cpa',model:'model',reasoningEffort:'high'};assert.deepEqual(selectionFor(role,await validateModel(llm,role)),{provider:'cpa',model:'model',reasoningEffort:'high',fast:false});await assert.rejects(validateModel(llm,{...role,model:'absent'}),/清单/);await assert.rejects(validateModel(llm,{...role,reasoningEffort:'off'}),/不支持/);const gemini={...role,provider:'gemini-web',model:'gemini',reasoningEffort:'off'};assert.deepEqual(selectionFor(gemini,await validateModel(llm,gemini)),{provider:'gemini-web',model:'gemini',fast:false});
});
test('角色校验拒绝越界工具与重复标识，模板字符保持字面量',async()=>{
 assert.throws(()=>validateRole({...seed[0],tools:['spawn_teammate']}),/工具/);const r={...seed[0],prompt:'Keep {{literal}} exactly.'};assert.ok(roleSystem(r).startsWith(r.prompt+'\n'));const dir=await mkdtemp(join(tmpdir(),'agent-roles-test-'));try{const s=new RoleStore(dir);await s.load(seed);await assert.rejects(s.change(1,rs=>[...rs,rs[0]]),/重复/);assert.equal(s.catalog.revision,1);}finally{await rm(dir,{recursive:true,force:true});}
});
