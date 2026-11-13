import { boundContextSummary, createUserMessage, LlmError } from '@deepseek-ai/dsh-llm';

const DELAYS=[1000,2000,4000];
const CANCEL_CODES=new Set(['ABORTED','CANCELLED','CANCELED']);
const QUOTA_CODES=new Set(['QUOTA','ACCOUNT_QUOTA']);
const HISTORY_LIMIT=64;
const summary=value=>String(value??'').slice(0,500);
const now=()=>new Date().toISOString();
export const nativeSelection=({provider,model,reasoningEffort})=>({provider,model,...reasoningEffort?{reasoningEffort}:{}});

function delay(ms,signal) {
  if(signal.aborted)return Promise.resolve(false);
  return new Promise(resolve=>{
    const timer=setTimeout(()=>{signal.removeEventListener('abort',abort);resolve(true);},ms);
    function abort(){clearTimeout(timer);resolve(false);}
    signal.addEventListener('abort',abort,{once:true});
  });
}

// The chain is a launch snapshot. Legacy records use ONLY their recorded active
// selection, even if the role catalog or the stored role now has fallbacks.
export function runModelChain(record) {
  const chain=record.modelChain??[record.selection];
  const index=record.modelChain?record.fallbackIndex??0:0;
  if(!Array.isArray(chain)||!chain.length||!Number.isSafeInteger(index)||index<0||index>=chain.length||chain.some(route=>!route||typeof route.provider!=='string'||!route.provider||typeof route.model!=='string'||!route.model))throw new Error('角色模型链启动快照无效');
  if(record.modelChain && JSON.stringify(nativeSelection(chain[index]))!==JSON.stringify(nativeSelection(record.selection)))throw new Error('角色活动模型与模型链快照不一致');
  return {chain:structuredClone(chain),index};
}

/**
 * Own request-error before the Host llm-retry listener, including its `always`
 * mode. Never delegate this bounded policy to native provider retry policies.
 * Same-route retries stay in the prepared step; route switches must open a new
 * turn so the Host rebuilds capabilities, tools and prompt for the new route.
 */
