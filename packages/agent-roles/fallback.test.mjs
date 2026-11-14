import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile, realpath, rm, watch } from 'node:fs/promises';
import { Readable } from 'node:stream';
import { tmpdir } from 'node:os';
import { join, dirname, basename } from 'node:path';
import { Context } from '@deepseek-ai/cordis';
import Sessions from '@deepseek-ai/dsh-session';
import Projections from '@deepseek-ai/dsh-session-projection';
import SessionQuery from '@deepseek-ai/dsh-session-query';
import * as JsonlPersistence from '@deepseek-ai/dsh-session-persistence-jsonl';
import Agents from '@deepseek-ai/dsh-agent';
import AgentLoop from '@deepseek-ai/dsh-agent-loop';
import Subagents from '@deepseek-ai/dsh-subagent';
import Teams from '@deepseek-ai/dsh-agent-team';
import LlmRuntime, { LlmAdapter, LlmError } from '@deepseek-ai/dsh-llm';
import SystemPrompt from '@deepseek-ai/dsh-system-prompt';
import Tools, { defineTool } from '@deepseek-ai/dsh-tools';
import { NativeToolExecutor } from '@deepseek-ai/dsh-tool-executor-native';
import * as NativeRetry from '@deepseek-ai/dsh-llm-retry';
import * as Roles from './index.js';
import { installRoleFallback, runModelChain } from './fallback.js';

const primary={provider:'primary',model:'first',reasoningEffort:'high',fast:false};
const backup={provider:'backup',model:'second',fast:true};
const newRecord=()=>({sessionId:'member',role:{...primary},modelChain:[structuredClone(primary),structuredClone(backup)],fallbackIndex:0,selection:structuredClone(primary),fallbackHistory:[]});
function controlled(record=newRecord(),options={}) {
  const listeners=new Map(),queued=[],selections=[],saved=[],continuations=[];
  const agent={id:record.sessionId,model:{select:value=>selections.push(structuredClone(value))},inbox:{get nextTurn(){return queued;},append(_target,message){queued.push(message);},remove(id){const i=queued.findIndex(m=>m.id===id);if(i<0)return false;queued.splice(i,1);return true;}},followup:message=>continuations.push(message),ctx:{on(name,fn,config){assert.equal(config.prepend,true);listeners.set(name,fn);return ()=>listeners.delete(name);}}};
  const dispose=installRoleFallback(agent,record,{persist:async()=>saved.push(structuredClone(record)),observe:()=>saved.push(structuredClone(record)),...options});
  const controller=new AbortController();
  let downstream=0;
  return {record,agent,queued,selections,saved,continuations,dispose,controller,listeners,get downstream(){return downstream;},fail(code='PROVIDER',step=1){return listeners.get('agent/request-error')({agent,turn:1,step,provider:record.selection.provider,failure:{code,message:'synthetic '+code},signal:controller.signal},()=>{downstream++;return {kind:'retry'};});},idle(){listeners.get('agent/status')({agent,status:'idle'});}};
}

test('bounded retries own the Host waterfall: exactly three extra calls at 1/2/4 seconds, then next-turn switch',async()=>{
  const delays=[],f=controlled(newRecord(),{wait:async ms=>{delays.push(ms);return true;}});
  const original=structuredClone(f.record.modelChain);
  for(let n=0;n<3;n++)assert.deepEqual(await f.fail(),{kind:'retry'});
  assert.equal(await f.fail(),undefined);
  assert.deepEqual(delays,[1000,2000,4000]);assert.equal(f.downstream,0);
  assert.deepEqual(f.selections,[{provider:'backup',model:'second'}]);
  assert.equal(f.record.fallbackIndex,1);assert.equal(f.record.selection.fast,true);
  assert.deepEqual(f.record.modelChain,original);assert.deepEqual(f.record.role,primary);
  assert.deepEqual(f.record.fallbackHistory[0].from,primary);assert.deepEqual(f.record.fallbackHistory[0].to,backup);
  assert.equal(f.queued.length,1);assert.equal(f.continuations.length,0);
  f.idle();assert.equal(f.queued.length,0);assert.equal(f.continuations.length,1);
  assert.equal(f.record.retry.status,'continued');
  for(let n=0;n<3;n++)assert.deepEqual(await f.fail('MODEL',2),{kind:'retry'});
  await assert.rejects(f.fail('MODEL',2),/模型链已耗尽/);
  assert.equal(f.record.retry.status,'exhausted');assert.equal(f.downstream,0);f.dispose();
});

