import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {Readable} from 'node:stream';
import {RoleStore,validateRole} from './store.js';
import {apply,validateModel,selectionFor,roleTierForRun} from './index.js';

const seed=JSON.parse(await readFile(new URL('./fixtures/roles.json',import.meta.url),'utf8'));
const role=validateRole({...seed[0],enabled:true,provider:'test',model:'same-model',reasoningEffort:'high'});
const info={reasoning:{efforts:[{id:'high'}]}};
const noop=()=>{};
// Only remove the synthetic directory allocated by this test.
async function temporary(fn) {
  const dir=await mkdtemp(join(tmpdir(),'agent-roles-fast-'));
  try {await fn(dir);} finally {
    assert.equal(resolve(dir),dir);
    assert.ok(dir.startsWith(join(tmpdir(),'agent-roles-fast-')));
    await rm(dir,{recursive:true,force:true});
  }
}
async function catalog(dir,roles=[role]) {
  await writeFile(join(dir,'roles.json'),JSON.stringify({version:1,revision:1,roles}));
}
function agent(id) {
  const listeners=new Map();let selection;
  return {id,listeners,model:{current:()=>selection&&structuredClone(selection),select:value=>{selection=structuredClone(value);}},ctx:{tools:{presentAs:()=>noop,guard:()=>noop,get:()=>undefined,restrict:()=>noop},systemPrompt:{section:()=>noop},on(name,fn){const list=listeners.get(name)??[];list.push(fn);listeners.set(name,list);return noop;}}};
}
async function boot(dir,agents=[],config={fastProviders:['test']}) {
  const providers=new Map(),events=new Map();
  let handler;
  const ctx={
    llm:{listProviders:()=>[{id:'test'}],listModels:async()=>[{id:'same-model'}],resolveModelInfo:async()=>info},
    agents:{list:()=>agents,get:id=>agents.find(a=>a.id===id)},
    subagents:{registerProvider(provider){providers.set(provider.name,provider);return noop;}},
    on(name,fn){events.set(name,fn);return noop;},effect:fn=>fn(),
    webServer:{register(route){handler=route.handler;return noop;}},
    connection:{requestRejection:()=>undefined},
    skills:{snapshot:async()=>({complete:true,skills:[]}),get:async()=>undefined},
    workingDirectory:{defaultDirectory:dir},
  };
  await apply(ctx,{dataDir:dir,...config});
  return {ctx,providers,async tier(sessionId){const runs=JSON.parse(await readFile(join(dir,'runs.json'),'utf8'));return roleTierForRun(runs.items.find(r=>r.sessionId===sessionId));},async api(action,body={}){
    const req=Readable.from([Buffer.from(JSON.stringify({action,...body}))]);
    req.method='POST';req.headers={'content-type':'application/json'};
    const res={statusCode:200,setHeader:noop,end(value){this.body=value;}};
    await handler(req,res);
    return {status:res.statusCode,value:JSON.parse(res.body)};
  }};
}

test('全新安装目录为空且 Fast 默认关闭',()=>temporary(async dir=>{
  const app=await boot(dir,[],{});
  assert.deepEqual((await app.api('list')).value.catalog.roles,[]);
  assert.deepEqual((await app.api('models')).value.fastProviders,[]);
  assert.equal(app.providers.size,0);
}));

test('Fast 默认不启用，支持清单可配置且不影响标准模型选择',async()=>{
  const llm={listProviders:()=>[{id:'cpa'},{id:'test'}],listModels:async()=>[{id:'same-model'}],resolveModelInfo:async()=>info};
  await assert.rejects(validateModel(llm,{...role,provider:'cpa',fast:true}),/不支持 Fast/);
  await validateModel(llm,{...role,provider:'cpa',fast:true},undefined,['cpa']);
  await assert.rejects(validateModel(llm,{...role,fast:true}),/不支持 Fast：test/);
  assert.throws(()=>selectionFor({...role,fast:true},info),/不支持 Fast：test/);
  await validateModel(llm,{...role,fast:true},undefined,['test']);
  assert.throws(()=>selectionFor({...role,provider:'cpa',fast:true},info,[]),/不支持 Fast：cpa/);
  assert.equal(selectionFor({...role,fast:false},info,[]).fast,false);
});

test('Fast 保存与新启动受支持清单限制，旧非法快照保留不变',()=>temporary(async dir=>{
  await catalog(dir,[{...role,fast:true}]);
  const legacy={sessionId:'existing',role:{...role,fast:true},selection:{provider:'test',model:'same-model',reasoningEffort:'high',fast:true}};
  await writeFile(join(dir,'runs.json'),JSON.stringify({version:1,items:[legacy]}));
  const app=await boot(dir,[agent('existing')],{});
  assert.deepEqual((await app.api('models')).value.fastProviders,[]);
  assert.deepEqual(await app.tier('existing'),{locked:true,fast:true});
  const disk=JSON.parse(await readFile(join(dir,'runs.json'),'utf8'));
  assert.deepEqual(disk.items,[legacy]);
  for(const enabled of [true,false]) {
    const saved=await app.api('save',{revision:1,role:{...role,enabled,fast:true}});
    assert.equal(saved.status,400);assert.match(saved.value.error,/不支持 Fast：test/);
  }
  const provider=app.providers.get('agent-role-'+role.id);
  await assert.rejects(provider.prepareContinuable({sessionId:'rejected',parent:{id:'parent'},signal:new AbortController().signal}),/不支持 Fast：test/);
  assert.deepEqual(JSON.parse(await readFile(join(dir,'runs.json'),'utf8')),disk);
  assert.equal((await app.api('list')).value.catalog.revision,1);
  const configured=await boot(dir,[],{fastProviders:['test']});
  assert.deepEqual((await configured.api('models')).value.fastProviders,['test']);
  assert.equal((await configured.api('save',{revision:1,role:{...role,fast:true}})).status,200);
  await configured.providers.get('agent-role-'+role.id).prepareContinuable({sessionId:'configured',parent:{id:'parent'},signal:new AbortController().signal});
  assert.deepEqual(await configured.tier('configured'),{locked:true,fast:true});
  const disabled=await boot(dir,[],{fastProviders:[]});
  assert.deepEqual((await disabled.api('models')).value.fastProviders,[]);
  assert.equal((await disabled.api('save',{revision:2,role:{...role,fast:true}})).status,400);
}));

