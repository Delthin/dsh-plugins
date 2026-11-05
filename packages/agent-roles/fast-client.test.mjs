import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {runInNewContext} from 'node:vm';

const source=await readFile(new URL('./client.js',import.meta.url),'utf8');
const role={id:'test',name:'test',displayName:'测试角色',description:'职责',prompt:'任务',enabled:true,provider:'test',model:'same-model',reasoningEffort:'',tools:[]};
function panel(draft=role,fastProviders=['test']) {
  const state=[{revision:1,roles:[draft]},[{provider:'test',id:'same-model'}],[],draft,JSON.stringify(draft),{},false,'','','roles','config','','',[],null,null,[],'','',false,fastProviders];
  let cursor=0,entry,module,request;
  const h=(type,props,...children)=>({type,props:props??{},children:children.flat(Infinity)});
  const primitives=Object.fromEntries(['Button','Switch','Checkbox','SegmentedControl','Modal'].map(name=>[name,()=>{}]));
  const React={createElement:h,useState(initial){const i=cursor++;if(!(i in state))state[i]=initial;return [state[i],value=>{state[i]=typeof value==='function'?value(state[i]):value;}];},useEffect(){}};
  runInNewContext(source,{document:{createElement:()=>({dataset:{},remove(){}}),head:{appendChild(){}}},window:{__ModuleLoader__:{load(value){module=value.factory(name=>name==='react'?React:primitives);}}},crypto:{randomUUID:()=> 'new-role'},fetch:async(_url,options)=>{request=JSON.parse(options.body);return {ok:true,json:async()=>({catalog:{revision:2,roles:[request.role]}})};}});
  module.apply({effect(){},slots:{inject(_key,fn){fn();},register(options,render){if(options.key==='agent-roles')entry=render();}},uiWorkspace:{}});
  return {state,primitives,render(){cursor=0;return entry.type(entry.props);},get request(){return request;}};
}
function nodes(tree) {return !tree||typeof tree!=='object'?[]:[tree,...tree.children.flatMap(nodes)];}
function text(tree) {return !tree||typeof tree==='boolean'?'':typeof tree!=='object'?String(tree):tree.children.map(text).join(' ');}

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

test('运行列表显示选择快照 Fast 或标准，而不读取当前角色 Fast',()=>{
  const app=panel();app.state[9]='runs';
  app.state[13]=[
    {sessionId:'standard',memberName:'standard',role:{...role,fast:true},selection:{fast:false},audit:{},createdAt:'2026-01-01T00:00:00Z',status:'inactive'},
    {sessionId:'fast',memberName:'fast',role:{...role,fast:false},selection:{fast:true},audit:{},createdAt:'2026-01-01T00:00:00Z',status:'inactive'},
    {sessionId:'old',memberName:'old',role:{...role,fast:true},audit:{},createdAt:'2026-01-01T00:00:00Z',status:'inactive'},
  ];
  const articles=nodes(app.render()).filter(n=>n.type==='article');
  assert.match(text(articles[0]),/same-model · 标准/);
  assert.match(text(articles[1]),/same-model · Fast/);
  assert.match(text(articles[2]),/same-model · 标准/);
});