test('quota skips delays; cancellation and disposal suppress both retry and staged continuation',async()=>{
  for(const code of ['QUOTA','ACCOUNT_QUOTA']) {
    const f=controlled(newRecord(),{wait:async()=>assert.fail('quota must not wait')});
    await f.fail(code);assert.equal(f.record.fallbackIndex,1);assert.equal(f.record.retry.retries,0);
    f.controller.abort({kind:'user'});f.idle();await Promise.resolve();assert.equal(f.continuations.length,0);assert.equal(f.queued.length,0);f.dispose();
  }
  for(const code of ['ABORTED','CANCELLED','CANCELED']) {
    const f=controlled();assert.equal(await f.fail(code),undefined);assert.equal(f.selections.length,0);assert.equal(f.downstream,0);f.dispose();
  }
  const f=controlled(newRecord(),{wait:async(_ms,signal)=>{f.controller.abort({kind:'user'});return !signal.aborted;}});
  assert.equal(await f.fail(),undefined);assert.equal(f.selections.length,0);assert.equal(f.record.retry.status,'cancelled');f.dispose();
  const staged=controlled();await staged.fail('QUOTA');staged.dispose();await Promise.resolve();assert.equal(staged.queued.length,0);assert.equal(staged.continuations.length,0);
});

test('snapshot restoration uses active route; legacy records never inherit later catalog fallbacks',()=>{
  const legacy={role:{...primary,fallbacks:[backup]},selection:{...primary}};
  assert.deepEqual(runModelChain(legacy),{chain:[primary],index:0});
  const unchanged=controlled(legacy);assert.equal(unchanged.listeners.size,0);unchanged.dispose();
  const record=newRecord();record.fallbackIndex=1;record.selection=structuredClone(backup);
  const f=controlled(record);assert.equal(f.record.selection.model,'second');f.dispose();
  assert.throws(()=>runModelChain({...record,selection:primary}),/快照不一致/);
});

test('whole-chain validation resolves each route independently and rejects bad effort, Fast and unavailable models',async()=>{
  const resolved=[];
  const llm={listProviders:()=>[{id:'primary'},{id:'backup'}],listModels:async p=>[{id:p==='primary'?'first':'second'}],resolveModelInfo:async(p,m)=>{resolved.push([p,m]);return p==='primary'?{reasoning:{efforts:[{id:'high'}]}}:{};}};
  const role={...primary,fallbacks:[{...backup,reasoningEffort:'off'}]};
  assert.deepEqual(await Roles.validateModelChain(llm,role,undefined,['backup']),[primary,backup]);
  assert.deepEqual(resolved,[['primary','first'],['backup','second']]);
  await assert.rejects(Roles.validateModelChain(llm,role),/不支持 Fast/);
  await assert.rejects(Roles.validateModelChain(llm,{...role,fallbacks:[{...backup,reasoningEffort:'high'}]},undefined,['backup']),/不支持思考强度/);
  await assert.rejects(Roles.validateModelChain(llm,{...role,fallbacks:[{...backup,model:'missing'}]},undefined,['backup']),/不在 DSH 已配置清单/);
});

