import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {apply,delegationDenial,normalizeDelegationRules,delegationSettings,saveDelegationSettings} from './index.js';
const rules=[{leaderModel:'lead-small',denyModels:['target-large']}];
const noop=()=>{};
const fixture=JSON.parse(await readFile(new URL('./fixtures/roles.json',import.meta.url),'utf8'))[0];
async function setup(fn,config={delegationRules:rules}) {
  const dir=await mkdtemp(join(tmpdir(),'agent-roles-delegation-'));
  try {
    const roles=['lead-small','target-mid','target-large','target-other'].map((model,i)=>({...fixture,id:'role-'+i,name:'role-'+i,enabled:true,provider:'test',model}));
    await writeFile(join(dir,'roles.json'),JSON.stringify({version:1,revision:1,roles}));
    await writeFile(join(dir,'runs.json'),JSON.stringify({version:1,items:[{sessionId:'old-large',role:roles[0],selection:{model:'target-large',fast:false}}]}));
    let model='lead-small',spawns=0,modelChecks=0;
    const guards=[],tools=new Map(),providers=new Map(),listeners=new Map();
    const parent={id:'lead',options:{model:'target-large'},session:{requestHeader:()=>({config:{model}})},ctx:{
      tools:{guard(fn){guards.push(fn);return noop;},register(tool){tools.set(tool.name,tool);return noop;}},
      systemPrompt:{context:()=>noop},on(name,fn){listeners.set(name,fn);return noop;}
    }};
    const members=[{id:'old-large',name:'old-large',role:'teammate',model:'lead-small'},{id:'unknown',name:'unknown',role:'teammate'},{id:'other',name:'other',role:'teammate',model:'target-other'}];
    const ctx={agents:{list:()=>[parent],get:()=>undefined},
      agentTeams:{tryMembership:()=>({role:'lead'}),membership:()=>({role:'lead'}),listMembers:()=>members,async spawnTeammate(_parent,request){spawns++;return {member:{id:'new',name:request.name}};}},
      subagents:{registerProvider(p){providers.set(p.name,p);return noop;}},
      llm:{listProviders:()=>[{id:'test'}],async listModels(){modelChecks++;return roles.map(r=>({id:r.model}));},resolveModelInfo:async()=>({})},
      on:()=>noop,effect:fn=>fn(),webServer:{register:()=>noop},connection:{requestRejection:()=>undefined},
      skills:{snapshot:async()=>({complete:true,skills:[]})},workingDirectory:{defaultDirectory:dir}};
    await apply(ctx,{dataDir:dir,...config});
    await fn({dir,roles,parent,tools,providers,guards,listeners,setModel:value=>{model=value;},get spawns(){return spawns;},get modelChecks(){return modelChecks;}});
  } finally {
    assert.equal(resolve(dir),dir);assert.ok(dir.startsWith(join(tmpdir(),'agent-roles-delegation-')));await rm(dir,{recursive:true,force:true});
  }
}
test('精确模型限制，默认不限制且不靠角色名称判断',()=>{
  for(const target of rules[0].denyModels) assert.match(delegationDenial('lead-small',target,rules),/不允许调用/);
  assert.equal(delegationDenial('lead-small','target-other',rules),undefined);
  assert.equal(delegationDenial('target-mid','target-large',rules),undefined);
  assert.equal(delegationDenial('lead-small','target-large'),undefined);
});
test('禁止目标在 native spawn 前拒绝，provider 入口也拒绝且不写启动快照',()=>setup(async app=>{
  const signal=new AbortController().signal,spawn=app.tools.get('spawn_role');
  for(const role of app.roles.slice(2,3)) {
    await assert.rejects(spawn.execute({role:role.name,name:'blocked',prompt:'test'},{agent:app.parent,signal}),/不允许调用/);
    await assert.rejects(app.providers.get('agent-role-'+role.id).prepareContinuable({sessionId:'blocked',parent:app.parent,signal}),/不允许调用/);
  }
  assert.equal(app.spawns,0);assert.equal(app.modelChecks,0);
  const disk=JSON.parse(await readFile(join(app.dir,'runs.json'),'utf8'));assert.equal(disk.items.length,1);
  await spawn.execute({role:app.roles[1].name,name:'allowed-mid',prompt:'test'},{agent:app.parent,signal});assert.equal(app.spawns,1);
  await app.providers.get('agent-role-'+app.roles[1].id).prepareContinuable({sessionId:'allowed-mid',parent:app.parent,signal});assert.equal(app.modelChecks,1);
}));
test('守卫阻止通用委派和唤醒历史昂贵成员；按实际请求模型动态切换',()=>setup(async app=>{
  const guard=app.guards[0];
  for(const name of ['spawn_teammate','subagent','subagent_fork']) assert.match(guard({name}),/请使用 spawn_role/);
  assert.match(guard({name:'send_message',arguments:{target:'old-large'}}),/target-large/);
  assert.match(guard({name:'send_message',arguments:{target:'unknown'}}),/无法确认/);
  for(const name of ['read','list_agents','interrupt_agent']) assert.equal(guard({name}),undefined);
  assert.equal(guard({name:'send_message',arguments:{target:'other'}}),undefined);
  app.setModel('target-mid');assert.equal(guard({name:'spawn_teammate'}),undefined);
  assert.equal(guard({name:'send_message',arguments:{target:'old-large'}}),undefined);
  await app.tools.get('spawn_role').execute({role:app.roles[2].name,name:'now-allowed',prompt:'test'},{agent:app.parent});assert.equal(app.spawns,1);
  app.setModel('lead-small');assert.match(guard({name:'send_message',arguments:{target:'old-large'}}),/不允许调用/);
}));
test('当轮提示目录用新选模型过滤，而非旧 header 或冻结 options',()=>setup(async app=>{
  const assemble=app.listeners.get('system-prompt/assemble');
  for(const [model,blocked] of [['lead-small',true],['target-mid',false]]) {
    const next={variables:{model},contexts:[{name:'agent-roles:directory',text:'old'},{name:'other',text:'preserved'}]};
    const result=await assemble({},undefined,async()=>next);
    assert.equal(result.contexts[0].text.includes('role-1 —'),true);assert.equal(result.contexts[0].text.includes('role-2 —'),!blocked);
    assert.ok(result.contexts[0].text.includes('role-0 —'));assert.equal(result.contexts[1].text,'preserved');
  }
}));

