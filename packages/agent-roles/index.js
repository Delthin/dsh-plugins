import { resolve } from 'node:path';
import { dshHomePath, expandHomePath } from '@deepseek-ai/dsh-home-paths';
import Schema from '@deepseek-ai/schemastery';
import { defineTool } from '@deepseek-ai/dsh-tools';
import { installRoleRuntime } from './runtime.js';
import { skillDirectory, captureSkills, skillSection, skillEvidence } from './skills.js';
import { RoleStore, validateRole, hash, TOOLS } from './store.js';
export { roleTierForRun } from './store.js';

export const name='agent-roles';
export const inject=['agents','agentTeams','subagents','systemPrompt','tools','llm','webServer','connection','sessions','skills','workingDirectory'];
const DEFAULT_FAST_PROVIDERS=[];
export const Config=Schema.object({
  dataDir:Schema.string().description("Role data directory; defaults to $DSH_HOME/agent-roles"),
  fastProviders:Schema.array(Schema.string()).default(DEFAULT_FAST_PROVIDERS),
  delegationRules:Schema.array(Schema.object({
    leaderModel:Schema.string().required().description("主代理模型 ID（精确匹配，不区分供应商）"),
    denyModels:Schema.array(Schema.string()).required().description("禁止创建或继续联系的子代理模型 ID"),
  })).default([]).description("模型委派限制；默认不限制。可在多智能体 → 设置中编辑。"),
});
const PREFIX='agent-role-';
// Persisted native sessions retain their original provider identifier.
const LEGACY_PREFIX='pi-role-';
const output={schema:{type:'object',additionalProperties:true},render:(_args,value)=>[{type:'text',text:JSON.stringify(value)}]};
const text=blocks=>typeof blocks==='string'?blocks:(blocks??[]).filter(b=>b.type==='text').map(b=>b.text).join('\n');
export function roleSystem(role) {
  return role.prompt+'\n\n## DSH 团队协作\n'+
    '你在 DSH 原生 Agent Team 的独立成员会话中处理分配的任务，不继承主代理历史。不得递归委派。完成后直接返回结果，DSH 会把结果通知主代理；后续消息继续在本会话处理。'+
    (role.tools.length ? '使用分配给本角色的工具，遵守任务范围与授权。' : '本角色没有工具；主代理应直接提供正文、材料和必要技能要点，负责检索、落盘与验证。');
}
export async function modelDirectory(llm) {
  const models=[], errors=[];
  for(const provider of llm.listProviders()) {
    try { for(const model of await llm.listModels(provider.id)) models.push({...model,provider:provider.id}); }
    catch(e) { errors.push({provider:provider.id,error:String(e.message??e)}); }
  }
  return {models,errors};
}
function validateFastProvider(role,fastProviders) {
  if(role.fast===true && !fastProviders.includes(role.provider)) throw new Error('供应商不支持 Fast：'+role.provider+'；请关闭 Fast 或选择支持的供应商');
}
export async function validateModel(llm,role,signal,fastProviders=DEFAULT_FAST_PROVIDERS) {
  validateFastProvider(role,fastProviders);
  if(!llm.listProviders().some(p=>p.id===role.provider)) throw new Error('模型供应商未启用：'+role.provider);
  const models=await llm.listModels(role.provider);
  if(!models.some(m=>m.id===role.model)) throw new Error('模型不在 DSH 已配置清单中：'+role.provider+'/'+role.model);
  const info=await llm.resolveModelInfo(role.provider,role.model,signal);
  if(role.reasoningEffort && !(role.reasoningEffort==='off' && !info.reasoning) && !info.reasoning?.efforts.some(e=>e.id===role.reasoningEffort)) throw new Error('该模型不支持思考强度：'+role.reasoningEffort);
  return info;
}
// Omit effort when the configured model exposes no reasoning setting.
export function selectionFor(role,info,fastProviders=DEFAULT_FAST_PROVIDERS) {
  validateFastProvider(role,fastProviders);
  const reasoningEffort=role.reasoningEffort==='off' && !info.reasoning?'':role.reasoningEffort;
  return {provider:role.provider,model:role.model,...reasoningEffort?{reasoningEffort}:{},fast:role.fast===true};
}
export function normalizeDelegationRules(value=[]) {
  if(!Array.isArray(value)||value.length>128) throw new Error('委派规则必须是数组，最多 128 条');
  const byLeader=new Map();
  const modelId=value=>{if(typeof value!=='string'||!value.trim()||value.length>256)throw new Error('模型 ID 必须为 1–256 字符的非空字符串');return value.trim();};
  for(const rule of value){
    if(!rule||typeof rule!=='object'||!Array.isArray(rule.denyModels)||rule.denyModels.length>128)throw new Error('每条规则须包含主模型和禁止模型列表（最多 128 个）');
    const leader=modelId(rule.leaderModel),targets=byLeader.get(leader)??new Set();
    for(const target of rule.denyModels)targets.add(modelId(target));
    byLeader.set(leader,targets);
  }
  return [...byLeader].filter(([,targets])=>targets.size).map(([leaderModel,targets])=>({leaderModel,denyModels:[...targets].sort()})).sort((a,b)=>a.leaderModel.localeCompare(b.leaderModel));
}
function settingsEntry(ctx){return ctx.configEditor?.entries().find(entry=>entry===ctx.fiber?.entry);}
export function delegationSettings(ctx,rules) {
  return {delegationRules:rules,settingsRevision:hash(JSON.stringify(normalizeDelegationRules(rules))),settingsWritable:!!settingsEntry(ctx)};
}
export async function saveDelegationSettings(ctx,revision,value) {
  const rules=normalizeDelegationRules(value),entry=settingsEntry(ctx);
  if(!entry)throw new Error('当前环境不支持在线保存插件配置，请编辑 profile 的 cordis.patch.yml');
  await ctx.configEditor.edit(entry,current=>{
    if(hash(JSON.stringify(normalizeDelegationRules(current.delegationRules)))!==revision)throw new Error('委派规则已被其他窗口修改，请刷新后重试');
    return {...current,delegationRules:rules};
  });
  return {saved:true};
}
export function delegationDenial(leaderModel,targetModel,rules=[]) {
  if(rules.some(rule=>rule.leaderModel===leaderModel && rule.denyModels.includes(targetModel))) return '委派限制：主代理 '+leaderModel+' 不允许调用 '+targetModel+' 子代理；请自行完成、选择允许的角色，或由用户切换主代理模型。';
}
function currentModel(agent) {
  return agent?.model?.current()?.model??agent?.session?.requestHeader()?.config.model??agent?.options?.model;
}
export async function apply(ctx,config) {
  const fastProviders=config.fastProviders??DEFAULT_FAST_PROVIDERS;
  let configContext={};
  // Cordis dependencies are service-name maps, not required/optional groups.
  // A child injection enables settings when the optional native service exists.
  ctx.inject?.(['configEditor'],settings=>{
    const active={configEditor:settings.configEditor,fiber:ctx.fiber};
    configContext=active;
    settings.effect(()=>()=>{if(configContext===active)configContext={};});
  });
  const delegationRules=normalizeDelegationRules(config.delegationRules);
  const isRestricted=agent=>delegationRules.some(rule=>rule.leaderModel===currentModel(agent));
  function assertDelegation(parent,model) {
    const reason=delegationDenial(currentModel(parent),model,delegationRules);
    if(reason) throw new Error(reason);
  }
  const directory=config.dataDir?resolve(expandHomePath(config.dataDir)):dshHomePath('agent-roles');
  const store=new RoleStore(directory); await store.load([]);
  const providers=new Map(), installed=new Map(), liveRecords=new Map();
  let persistenceError;
  const persist=record=>{ liveRecords.set(record.sessionId,record); return store.saveRun(structuredClone(record)); };
  const observed=record=>{ persist(record).catch(e=>{persistenceError=String(e.message??e);}); };
  function registerProvider(id,prefix=PREFIX) {
    const providerName=prefix+id;
    if(providers.has(providerName)) return;
    const provider={name:providerName,inheritsParentContext:false,capabilities:{agentOptions:true,agentPreset:true,outputSchema:true,depthLimit:true},
      async prepareContinuable({sessionId,parent,cwd,signal}) {
        signal.throwIfAborted();
        const catalog=store.catalog, roleRevision=catalog.revision;
        const role=structuredClone(catalog.roles.find(r=>r.id===id));
        if(!role?.enabled) throw new Error('角色已停用或删除：'+id);
        assertDelegation(parent,role.model);
        const info=await validateModel(ctx.llm,role,signal,fastProviders); signal.throwIfAborted();
        const skillSnapshot=await captureSkills(ctx.skills,role.skills,{cwd,signal}); signal.throwIfAborted();
        assertDelegation(parent,role.model);
        await persist({sessionId,parentSessionId:parent.id,teamProvider:providerName,role,skillSnapshot,selection:selectionFor(role,info,fastProviders),roleRevision,createdAt:new Date().toISOString(),status:'provisioning',audit:{},output:''});
        return {};
      }};
    providers.set(providerName,ctx.subagents.registerProvider(provider));
  }
  for(const role of store.catalog.roles) registerProvider(role.id);
  for(const record of store.runs.items) registerProvider(record.role.id,record.teamProvider?.startsWith(PREFIX)?PREFIX:LEGACY_PREFIX);
  async function install(agent) {
    if(installed.has(agent)) return;
    const disposers=[]; installed.set(agent,disposers);
    const add=dispose=>disposers.push(dispose);
    const snapshot=store.run(agent.id);
    if(snapshot) {
      const record=structuredClone(snapshot), role=record.role;
      // Legacy snapshots are normalized once; new snapshots retain their exact route.
      if(!record.selection) {
        const legacyRole={...role,fast:false};
        record.selection=selectionFor(legacyRole,await validateModel(ctx.llm,legacyRole,undefined,fastProviders),fastProviders);
        await persist(record);
      }
      liveRecords.set(agent.id,record);
      const scoped=agent.ctx, allowed=new Set(role.tools);
      for(const dispose of await installRoleRuntime(agent,record.selection,allowed)) add(dispose);
      // Remove native discovery as well as the tool schema; bodies come from the launch snapshot.
      if(scoped.tools.get('skill',agent)) add(scoped.tools.restrict({deny:['skill']}));
      add(scoped.systemPrompt.section({name:'agent-roles:skills',order:10310,text:skillSection(record.skillSnapshot),interpolate:false}));
      // The monotonic guard also covers scope-local Team tools and PTC dispatch.
      add(scoped.tools.guard(exec=>allowed.has(exec.name)?undefined:'角色 '+role.name+' 不允许工具 '+exec.name));
      // Tool schemas and execution are constrained by the scoped native executor and guard.
      add(scoped.systemPrompt.section({name:'agent-roles:role',order:10300,text:roleSystem(role),interpolate:false}));
      return;
    }
    const membership=ctx.agentTeams.tryMembership(agent);
    if(membership?.role==='teammate') {
      const member=ctx.agentTeams.listMembers(agent).find(m=>m.id===agent.id);
      if(member?.provider && [PREFIX,LEGACY_PREFIX].some(prefix=>member.provider.startsWith(prefix))) throw new Error('角色启动快照缺失，拒绝以主代理配置恢复成员');
      return;
    }
    if(membership?.role!=='lead') return;
    add(agent.ctx.tools.guard(exec=>{
      if(!isRestricted(agent)) return;
      if(['spawn_teammate','subagent','subagent_fork'].includes(exec.name)) return '当前主代理有模型委派限制，请使用 spawn_role，由角色配置校验目标模型。';
      if(exec.name!=='send_message') return;
      const member=ctx.agentTeams.listMembers(agent).find(m=>m.name===exec.arguments?.target);
      if(!member || member.role==='lead') return;
      const record=liveRecords.get(member.id)??store.run(member.id);
      const model=record?.selection?.model??record?.role.model??currentModel(ctx.agents.get(member.id))??member.model;
      return model?delegationDenial(currentModel(agent),model,delegationRules):'无法确认成员模型，当前委派策略禁止唤醒该成员。';
    }));
    const directoryText=(model=currentModel(agent))=>{
      const roles=store.catalog.roles.filter(r=>r.enabled && !delegationDenial(model,r.model,delegationRules));
      return '可用角色（DSH 原生 Agent Team）\n'+roles.map(r=>r.name+' — '+r.description+' ['+r.provider+'/'+r.model+'; '+(r.reasoningEffort||'模型默认')+']'+(r.skills?.length?' 技能：'+r.skills.join(', '):'')).join('\n')+
        delegationRules.filter(rule=>rule.leaderModel===model).map(rule=>'\n委派限制：当前主代理 '+model+'，禁止创建或唤醒 '+rule.denyModels.join('、')+' 成员。不得改用通用委派工具绕过；如需升级模型，请交由用户切换主代理。').join('')+
        '\n按任务需要自主选择角色，用 spawn_role 创建有明确任务边界的后台成员；不要用通用 spawn_teammate 代替角色分发。独立任务可并行，写文件范围避免重叠。成员没有你的历史，必须提供目标、材料、路径、授权和验收条件。小任务直接完成。使用原生 list_agents 查看成员，send_message({target:成员名称,message:反馈}) 继续沟通，interrupt_agent 中断。结果由原生后台通知回到本会话；仍需要结果时用 wait_agent 等待，不忙轮询。writer/designer 没有工具，应提供完整材料。';
    };
    add(agent.ctx.systemPrompt.context({name:'agent-roles:directory',order:130,required:true,interpolate:false,text:()=>directoryText()}));
    // Use the just-assembled model when a session switches routes before its next request.
    add(agent.ctx.on('system-prompt/assemble',async(_assembly,_context,next)=>{
      const assembly=await next();
      return {...assembly,contexts:assembly.contexts.map(c=>c.name==='agent-roles:directory'?{...c,text:directoryText(assembly.variables.model??currentModel(agent))}:c)};
    },{prepend:true}));
    add(agent.ctx.tools.register(defineTool({name:'spawn_role',description:'选择启用角色，通过 DSH 原生 Agent Team 启动独立后台成员。保留角色提示词、模型与工具策略；结果自动回到主会话，可用 send_message 继续沟通。',parameters:{role:{type:'string',required:true,description:'角色名称，来自角色目录。'},name:{type:'string',required:true,description:'本团队唯一成员名，小写字母数字及连字符；同角色可启动多个成员。'},prompt:{type:'string',required:true,description:'完整任务、输入材料、工作目录、可写范围与完成标准。'}},output,
      async execute(args,exec) {
        const role=store.catalog.roles.find(r=>r.name===args.role && r.enabled);
        if(!role) throw new Error('未找到启用角色：'+args.role);
        if(!exec.agent || ctx.agentTeams.membership(exec.agent).role!=='lead') throw new Error('仅主代理可分发角色');
        assertDelegation(exec.agent,role.model);
        let result;
        try { result=await ctx.agentTeams.spawnTeammate(exec.agent,{name:args.name,description:role.description,prompt:[{type:'text',text:args.prompt}],context:'fresh',provider:PREFIX+role.id,signal:exec.signal}); }
        catch(error) {
          const member=ctx.agentTeams.listMembers(exec.agent).find(m=>m.name===args.name);
          const record=member && liveRecords.get(member.id);
          if(record && member.status==='failed'){record.status='failed';record.error??=String(error.message??error);observed(record);}
          throw error;
        }
        const record=liveRecords.get(result.member.id)??store.run(result.member.id);
        if(record){record.memberName=args.name;await persist(record);}
        return {member:result.member,role:role.name,selection:record?.selection??null};
      }})));
  }
  for(const agent of ctx.agents.list()) await install(agent);
  ctx.on('agent/created',({agent})=>install(agent));
  ctx.on('agent/disposed',({agent})=>{ for(const dispose of installed.get(agent)??[]) dispose(); installed.delete(agent); });
  ctx.on('agent/status',({agent,status})=>{ const record=liveRecords.get(agent.id); if(record){record.status=status==='running'?'running':record.status==='failed'?'failed':'inactive';if(status==='running')delete record.error;observed(record);} });
  ctx.on('session/event',(session,event)=>{
    const record=liveRecords.get(session.id); if(!record) return;
    if(event.type==='system/message') {
      const system=text(event.data.message.content);
      record.audit={...record.audit,systemHash:hash(system),rolePromptPresent:system.includes(record.role.prompt),adaptationPresent:system.includes('DSH 团队协作'),nativeSystemPresent:system.includes('You are an AI agent powered by DeepSeek Harness.'),skills:skillEvidence(record.skillSnapshot,system),systemSeq:event.seq,systemLength:system.length};
    } else if(event.type==='request/header') {
      const {config:selection,tools=[]}=event.data.header;
      record.audit={...record.audit,provider:selection.provider,model:selection.model,reasoningEffort:selection.reasoningEffort??'',tools:tools.map(t=>t.name),requestSeq:event.seq};
    } else if(event.type==='assistant/message') {
      record.output=text(event.data.message.content).slice(0,30000); record.audit={...record.audit,responseReceived:true};
    } else if(event.type==='turn/end') {
      record.status=event.data.reason.kind==='error'?'failed':'inactive';
      if(event.data.reason.kind==='error')record.error=event.data.reason.error.message;
    } else return;
    record.updatedAt=new Date().toISOString(); observed(record);
  });
  ctx.effect(()=>()=>{ for(const ds of installed.values()) for(const d of ds)d(); installed.clear(); for(const d of providers.values()) d(); },'agent-roles:dispose');
  async function dispatch(body) {
    if(body.action==='list') return {catalog:store.catalog,tools:TOOLS,...delegationSettings(configContext,delegationRules),persistenceError};
    if(body.action==='saveSettings') return saveDelegationSettings(configContext,body.revision,body.delegationRules);
    if(body.action==='models') return {...await modelDirectory(ctx.llm),fastProviders};
    if(body.action==='skills') return {skills:await skillDirectory(ctx.skills,{cwd:ctx.workingDirectory.defaultDirectory})};
    if(body.action==='modelInfo') return ctx.llm.resolveModelInfo(body.provider,body.model);
    if(body.action==='runs') {
      const teams=new Map();
      return {runs:store.runs.items.slice(-200).reverse().map(r=>{
        if(!teams.has(r.parentSessionId)){const parent=ctx.agents.get(r.parentSessionId);teams.set(r.parentSessionId,parent&&ctx.agentTeams.tryMembership(parent)?ctx.agentTeams.listMembers(parent):[]);}
        const member=teams.get(r.parentSessionId).find(m=>m.id===r.sessionId);
        const status=member?.status??(ctx.agents.get(r.sessionId)?.status==='running'?'running':r.status==='failed'?'failed':'inactive');
        const {skillSnapshot,...summary}=r;
        return {...summary,memberName:member?.name??r.memberName,status,error:r.error??(status==='failed'?member?.diagnostics.join('\n'):undefined)};
      }),persistenceError};
    }
    if(body.action==='save') {
      const role=validateRole(body.role); validateFastProvider(role,fastProviders);
      if(role.enabled) await validateModel(ctx.llm,role,undefined,fastProviders);
      const known=role.skills.length?await skillDirectory(ctx.skills,{cwd:ctx.workingDirectory.defaultDirectory}):[];
      const previous=store.catalog.roles.find(r=>r.id===role.id);
      for(const name of role.skills) if(!known.some(s=>s.name===name) && !previous?.skills?.includes(name)) throw new Error('技能不可用：'+name);
      const catalog=await store.change(body.revision,roles=>{const i=roles.findIndex(r=>r.id===role.id);if(i<0)roles.push(role);else roles[i]=role;return roles;});
      registerProvider(role.id); return {catalog};
    }
    if(body.action==='delete') return {catalog:await store.change(body.revision,roles=>roles.filter(r=>r.id!==body.id))};
    throw new Error('未知操作');
  }
  ctx.effect(()=>ctx.webServer.register({kind:'prefix',path:'/agent-roles/api',handler:async(req,res)=>{
    res.setHeader('Content-Type','application/json; charset=utf-8');res.setHeader('Cache-Control','no-store');
    if(ctx.connection.requestRejection(req)!==undefined){res.statusCode=403;res.end(JSON.stringify({error:'请登录 DSH 后重试'}));return;}
    if(req.method!=='POST' || !String(req.headers['content-type']??'').startsWith('application/json')){res.statusCode=405;res.end(JSON.stringify({error:'只接受 JSON POST'}));return;}
    try {
      const chunks=[];let bytes=0; for await(const chunk of req){bytes+=chunk.length;if(bytes>1048576)throw new Error('请求超过 1 MiB');chunks.push(Buffer.from(chunk));}
      const body=JSON.parse(Buffer.concat(chunks).toString('utf8')); if(!body || typeof body.action!=='string')throw new Error('请求缺少 action');
      res.end(JSON.stringify(await dispatch(body)));
    }catch(e){res.statusCode=400;res.end(JSON.stringify({error:String(e.message??e)}));}
  }}),'agent-roles:api');
}