function* completed(text) {
  yield {type:'block-start',index:0,blockType:'text'};
  yield {type:'text-delta',index:0,text};
  yield {type:'block-end',index:0,block:{type:'text',text}};
  yield {type:'finish',reason:{kind:'stop'}};
}
async function nativeHost(t,stream,{role,prepare,delegationRules=[]}={}) {
  const parent=await realpath(tmpdir()),directory=await mkdtemp(join(parent,'roles-fallback-'));
  const ctx=new Context(),calls=[],events=[],settlements=[],logs=[];
  t.after(async()=>{await ctx.fiber.dispose();const target=await realpath(directory);assert.equal(dirname(target),parent);assert.ok(basename(target).startsWith('roles-fallback-'));await rm(target,{recursive:true,force:true});});
  ctx.on('session/event',(session,event)=>events.push({sessionId:session.id,...event}));
  ctx.on('subagent/end',event=>settlements.push(event));
  ctx.provide('workingDirectory',{defaultDirectory:directory,ensure:async(_agent,signal)=>{signal.throwIfAborted();return directory;},set:async(_agent,_cwd,signal)=>{signal.throwIfAborted();}});
  let handler;
  ctx.provide('webServer',{register(route){handler=route.handler;return ()=>{handler=undefined;};}});
  ctx.provide('connection',{requestRejection:()=>undefined});
  ctx.provide('skills',{snapshot:async()=>({complete:true,skills:[]}),get:async()=>undefined});
  await ctx.plugin(Sessions);await ctx.plugin(Projections);
  await ctx.plugin(JsonlPersistence,{root:join(directory,'sessions'),compression:'none'});
  await ctx.plugin(SessionQuery);
  await ctx.plugin(Agents);
  new SystemPrompt(ctx,{includeHarnessIdentity:true});new Tools(ctx);ctx.tools.setExecutor(new NativeToolExecutor(ctx));new LlmRuntime(ctx);
  class SyntheticAdapter extends LlmAdapter {
    providerInfo(provider){return {id:provider,name:provider};}
    providerRetryPolicy(){return {mode:'always',initialDelayMs:1,maxDelayMs:1,jitterRatio:0};}
    async listModels(provider){return [{provider,id:provider==='primary'?'first':provider==='backup'?'second':'lead',name:'Synthetic'}];}
    async resolveModel(provider,id){await prepare?.(provider,id);return {provider,id,name:'Synthetic',...provider==='primary'?{reasoning:{efforts:[{id:'high',name:'High'}]}}:{}};}
    async *stream(options){calls.push(options);yield* stream(options,calls);}
  }
  // Separate registrations and adapter instances prove cross-provider history
  // stays in the native transcript, without borrowing private replay metadata.
  for(const provider of ['primary','backup','lead'])ctx.llm.registerAdapter([provider],new SyntheticAdapter());
  await ctx.plugin(AgentLoop,{agents:[],maxParallelToolCalls:1});
  await ctx.plugin(Subagents);await ctx.plugin(Teams);await ctx.plugin(NativeRetry);
  ctx.on('agent/error',({agent,error})=>logs.push({id:agent.id,error}));
  const configured=role??{id:'synthetic',name:'synthetic',displayName:'Synthetic',description:'Synthetic test role',prompt:'SYNTHETIC_ROLE_PROMPT',enabled:true,...primary,fallbacks:[backup],tools:['read'],skills:[]};
  await writeFile(join(directory,'roles.json'),JSON.stringify({version:1,revision:1,roles:[configured]}));
  const roleMount=await ctx.plugin(Roles,{dataDir:directory,fastProviders:['backup'],delegationRules});
  const rootHandle=await ctx.agents.create({sessionId:'fallback-lead',agentOptions:{provider:'lead',model:'lead'},meta:{cwd:directory}});
  t.after(()=>rootHandle.dispose());
  return {ctx,directory,calls,events,settlements,logs,roleMount,root:rootHandle.agent,
    async spawn(name='worker'){return ctx.tools.get('spawn_role',rootHandle.agent).execute({role:configured.name,name,prompt:'ORIGINAL_TASK'},{agent:rootHandle.agent,signal:new AbortController().signal});},
    async runs(){return JSON.parse(await readFile(join(directory,'runs.json'),'utf8')).items;},
    async api(action,body={}) {
      const req=Readable.from([JSON.stringify({action,...body})]);req.method='POST';req.headers={'content-type':'application/json'};
      const res={statusCode:200,setHeader(){},end(value){this.body=value;}};
      await handler(req,res);return {status:res.statusCode,...JSON.parse(res.body)};
    },
    async waiting() {
      const changes=watch(directory,{signal:AbortSignal.timeout(5000)});
      try {
        for await(const _change of changes) {
          let records;try{records=await this.runs();}catch(error){if(error.code==='ENOENT')continue;throw error;}
          const record=records.find(record=>record.retry?.status==='waiting');if(record)return record;
        }
      } finally {await changes.return();}
    },
  };
}

