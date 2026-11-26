import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {runInNewContext} from 'node:vm';
import {TOOLS,validateRole} from './store.js';

const source=await readFile(new URL('./client.js',import.meta.url),'utf8');
const role={id:'test',name:'test',displayName:'测试角色',description:'职责',prompt:'任务',enabled:true,provider:'test',model:'same-model',reasoningEffort:'',tools:[]};
function panel(draft=role,fastProviders=['test'],settings,respond) {
  const state=[{revision:1,roles:[draft]},[{provider:'test',id:'same-model'},{provider:'backup',id:'backup-model'},{provider:'third',id:'third-model'}],TOOLS,draft,JSON.stringify(draft),{},false,'','','roles','config','','',[],null,null,[],'','',false,fastProviders,{apiVersion:2,...settings}];
  let cursor=0,entry,module,request;const effects=[],events=new Map();
  const document={hidden:false,createElement:()=>({dataset:{},remove(){}}),head:{appendChild(){}},addEventListener:(n,f)=>events.set(n,f),removeEventListener:n=>events.delete(n)};
  const h=(type,props,...children)=>({type,props:props??{},children:children.flat(Infinity)});
  const primitives=Object.fromEntries(['Button','Switch','Checkbox','SegmentedControl','Modal'].map(name=>[name,()=>{}]));
  const React={createElement:h,useState(initial){const i=cursor++;if(!(i in state))state[i]=initial;return [state[i],value=>{state[i]=typeof value==='function'?value(state[i]):value;}];},useEffect(fn,deps){effects.push({fn,deps});}};
  runInNewContext(source,{document,AbortController,setTimeout,clearTimeout,window:{__ModuleLoader__:{load(value){module=value.factory(name=>name==='react'?React:primitives);}}},crypto:{randomUUID:()=> 'new-role'},fetch:async(_url,options)=>{const args=JSON.parse(options.body);request=args;if(respond)return {ok:true,json:async()=>{const value=await respond(args);return args.action==='list'?{apiVersion:2,...value}:value;}};return {ok:true,json:async()=>({catalog:{revision:2,roles:[...state[0].roles.filter(r=>r.id!==request.role.id),validateRole(request.role)]}})};}});
  module.apply({effect(){},slots:{inject(_key,fn){fn();},register(options,render){if(options.key==='agent-roles')entry=render();}},uiWorkspace:{}});
  return {state,primitives,document,events,effects,render(){cursor=0;effects.length=0;return entry.type(entry.props);},get request(){return request;}};
}
function nodes(tree) {return !tree||typeof tree!=='object'?[]:[tree,...tree.children.flatMap(nodes)];}
test('刷新同步重载草稿版本；保存期间锁住编辑并拒绝重复提交',async()=>{
  const latest={...role,prompt:'另一页面更新的正文'},pending=Promise.withResolvers();let saves=0;
  const app=panel(role,['test'],undefined,async request=>{
    if(request.action==='list')return {catalog:{revision:2,roles:[latest]},tools:TOOLS};
    if(request.action==='models')return {models:[{provider:'test',id:role.model}]};
    saves++;await pending.promise;return {catalog:{revision:2,roles:[request.role]}};
  });
  app.render();
  app.state[0]={revision:2,roles:[latest]};
  nodes(app.render()).find(n=>n.type==='form').props.onSubmit({preventDefault(){}});
  assert.equal(app.request.revision,1,'草稿不能借用后来加载的目录版本');
  const saving=app.render();
  assert.equal(nodes(saving).find(n=>n.type==='fieldset').props.disabled,true);
  assert.equal(nodes(saving).find(n=>n.props['aria-current']).props.disabled,true);
  nodes(saving).find(n=>n.type==='form').props.onSubmit({preventDefault(){}});
  await new Promise(resolve=>setImmediate(resolve));assert.equal(saves,1);
  pending.resolve();await new Promise(resolve=>setImmediate(resolve));
  app.state[3]={...app.state[3],description:'未保存修改'};
  nodes(app.render()).find(n=>n.props['aria-label']==='刷新').props.onClick();
  assert.match(app.state[15].title,/放弃/);
  await app.state[15].action();
  assert.equal(app.state[3].prompt,latest.prompt);assert.equal(app.state[3].description,latest.description);
  assert.equal(app.state[24],2);assert.equal(JSON.stringify(app.state[3]),app.state[4]);
});

function text(tree) {return !tree||typeof tree==='boolean'?'':typeof tree!=='object'?String(tree):tree.children.map(text).join(' ');}

