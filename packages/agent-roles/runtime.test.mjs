import test from 'node:test';
import assert from 'node:assert/strict';
import { installRoleRuntime } from './runtime.js';

test('旧工具声明接口仍过滤白名单，模型选择不传 Fast 或继承 effort',async()=>{
  let listener,selected,mode;
  const agent={model:{select:route=>{selected=route;}},ctx:{tools:{presentAs:value=>{mode=value;return ()=>{};}},on(name,fn){assert.equal(name,'system-prompt/assemble');listener=fn;return ()=>{};}}};
  const disposers=await installRoleRuntime(agent,{provider:'member-provider',model:'member-model',fast:true},new Set(['read']));
  assert.equal(mode,'native');assert.deepEqual(selected,{provider:'member-provider',model:'member-model'});
  const presentation={variables:{model:'member-model'},tools:[{name:'read'},{name:'write'},{name:'spawn_role'}]};
  assert.deepEqual((await listener({}, {},async()=>presentation)).tools,[{name:'read'}]);
  assert.equal(presentation.tools.length,3);assert.equal(disposers.length,2);
});

let nativeAvailable=true;
try{await import('@deepseek-ai/dsh-tool-executor-native');}catch(error){if(error.code==='ERR_MODULE_NOT_FOUND')nativeAvailable=false;else throw error;}
test('新版原生执行器只声明允许工具且保持原生批处理', {skip:!nativeAvailable},async()=>{
  let executor,selected;
  const agent={model:{select:route=>{selected=route;}},ctx:{tools:{setExecutor:value=>{executor=value;return ()=>{};}}}};
  await installRoleRuntime(agent,{provider:'member-provider',model:'member-model',reasoningEffort:'high',fast:false},new Set(['read']));
  assert.deepEqual(selected,{provider:'member-provider',model:'member-model',reasoningEffort:'high'});
  const describe=executor.describe([{name:'read',description:'Read',parameters:{type:'object',properties:{}}},{name:'write',description:'Write',parameters:{type:'object',properties:{}}}]);
  assert.deepEqual(describe.schemas.map(tool=>tool.name),['read']);
  assert.deepEqual(await executor.execute({calls:[],signal:new AbortController().signal}),{results:[],additionalContexts:[],concluded:false});
});

test('新版零工具角色不会收到 PTC 入口或团队工具', {skip:!nativeAvailable},async()=>{
  let executor;
  const agent={model:{select:()=>{}},ctx:{tools:{setExecutor:value=>{executor=value;return ()=>{};}}}};
  await installRoleRuntime(agent,{provider:'member-provider',model:'member-model'},new Set());
  assert.deepEqual(executor.describe([{name:'spawn_teammate'},{name:'read'}]).schemas,[]);
});