test('native activation: committed tool executes once; frozen role survives fallback, remount and cold resume with one settlement per activation',async t=>{
  let toolExecutions=0;
  const done=Promise.withResolvers(),backupEntered=Promise.withResolvers(),releaseBackup=Promise.withResolvers();
  const h=await nativeHost(t,async function*(request,calls){
    if(request.provider==='lead'){yield* completed('lead received result');return;}
    const own=calls.filter(call=>call.sessionId===request.sessionId);
    if(own.length===1) {
      yield {type:'block-start',index:0,blockType:'tool-call'};
      yield {type:'tool-call-delta',index:0,id:'one-tool',name:'read',argumentsDelta:'{}'};
      yield {type:'block-end',index:0,block:{type:'tool-call',id:'one-tool',name:'read',arguments:'{}'}};
      yield {type:'finish',reason:{kind:'tool-calls'}};return;
    }
    if(request.provider==='primary')throw new LlmError('synthetic quota','QUOTA');
    assert.equal(request.provider,'backup');
    assert.equal(request.reasoningEffort,undefined,'next route must not inherit high effort');
    const body=JSON.stringify(request.messages);
    assert.match(body,/ORIGINAL_TASK/);assert.match(body,/COMMITTED_TOOL_RESULT/);assert.match(body,/SYNTHETIC_ROLE_PROMPT/);
    assert.deepEqual(request.tools.map(tool=>tool.name),['read']);
    backupEntered.resolve();await releaseBackup.promise;
    yield* completed('BACKUP_SUCCESS');done.resolve();
  });
  h.ctx.tools.register(defineTool({name:'read',description:'Synthetic no-side-effect tool',parameters:{},output:{schema:{type:'object',additionalProperties:true},render:()=>[{type:'text',text:'COMMITTED_TOOL_RESULT'}]},execute:async()=>{toolExecutions++;return {synthetic:true};}}));
  const settled=Promise.withResolvers();h.ctx.on('subagent/end',event=>settled.resolve(event));
  const {member}=await h.spawn();
  await backupEntered.promise;
  // The role catalog can change after launch. Reinstallation must use the run
  // snapshot, including the active fallback's independent Fast flag.
  await writeFile(join(h.directory,'roles.json'),JSON.stringify({version:1,revision:2,roles:[]}));
  await h.roleMount.restart();
  assert.deepEqual(h.ctx.agents.get(member.id).model.current(),{provider:'backup',model:'second'});
  assert.equal((await h.runs())[0].selection.fast,true);
  releaseBackup.resolve();await done.promise;
  const terminal=await settled.promise;
  await h.root.whenIdle();
  assert.equal(toolExecutions,1);assert.equal(terminal.id,member.id);
  assert.equal(h.settlements.length,1);assert.equal((await h.ctx.subagents.listDescendants(h.root.id)).find(m=>m.id===member.id).activity,'inactive');
  const own=h.calls.filter(call=>call.sessionId===member.id);
  assert.deepEqual(own.map(call=>call.provider),['primary','primary','backup']);
  assert.equal(new Set(own.map(call=>call.sessionId)).size,1);
  const boundaries=h.events.filter(event=>event.sessionId===member.id&&event.type==='turn/end');
  assert.deepEqual(boundaries.map(event=>event.data.reason.kind),['error','completed']);
  assert.equal(h.events.filter(event=>event.sessionId===member.id&&event.type==='tool/result').length,1);
  assert.equal(h.events.filter(event=>event.sessionId===member.id&&event.type==='llm/retry').length,0,'native always retry must be bypassed');
  const parentNotices=h.events.filter(event=>event.sessionId===h.root.id&&event.type==='user/message'&&event.data.source?.kind==='subagent-settled');
  assert.equal(parentNotices.length,1);assert.match(JSON.stringify(parentNotices[0]),/BACKUP_SUCCESS/);
  assert.equal(h.ctx.agents.get(member.id),undefined,'settlement releases the native child before cold continuation');
  await h.roleMount.update({dataDir:h.directory,fastProviders:['backup'],delegationRules:[{leaderModel:'lead',denyModels:['second']}]});
  let deliveries=0;
  h.ctx.tools.register(defineTool({name:'send_message',description:'Synthetic message delivery',parameters:{agent:{type:'string',required:true},message:{type:'string',required:true}},output:{schema:{type:'object',additionalProperties:true},render:()=>[]},execute:async()=>{deliveries++;return {};}}));
  const allow=h.root.ctx.on('tools/pre-execute',async()=>({kind:'allow'}));
  for(const reference of [member.name,member.id]) {
    const batch=await h.ctx.tools.execute({calls:[{type:'tool-call',id:'blocked-message',name:'send_message',arguments:JSON.stringify({agent:reference,message:'blocked'})}],agent:h.root,signal:new AbortController().signal});
    assert.equal(batch.results[0].result.isError,true);
    assert.match(batch.results[0].result.error.message,/不允许调用/);
  }
  allow();
  assert.equal(deliveries,0,'native names and session-id aliases obey the same cold-model restriction');
  await h.roleMount.update({dataDir:h.directory,fastProviders:['backup'],delegationRules:[]});
  const continued=Promise.withResolvers();h.ctx.on('subagent/end',event=>continued.resolve(event));
  await h.ctx.subagents.sendMessage(h.root,member.id,[{type:'text',text:'COLD_FOLLOWUP'}],{signal:new AbortController().signal});
  await continued.promise;await h.root.whenIdle();
  assert.equal(h.settlements.length,2,'one settlement for each accepted activation');
  const resumed=h.calls.filter(call=>call.sessionId===member.id).at(-1);
  assert.equal(resumed.provider,'backup');assert.match(JSON.stringify(resumed.messages),/COLD_FOLLOWUP/);
  assert.deepEqual(resumed.tools.map(tool=>tool.name),['read']);assert.equal(toolExecutions,1);
  // Disposing the plugin drains asynchronous observation saves before checking
  // its durable terminal record (the live native lifecycle already settled).
  await h.roleMount.dispose();
  const [record]=await h.runs();
  assert.equal(record.fallbackIndex,1);assert.deepEqual(record.selection,backup);assert.deepEqual(record.modelChain,[primary,backup]);
  assert.equal(record.status,'inactive');assert.equal(record.error,undefined);
  assert.deepEqual(record.audit.provider,'backup');assert.equal(record.audit.fast,true);assert.equal(record.audit.rolePromptPresent,true);
  assert.equal(record.fallbackHistory.length,1);
  await writeFile(join(h.directory,'runs.json'),JSON.stringify({version:1,items:[]}));
  await h.ctx.plugin(Roles,{dataDir:h.directory,fastProviders:['backup']});
  const beforeMissing=h.calls.length;
  await assert.rejects(h.ctx.subagents.sendMessage(h.root,member.id,[{type:'text',text:'MISSING_SNAPSHOT'}],{signal:new AbortController().signal}),error=>error.code==='NOT_RESUMABLE'&&/角色启动快照缺失/.test(error.cause?.message));
  assert.equal(h.calls.length,beforeMissing,'a known role provider without its launch snapshot cannot run');
});

