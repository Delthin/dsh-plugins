import test from 'node:test';
import assert from 'node:assert/strict';
import { installRoleRuntime } from './runtime.js';

test('新版原生执行器只声明允许工具且保持原生批处理',async()=>{
  let executor,selected;
  const agent={model:{select:route=>{selected=route;}},ctx:{tools:{setExecutor:value=>{executor=value;return ()=>{};}}}};
  await installRoleRuntime(agent,{provider:'member-provider',model:'member-model',reasoningEffort:'high',fast:false},new Set(['read']));
  assert.deepEqual(selected,{provider:'member-provider',model:'member-model',reasoningEffort:'high'});
  const describe=executor.describe([{name:'read',description:'Read',parameters:{type:'object',properties:{}}},{name:'write',description:'Write',parameters:{type:'object',properties:{}}}]);
  assert.deepEqual(describe.schemas.map(tool=>tool.name),['read']);
  assert.deepEqual(await executor.execute({calls:[],signal:new AbortController().signal}),{results:[],additionalContexts:[],concluded:false});
});

test('新版零工具角色不会收到 PTC 入口或团队工具',async()=>{
  let executor;
  const agent={model:{select:()=>{}},ctx:{tools:{setExecutor:value=>{executor=value;return ()=>{};}}}};
  await installRoleRuntime(agent,{provider:'member-provider',model:'member-model'},new Set());
  assert.deepEqual(executor.describe([{name:'spawn_teammate'},{name:'read'}]).schemas,[]);
});