test('备用模型按序增删移动并保存各自档位，不改动首选模型',async()=>{
  const app=panel();
  const chain=()=>{const node=nodes(app.render()).find(n=>typeof n.type==='function'&&n.props.primary);return node.type(node.props);};
  const add=()=>nodes(chain()).find(n=>n.type===app.primitives.Button&&n.children.includes('添加备用模型')).props.onClick();
  add();add();
  assert.equal(app.state[3].fallbacks.map(r=>r.provider).join(','),'backup,third');
  let rows=nodes(chain()).filter(n=>typeof n.type==='function'&&n.props.route);
  rows[1].props.onMove(-1);
  assert.equal(app.state[3].fallbacks.map(r=>r.provider).join(','),'third,backup');
  rows=nodes(chain()).filter(n=>typeof n.type==='function'&&n.props.route);
  rows[0].props.onChange({...rows[0].props.route,reasoningEffort:'high',fast:true});
  nodes(app.render()).find(n=>n.type==='form').props.onSubmit({preventDefault(){}});
  await new Promise(resolve=>setImmediate(resolve));
  assert.equal(app.request.role.model,role.model);
  assert.equal(app.request.role.fallbacks[0].provider,'third');
  assert.equal(app.request.role.fallbacks[0].reasoningEffort,'high');assert.equal(app.request.role.fallbacks[0].fast,true);
  rows=nodes(chain()).filter(n=>typeof n.type==='function'&&n.props.route);rows[0].props.onRemove();
  assert.equal(app.state[3].fallbacks.length,1);assert.equal(app.state[3].fallbacks[0].provider,'backup');
});

test('更新后旧后台要求重启，不显示不能保存的新编辑器',()=>{
  const app=panel();app.state[21]={};const tree=app.render();
  assert.match(text(tree),/请重启 DSH/);assert.equal(nodes(tree).some(n=>n.type==='form'),false);
});

test('成员轮询不重叠，后台暂停且离开时取消请求',async()=>{
  const pending=Promise.withResolvers();let requests=0;
  const app=panel(role,[],undefined,async()=>{requests++;return pending.promise;});app.state[9]='runs';app.render();
  const cleanup=app.effects.find(e=>e.deps[0]==='runs').fn();
  try {
    await new Promise(resolve=>setImmediate(resolve));assert.equal(requests,1);
    app.events.get('visibilitychange')();await new Promise(resolve=>setImmediate(resolve));assert.equal(requests,1);
    app.document.hidden=true;app.events.get('visibilitychange')();pending.resolve({runs:[],persistenceError:'disk failure'});
    await new Promise(resolve=>setImmediate(resolve));assert.equal(app.state[25],'disk failure');assert.equal(requests,1);
    app.document.hidden=false;app.events.get('visibilitychange')();await new Promise(resolve=>setImmediate(resolve));assert.equal(requests,2);
  } finally {cleanup();}
  assert.equal(app.events.size,0);
});

test('角色刷新不等待模型目录，模型异常不覆盖角色编辑状态',async()=>{
  const pending=Promise.withResolvers(),latest={...role,prompt:'最新正文'};
  const app=panel(role,[],undefined,async request=>request.action==='models'?pending.promise:{catalog:{revision:2,roles:[latest]},tools:TOOLS});
  nodes(app.render()).find(n=>n.props['aria-label']==='刷新').props.onClick();
  await new Promise(resolve=>setImmediate(resolve));
  assert.equal(app.state[3].prompt,latest.prompt);assert.equal(app.state[6],false);
  pending.resolve({models:[],errors:[{provider:'offline',error:'unavailable'}]});
  await new Promise(resolve=>setImmediate(resolve));assert.equal(app.state[7],'');assert.match(text(app.render()),/unavailable/);
});

test('后台作业权限显式勾选后保存，已有 bash 权限不会自动扩大',async()=>{
  const app=panel({...role,tools:['bash']});app.state[10]='tools';
  let tree=app.render();assert.match(text(tree),/耗时命令/);
  assert.deepEqual(app.state[3].tools,['bash']);
  for(const label of ['读取作业结果','停止后台作业']){
    tree=app.render();nodes(tree).find(n=>n.type===app.primitives.Checkbox&&text(n.props.label).includes(label)).props.onChange(true);
  }
  nodes(app.render()).find(n=>n.type==='form').props.onSubmit({preventDefault(){}});
  await new Promise(resolve=>setImmediate(resolve));
  assert.deepEqual(app.request.role.tools,['bash','job_output','job_kill']);
});