test('native live config preserves an owned retry; disposal drains its final native idle state',async t=>{
  for(const mode of ['update','dispose'])await t.test(mode,async t=>{
    const h=await nativeHost(t,async function*(request,calls){
      if(request.provider==='lead'){yield* completed('lead received result');return;}
      if(request.provider==='primary')throw new LlmError('synthetic failure',calls.filter(call=>call.sessionId===request.sessionId).length===1?'PROVIDER':'QUOTA');
      yield* completed('BACKUP_SUCCESS');
    });
    const bridge=h.ctx.get('roleTiers'),settled=Promise.withResolvers();h.ctx.on('subagent/end',event=>settled.resolve(event));
    assert.equal(bridge.get(h.root.id),undefined);assert.ok(Object.isFrozen(bridge));
    const waiting=h.waiting(),{member}=await h.spawn(),agent=h.ctx.agents.get(member.id);await waiting;
    assert.deepEqual(bridge.get(member.id),{fast:false,locked:true,source:'role'});
    if(mode==='update') {
      const config={dataDir:h.directory,fastProviders:['primary','backup'],delegationRules:[{leaderModel:'unrelated',denyModels:['second']}]};
      await h.roleMount.update(config);
      assert.equal(h.ctx.get('roleTiers'),bridge,'ordinary policy updates must retain the instance');
      const active=(await h.api('runs')).runs.find(record=>record.sessionId===member.id);
      assert.equal(active.status,'running');assert.equal(active.retry.status,'waiting');
      assert.deepEqual((await h.api('models')).fastProviders,['primary','backup']);
      await settled.promise;await agent.whenIdle();await h.root.whenIdle();
      assert.deepEqual(h.calls.filter(call=>call.sessionId===member.id).map(call=>call.provider),['primary','primary','backup']);
      assert.deepEqual(bridge.get(member.id),{fast:true,locked:true,source:'role'});
      const {catalog}=await h.api('list');
      assert.equal((await h.api('save',{revision:catalog.revision,role:{...catalog.roles[0],fast:true}})).status,200,'new saves read the live Fast provider policy');
      await h.roleMount.update({...config,delegationRules:[{leaderModel:'lead',denyModels:['first']}]});
      await assert.rejects(h.spawn('denied'),/委派限制/);
      await h.roleMount.update({...config,dataDir:h.directory+'/.',delegationRules:[]});
      assert.notEqual(h.ctx.get('roleTiers'),bridge,'structural config changes remount');
      assert.deepEqual(h.ctx.get('roleTiers').get(member.id),{fast:true,locked:true,source:'role'});
      const api=(await h.api('runs')).runs.find(record=>record.sessionId===member.id);
      assert.equal(api.status,'inactive');assert.equal(api.nativeStatus,'inactive');assert.equal(api.turnEndReason.kind,'completed');
      await h.roleMount.dispose();
      const record=(await h.runs()).find(record=>record.sessionId===member.id);
      assert.equal(record.status,api.status);assert.deepEqual(record.turnEndReason,api.turnEndReason);
    } else {
      await h.roleMount.dispose();await agent.whenIdle();await settled.promise;await h.root.whenIdle();
      const record=(await h.runs()).find(record=>record.sessionId===member.id);
      assert.equal(record.retry.status,'cancelled');assert.equal(record.status,'inactive');assert.equal(record.nativeStatus,'inactive');
      assert.equal(record.turnEndReason.kind,'error');assert.equal(h.calls.filter(call=>call.sessionId===member.id).length,1);
      await h.ctx.plugin(Roles,{dataDir:h.directory,fastProviders:['backup']});
      assert.equal((await h.api('runs')).runs.find(record=>record.sessionId===member.id).status,record.status);
    }
  });
});