test('通用规则归一化、去重和严格输入校验',()=>{
  assert.deepEqual(normalizeDelegationRules(),[]);
  assert.deepEqual(normalizeDelegationRules([{leaderModel:' lead-small ',denyModels:['target-large','target-large']},{leaderModel:'lead-small',denyModels:['target-other']},{leaderModel:'unused',denyModels:[]}]),[{leaderModel:'lead-small',denyModels:['target-large','target-other']}]);
  for(const value of [null,{},[{leaderModel:'',denyModels:[]}],[{leaderModel:'lead',denyModels:['']}],[{leaderModel:'lead',denyModels:'target'}]])assert.throws(()=>normalizeDelegationRules(value));
  assert.equal(delegationDenial('lead-small','target-mid',rules),undefined);
});
test('原生配置保存保留其他字段并拒绝过期页面修改',async()=>{
  const entry={},ctx={fiber:{entry}};let current={dataDir:'/example/data',fastProviders:['example'],delegationRules:rules};
  ctx.configEditor={entries:()=>[entry],async edit(actual,change){assert.equal(actual,entry);current=change(structuredClone(current),{});}};
  const before=delegationSettings(ctx,rules);assert.equal(before.settingsWritable,true);
  assert.deepEqual(await saveDelegationSettings(ctx,before.settingsRevision,[{leaderModel:'another',denyModels:['target-large']}]),{saved:true});
  assert.equal(current.dataDir,'/example/data');assert.deepEqual(current.fastProviders,['example']);
  const saved=structuredClone(current);await assert.rejects(saveDelegationSettings(ctx,before.settingsRevision,[]),/其他窗口修改/);assert.deepEqual(current,saved);
  const latest=delegationSettings(ctx,current.delegationRules);await saveDelegationSettings(ctx,latest.settingsRevision,[]);assert.deepEqual(current.delegationRules,[]);
});
test('无原生配置编辑服务时保持只读并明确报错',async()=>{
  assert.equal(delegationSettings({},[]).settingsWritable,false);
  await assert.rejects(saveDelegationSettings({},'',[]),/不支持在线保存/);
});