test('Fast 严格布尔校验、缺省标准；字段规范化不丢 Fast',()=>{
  assert.equal(validateRole({...role,fast:undefined}).fast,false);
  for(const fast of [true,false])assert.equal(validateRole({...role,fast}).fast,fast);
  for(const fast of [null,0,1,'false','true',{},[]])assert.throws(()=>validateRole({...role,fast}),/fast 必须为布尔值/);
  assert.deepEqual(selectionFor({...role,fast:true},info,['test']),{provider:'test',model:'same-model',reasoningEffort:'high',fast:true});
});

test('旧目录和选择快照幂等迁移；旧记录不读取角色当前 Fast',()=>temporary(async dir=>{
  const oldRole={...role};delete oldRole.fast;
  await catalog(dir,[oldRole]);
  const items=[
    {sessionId:'old',role:{...role,fast:true},selection:{provider:'test',model:'same-model'}},
    {sessionId:'fast',role,selection:{provider:'test',model:'same-model',fast:true}},
    {sessionId:'missing-selection',role:{...role,fast:true}},
  ];
  await writeFile(join(dir,'runs.json'),JSON.stringify({version:1,items}));
  const store=new RoleStore(dir);await store.load(seed);
  assert.equal(store.catalog.revision,2);assert.equal(store.catalog.roles[0].fast,false);
  assert.deepEqual(store.run('old'),{...items[0],selection:{...items[0].selection,fast:false}});
  assert.deepEqual(store.run('fast'),items[1]);assert.deepEqual(store.run('missing-selection'),items[2]);
  assert.deepEqual(roleTierForRun(store.run('old')),{locked:true,fast:false});
  assert.deepEqual(roleTierForRun(store.run('missing-selection')),{locked:true,fast:false});
  assert.deepEqual(roleTierForRun(store.run('fast')),{locked:true,fast:true});
  assert.equal(roleTierForRun(store.run('parent')),null);
  const before=await Promise.all(['roles.json','runs.json'].map(name=>readFile(join(dir,name),'utf8')));
  const restored=new RoleStore(dir);await restored.load(seed);
  assert.deepEqual(await Promise.all(['roles.json','runs.json'].map(name=>readFile(join(dir,name),'utf8'))),before);
}));

test('新成员在准备时持久化 Fast，后续编辑、删除、重载保持启动档位',()=>temporary(async dir=>{
  await catalog(dir);
  const app=await boot(dir),provider=app.providers.get('agent-role-'+role.id);
  const prepare=sessionId=>provider.prepareContinuable({sessionId,parent:{id:'parent',fast:true},signal:new AbortController().signal});
  await prepare('standard');
  let disk=JSON.parse(await readFile(join(dir,'runs.json'),'utf8'));
  assert.deepEqual(disk.items[0].selection,{provider:'test',model:'same-model',reasoningEffort:'high',fast:false});
  assert.deepEqual(await app.tier('standard'),{locked:true,fast:false});
  let saved=await app.api('save',{revision:1,role:{...role,fast:true}});assert.equal(saved.status,200);
  await prepare('fast');
  assert.deepEqual(await app.tier('fast'),{locked:true,fast:true});
  saved=await app.api('save',{revision:saved.value.catalog.revision,role:{...role,fast:false}});assert.equal(saved.status,200);
  assert.equal((await app.api('delete',{revision:saved.value.catalog.revision,id:role.id})).status,200);
  const member=agent('fast'),restored=await boot(dir,[member]);
  assert.deepEqual(await restored.tier('fast'),{locked:true,fast:true});
  assert.deepEqual(await restored.tier('standard'),{locked:true,fast:false});
  assert.equal(await restored.tier('parent'),null);
  assert.equal((await restored.api('sessionTier',{sessionId:'fast'})).status,400);
  // The current native API records the complete role route before the first step.
  assert.deepEqual(member.model.current(),{provider:'test',model:'same-model',reasoningEffort:'high'});
  disk=JSON.parse(await readFile(join(dir,'runs.json'),'utf8'));
  assert.equal(disk.items.find(r=>r.sessionId==='fast').selection.fast,true);
}));

test('没有选择快照的旧成员恢复为标准，持久化后仍不继承角色或主会话 Fast',()=>temporary(async dir=>{
  await catalog(dir,[{...role,fast:true}]);
  await writeFile(join(dir,'runs.json'),JSON.stringify({version:1,items:[{sessionId:'legacy',role:{...role,fast:true}}]}));
  const app=await boot(dir,[agent('legacy')],{});
  assert.deepEqual(await app.tier('legacy'),{locked:true,fast:false});
  const disk=JSON.parse(await readFile(join(dir,'runs.json'),'utf8'));
  assert.deepEqual(disk.items[0].selection,{provider:'test',model:'same-model',reasoningEffort:'high',fast:false});
}));