test('native failed remount releases prior agents and the partially installed member effects',async t=>{
  const h=await nativeHost(t,async function*(){yield* completed('SUCCESS');});
  const settled=Promise.withResolvers();h.ctx.on('subagent/end',event=>settled.resolve(event));
  const {member}=await h.spawn();await settled.promise;await h.root.whenIdle();
  const restored=await h.ctx.agents.resume({resumeSessionId:member.id,parentAgent:h.root,agentOptions:{provider:'primary',model:'first'}});t.after(()=>restored.dispose());
  await h.roleMount.dispose();
  const records=await h.runs();records[0].modelChain[0].model='mismatched-snapshot';
  await writeFile(join(h.directory,'runs.json'),JSON.stringify({version:1,items:records}));
  await assert.rejects(async()=>{await h.ctx.plugin(Roles,{dataDir:h.directory,fastProviders:['backup']});},/快照不一致/);
  assert.equal(h.ctx.tools.get('spawn_role',h.root),undefined);
  assert.equal(h.ctx.get('roleTiers'),undefined);
  // This succeeds only when the failed mount released its provider registration.
  const unregister=h.ctx.subagents.registerProvider({name:'agent-role-synthetic',prepareContinuable:async()=>({})});unregister();
  const agent=h.ctx.agents.get(member.id);
  // Native executor disposal intentionally leaves an unavailable scoped slot.
  assert.throws(()=>agent.ctx.tools.selectExecutor(agent),{code:'TOOL_EXECUTOR_UNAVAILABLE'});
  const replace=agent.ctx.tools.setExecutor(new NativeToolExecutor(agent.ctx));replace();
});

