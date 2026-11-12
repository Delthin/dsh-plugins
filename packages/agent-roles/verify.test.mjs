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

test('有序备用配置持久化、独立档位和旧角色兼容，拒绝重复和越界链',async()=>{
 const role={...seed[0],fallbacks:[{provider:'backup',model:'model-a'},{provider:'third',model:'model-b',reasoningEffort:'high',fast:true}]};
 const normalized=validateRole(role);assert.equal(normalized.fallbacks[0].fast,false);assert.equal(normalized.fallbacks[1].fast,true);
 assert.equal('fallbacks' in validateRole(seed[0]),false);
 assert.throws(()=>validateRole({...role,fallbacks:[{...seed[0]}]}),/重复/);
 assert.throws(()=>validateRole({...role,fallbacks:Array(16).fill(role.fallbacks[0])}),/最多/);
 assert.throws(()=>validateRole({...role,fallbacks:[{provider:'backup',model:'model',fast:'true'}]}),/布尔/);
 const dir=await mkdtemp(join(tmpdir(),'agent-roles-chain-'));
 try{const s=new RoleStore(dir);await s.load([role]);const reload=new RoleStore(dir);await reload.load([]);assert.deepEqual(reload.catalog.roles[0].fallbacks,normalized.fallbacks);assert.equal(reload.catalog.revision,s.catalog.revision);}finally{await rm(dir,{recursive:true,force:true});}
});

test('并发保存只接受当前 revision；失败不破坏后续队列',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'agent-roles-test-'));
 try {const s=new RoleStore(dir);await s.load(seed);const results=await Promise.allSettled([s.change(1,r=>r),s.change(1,r=>r)]);assert.equal(results.filter(x=>x.status==='fulfilled').length,1);assert.match(results.find(x=>x.status==='rejected').reason.message,/刷新/);await s.change(2,r=>r);assert.equal(s.catalog.revision,3);}finally{await rm(dir,{recursive:true,force:true});}
});
test('启动快照在目录编辑、删除与重新加载后保持原文和模型',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'agent-roles-test-'));
 try {const s=new RoleStore(dir);await s.load(seed);const role=structuredClone(seed[0]);await s.saveRun({sessionId:'test',role,roleRevision:1});await s.change(1,rs=>rs.map(r=>({...r,prompt:'changed'})));await s.change(2,rs=>rs.filter(r=>r.id!==role.id));const restored=new RoleStore(dir);await restored.load(seed);assert.deepEqual(restored.run('test').role,role);assert.equal(restored.run('test').roleRevision,1);assert.ok(!restored.catalog.roles.some(r=>r.id===role.id));}finally{await rm(dir,{recursive:true,force:true});}
});
test('观察写入合并且在途队列有界；关键落盘失败保留最新记录并可恢复',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'agent-roles-writes-'));
 try {
  const store=new RoleStore(dir);await store.load(seed);
  const history={sessionId:'history',role:seed[0],output:'preserved history'};
  await store.saveRun(history);
  const atomic=store.atomic.bind(store);let writes=0;
  store.atomic=async(name,value)=>{if(name==='runs.json')writes++;await atomic(name,value);};
  let record={sessionId:'active',role:seed[0],output:'0',error:'obsolete',audit:{requestSeq:1}};
  for(let n=0;n<100;n++){record={...record,output:String(n)};store.observeRun(record,assert.fail);}
  assert.equal(writes,0);await store.flushRuns();assert.equal(writes,1);
  assert.equal(JSON.parse(await readFile(join(dir,'runs.json'),'utf8')).items[1].output,'99');
  const entered=Promise.withResolvers(),release=Promise.withResolvers();let block=true;
  store.atomic=async(name,value)=>{writes++;if(block){block=false;entered.resolve();await release.promise;}await atomic(name,value);};
  const saving=store.saveRun(record);await entered.promise;
  for(let n=100;n<200;n++){record={...record,output:String(n)};store.observeRun(record,assert.fail);}
  assert.equal(writes,2);assert.equal(store.runTimer,undefined);
  release.resolve();await saving;assert.equal(writes,3);
  store.atomic=async()=>{throw new Error('synthetic disk failure');};
  record={...record,selection:{provider:'backup',model:'second',fast:true},output:'latest'};delete record.error;
  await assert.rejects(store.saveRun(record),/synthetic disk failure/);
  assert.equal(store.run('active').output,'latest');assert.equal(store.savedRunRevision<store.runRevision,true);
  store.atomic=atomic;await store.flushRuns();
  const disk=JSON.parse(await readFile(join(dir,'runs.json'),'utf8'));
  assert.deepEqual(disk.items,[history,record]);assert.equal(disk.items[1].error,undefined);
 } finally {assert.ok(dir.startsWith(join(tmpdir(),'agent-roles-writes-')));await rm(dir,{recursive:true,force:true});}
});
test('模型和推理档位精确校验，无隐式供应商替换',async()=>{
 const llm={listProviders:()=>[{id:'cpa'},{id:'gemini-web'}],listModels:async p=>[{id:p==='cpa'?'model':'gemini'}],resolveModelInfo:async p=>p==='cpa'?{reasoning:{efforts:[{id:'high'}]}}:{}};
 const role={...seed[0],provider:'cpa',model:'model',reasoningEffort:'high'};assert.deepEqual(selectionFor(role,await validateModel(llm,role)),{provider:'cpa',model:'model',reasoningEffort:'high',fast:false});await assert.rejects(validateModel(llm,{...role,model:'absent'}),/清单/);await assert.rejects(validateModel(llm,{...role,reasoningEffort:'off'}),/不支持/);const gemini={...role,provider:'gemini-web',model:'gemini',reasoningEffort:'off'};assert.deepEqual(selectionFor(gemini,await validateModel(llm,gemini)),{provider:'gemini-web',model:'gemini',fast:false});
});
test('角色校验拒绝越界工具与重复标识，模板字符保持字面量',async()=>{
 assert.throws(()=>validateRole({...seed[0],tools:['spawn_teammate']}),/工具/);const r={...seed[0],prompt:'Keep {{literal}} exactly.'};assert.ok(roleSystem(r).startsWith(r.prompt+'\n'));const dir=await mkdtemp(join(tmpdir(),'agent-roles-test-'));try{const s=new RoleStore(dir);await s.load(seed);await assert.rejects(s.change(1,rs=>[...rs,rs[0]]),/重复/);assert.equal(s.catalog.revision,1);}finally{await rm(dir,{recursive:true,force:true});}
});