const tier=(tree,name)=>nodes(tree).find(n=>n.type==='button'&&n.children.includes(name));
test('模型选择器内显示标准 / Fast，切档保持模型并保存布尔值；新增角色默认标准',async()=>{
  const app=panel();
  let tree=app.render(),toggle=tier(tree,'Fast');
  const control=nodes(tree).find(n=>n.props.className==='ar-model-control');
  assert.ok(nodes(control).some(n=>n.type==='select'&&n.props.id==='ar-role-model'));
  assert.ok(nodes(control).includes(toggle));
  assert.equal(toggle.props['aria-pressed'],false);assert.equal(toggle.props.disabled,false);
  assert.equal(tier(tree,'标准').props['aria-pressed'],true);
  assert.match(text(tree),/新成员启动时固定/);assert.match(text(tree),/Fast：请求优先处理/);
  toggle.props.onClick();
  tree=app.render();assert.equal(tier(tree,'Fast').props['aria-pressed'],true);
  assert.equal(app.state[3].model,role.model);assert.equal(app.state[3].provider,role.provider);
  nodes(tree).find(n=>n.type==='form').props.onSubmit({preventDefault(){}});
  await new Promise(resolve=>setImmediate(resolve));
  assert.equal(app.request.action,'save');assert.equal(app.request.role.fast,true);
  tree=app.render();tier(tree,'标准').props.onClick();assert.equal(app.state[3].fast,false);
  tree=app.render();
  nodes(tree).find(n=>n.type===app.primitives.Button&&n.children.includes('新增角色')).props.onClick();
  assert.equal(app.state[3].fast,false);
});

test('不支持供应商禁止开启 Fast，但标准按钮始终可恢复；支持清单来自模型目录',()=>{
  const unsupported=panel(role,['cpa']);
  let tree=unsupported.render(),toggle=tier(tree,'Fast');
  assert.equal(toggle.props.disabled,true);assert.match(text(tree),/当前供应商不支持 Fast/);
  toggle.props.onClick();assert.equal(unsupported.state[3].fast,undefined);
  const existing=panel({...role,fast:true},['cpa']);
  tree=existing.render();assert.equal(tier(tree,'Fast').props['aria-pressed'],true);
  const standard=tier(tree,'标准');assert.equal(standard.props.disabled,false);standard.props.onClick();
  tree=existing.render();assert.equal(tier(tree,'标准').props['aria-pressed'],true);assert.equal(tier(tree,'Fast').props.disabled,true);
  const loading=panel(role,[]);
  assert.equal(tier(loading.render(),'Fast').props.disabled,true);
});

test('预置需明确选择模型并保存，保留既有角色和只读权限',async()=>{
  const override='私有预置第一段\n\n私有预置第二段';
  const app=panel(role,['test'],{presetPrompts:{'code-review':override,'code-search':'过时的本机预置'}});
  const preset=label=>{
    nodes(app.render()).find(n=>n.type===app.primitives.Button&&n.children.includes('从预置创建')).props.onClick();
    const modal=nodes(app.render()).find(n=>n.type===app.primitives.Modal&&n.props.open);
    assert.equal(nodes(modal).filter(n=>n.props.className==='ar-role').length,5);
    assert.doesNotMatch(text(modal),/代码检索/);
    nodes(modal).find(n=>n.type==='button'&&nodes(n).some(s=>s.children.includes(label))).props.onClick();
  };
  const save=()=>nodes(app.render()).find(n=>n.type==='form').props.onSubmit({preventDefault(){}});
  preset('代码审查');
  assert.equal(app.state[3].name,'code-review');
  assert.equal(app.state[3].enabled,false);
  assert.deepEqual(Array.from(app.state[3].tools),['read','glob','grep']);
  assert.equal(app.state[3].prompt,override);
  save();
  assert.equal(app.request,undefined);
  nodes(app.render()).find(n=>n.props.id==='ar-role-model').props.onChange({target:{value:'test/same-model'}});
  save();
  await new Promise(resolve=>setImmediate(resolve));
  assert.equal(app.request.role.model,'same-model');
  assert.equal(app.request.role.prompt,override);
  assert.equal(app.request.role.fallbacks,undefined);
  assert.deepEqual(app.state[0].roles.map(r=>r.id),[role.id,'new-role']);
  preset('代码审查');
  assert.equal(app.state[3],app.state[0].roles[1]);
  nodes(app.render()).find(n=>n.type===app.primitives.Switch).props.onChange(true);
  save();
  await new Promise(resolve=>setImmediate(resolve));
  assert.equal(app.request.role.enabled,true);
});