test('native cancellation after a failed turn removes the staged continuation without a backup call',async t=>{
  const h=await nativeHost(t,async function*(request){
    if(request.provider==='lead'){yield* completed('lead received cancellation');return;}
    throw new LlmError('synthetic quota','ACCOUNT_QUOTA');
  });
  h.ctx.on('session/event',(session,event)=>{
    if(session.id!==h.root.id&&event.type==='turn/end'&&event.data.reason.kind==='error')h.ctx.agents.get(session.id)?.cancel({kind:'user'},{keepInbox:true});
  });
  const settled=Promise.withResolvers();h.ctx.on('subagent/end',event=>settled.resolve(event));
  const {member}=await h.spawn();await settled.promise;await h.root.whenIdle();
  assert.deepEqual(h.calls.filter(call=>call.sessionId===member.id).map(call=>call.provider),['primary']);
  assert.equal(h.settlements.length,1);
  assert.equal(h.events.filter(event=>event.sessionId===member.id&&event.type==='user/message'&&event.data.source?.kind==='agent-role-fallback').length,0);
  await h.roleMount.dispose();
  assert.equal((await h.runs())[0].retry.status,'cancelled');
});

test('native delegation policy validates every launch candidate and rechecks the leader before switching',async t=>{
  for(const mode of ['launch','switch']) {
    await t.test(mode,async t=>{
      const h=await nativeHost(t,async function*(request){
        if(request.provider==='lead'){yield* completed('lead received denial');return;}
        h.root.model.select({provider:'lead',model:'restricted'});
        await h.roleMount.update({dataDir:h.directory,fastProviders:['backup'],delegationRules:[{leaderModel:'restricted',denyModels:['second']}]});
        throw new LlmError('synthetic quota','QUOTA');
      },{delegationRules:mode==='launch'?[{leaderModel:'lead',denyModels:['second']}]:[]});
      if(mode==='launch') {
        await assert.rejects(h.spawn(),/委派限制.*second/);
        await assert.rejects(readFile(join(h.directory,'runs.json'),'utf8'),error=>error.code==='ENOENT');
        assert.equal(h.calls.length,0);
      } else {
        const settled=Promise.withResolvers();h.ctx.on('subagent/end',event=>settled.resolve(event));
        const {member}=await h.spawn();await settled.promise;await h.root.whenIdle();await h.roleMount.dispose();
        assert.deepEqual(h.calls.filter(call=>call.sessionId===member.id).map(call=>call.provider),['primary']);
        const [record]=await h.runs();
        assert.equal(record.fallbackIndex,0);assert.deepEqual(record.fallbackHistory,[]);assert.match(record.error,/委派限制.*second/);
      }
    });
  }
});

test('native thrown preparation and prompt-plugin errors remain terminal even when typed as LlmError/QUOTA',async t=>{
  for(const kind of ['preparation','plugin']) {
    await t.test(kind,async t=>{
      let resolved=0;
      const h=await nativeHost(t,async function*(request){assert.equal(request.provider,'lead');yield* completed('lead received failure');},{prepare:async provider=>{
        if(kind==='preparation'&&provider==='primary'&&++resolved>1)throw new LlmError('synthetic preparation failure','QUOTA');
      }});
      if(kind==='plugin')h.ctx.on('agent/pre-step',({agent},next)=>{
        if(agent.id!==h.root.id)throw new LlmError('synthetic prompt plugin failure','QUOTA');
        return next();
      },{prepend:true});
      const settled=Promise.withResolvers();h.ctx.on('subagent/end',event=>settled.resolve(event));
      // Native activation confirms inbox acceptance; preparation and prompt
      // failures are reported by its terminal lifecycle, not a Team checkpoint.
      const {member}=await h.spawn();
      assert.ok(member.id);
      await settled.promise;await h.root.whenIdle();
      assert.equal(h.calls.filter(call=>call.sessionId===member.id).length,0);
      await h.roleMount.dispose();
      const [record]=await h.runs();
      assert.equal(record.fallbackIndex,0);assert.deepEqual(record.fallbackHistory,[]);
      assert.equal(record.status,'failed');assert.match(record.error,/synthetic .*failure/);
    });
  }
});