export function installRoleFallback(agent,record,{persist,observe,assertCandidate=()=>{},wait=delay}={}) {
  const snapshot=runModelChain(record);
  const chain=snapshot.chain;
  // No configured alternatives: retain the Host's existing retry behavior.
  if(chain.length===1)return ()=>{};
  let index=snapshot.index,pending,disposed=false;
  const lifetime=new AbortController(),disposers=[];
  // Ordered chains require the public rc.1 model/inbox continuation API.
  if(typeof agent.model?.select!=='function'||typeof agent.inbox?.append!=='function'||typeof agent.inbox?.remove!=='function'||typeof agent.followup!=='function')throw new Error('角色模型回退需要 DSH >=0.2.2-rc.2 的模型选择与原生 inbox API');
  const save=()=>persist(record);
  const changed=()=>observe(record);
  function removePending() {
    if(!pending)return;
    const item=pending;pending=undefined;
    item.signal.removeEventListener('abort',item.abort);
    agent.inbox.remove(item.message.id);
  }
  function cancelPending() {
    if(!pending)return;
    const item=pending;pending=undefined;
    item.signal.removeEventListener('abort',item.abort);
    record.retry={...record.retry,status:'cancelled',updatedAt:now()};
    changed();
    // Cancellation can be delivered by a session/event observer while Session
    // is still publishing turn/end. Inbox removal appends another event, so
    // defer that write until publication exits; suppress waking immediately.
    queueMicrotask(()=>{
      try {agent.inbox.remove(item.message.id);}
      catch(error){record.status='failed';record.error='无法移除已取消的角色续接：'+summary(error.message??error);changed();}
    });
  }
  function failContinuation(error) {
    removePending();
    record.status='failed';record.error=summary(error.message??error);
    record.retry={...record.retry,status:'failed',updatedAt:now()};
    changed();
  }
  disposers.push(agent.ctx.on('agent/status',({status})=>{
    if(status!=='idle'||!pending)return;
    const item=pending;
    if(disposed||item.signal.aborted||lifetime.signal.aborted){cancelPending();return;}
    // A failed native turn exits kick() before draining pending input. Keep the
    // continuation queued through turn/end (also preventing child settlement),
    // then re-submit that exact message synchronously at the true idle boundary.
    // whenIdle() follows the replacement driver; no duplicate prompt is inserted.
    const queued=agent.inbox.nextTurn.some(message=>message.id===item.message.id);
    if(!queued){cancelPending();return;}
    try {
      removePending();
      record.retry={...record.retry,status:'continued',updatedAt:now()};
      delete record.error;
      agent.followup(item.message);
      changed();
    } catch(error){failContinuation(error);}
  },{prepend:true}));
  disposers.push(agent.ctx.on('agent/request-error',async({turn,step,provider,failure,signal})=>{
    if(disposed||signal.aborted||lifetime.signal.aborted||CANCEL_CODES.has(failure.code))return;
    const fused=AbortSignal.any([signal,lifetime.signal]);
    const previous=record.retry;
    const retries=previous?.turn===turn&&previous.step===step&&previous.index===index?previous.retries:0;
    const reason=summary(failure.message),code=failure.code;
    // Provider mismatch means another owner changed this role's route. Fail
    // closed rather than applying an old snapshot to an unrelated request.
    if(provider!==chain[index].provider)throw new Error('角色请求供应商与活动模型链不一致');
    if(!QUOTA_CODES.has(code)&&retries<DELAYS.length) {
      const delayMs=DELAYS[retries];
      record.retry={turn,step,index,retries:retries+1,maxRetries:DELAYS.length,delayMs,code,reason,status:'waiting',updatedAt:now()};
      await save();
      if(fused.aborted||!await wait(delayMs,fused)||fused.aborted) {
        record.retry={...record.retry,status:'cancelled',updatedAt:now()};changed();return;
      }
      record.retry={...record.retry,status:'retrying',updatedAt:now()};
      await save();
      if(fused.aborted)return;
      return {kind:'retry'};
    }
    if(index+1>=chain.length) {
      const message='角色模型链已耗尽（'+chain.length+' 个模型）：'+chain[index].provider+'/'+chain[index].model+' ['+code+'] '+reason;
      record.status='failed';record.error=message;
      record.retry={turn,step,index,retries,maxRetries:DELAYS.length,delayMs:0,code,reason,status:'exhausted',updatedAt:now()};
      await save();
      if(fused.aborted)return;
      throw new LlmError(message,code);
    }
    const nextIndex=index+1,selection=structuredClone(chain[nextIndex]);
    assertCandidate(selection);
    if(fused.aborted)return;
    // Public select records the complete NEXT-step route. Returning retry here
    // would still call the old frozen route, so deliberately end this turn.
    agent.model.select(nativeSelection(selection));
    const time=now();
    record.fallbackHistory=[...(record.fallbackHistory??[]),{from:structuredClone(chain[index]),to:structuredClone(selection),reason,code,time}].slice(-HISTORY_LIMIT);
    index=nextIndex;record.fallbackIndex=index;record.selection=selection;
    record.retry={turn,step,index:nextIndex,retries:0,maxRetries:DELAYS.length,delayMs:0,code,reason,status:'switching',updatedAt:time};
    await save();
    if(fused.aborted){record.retry={...record.retry,status:'cancelled',updatedAt:now()};changed();return;}
    const message=createUserMessage({source:{kind:'agent-role-fallback',form:'notice',summary:boundContextSummary('角色模型回退：'+selection.provider+'/'+selection.model)},content:[{type:'text',text:'模型请求失败后已切换到 '+selection.provider+'/'+selection.model+'。请在本成员的同一会话中继续原任务，沿用已有历史和已提交的工具结果；从失败的模型请求继续，避免重复执行已经完成的工具操作。'}]});
    const abort=()=>cancelPending();
    pending={message,signal:fused,abort};
    fused.addEventListener('abort',abort,{once:true});
    try {agent.inbox.append('next-turn',message);} catch(error){removePending();throw error;}
    if(fused.aborted)cancelPending();
    // Do not call next(): native llm-retry must not add calls or delays.
    return;
  },{prepend:true}));
  return ()=>{
    if(disposed)return;
    disposed=true;
    lifetime.abort();
    removePending();
    for(const dispose of disposers.reverse())dispose();
  };
}

export function isFallbackContinuing(record) {
  return record.retry?.status==='switching';
}

// agent/error is intentionally not a recovery hook: a thrown LlmError there
// can originate from tool execution, prompt plugins or persistence, and the
// public event carries no preparation/transport provenance to distinguish it.
// Adapter stream failures normalized into request-error use the policy above.
