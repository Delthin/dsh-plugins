import { installModelSelection } from '@deepseek-ai/dsh-agent';

// Capability detection keeps the rc.5 integration while using the public rc.1 APIs.
export async function installRoleRuntime(agent,selection,allowed) {
  const scoped=agent.ctx,disposers=[];
  const {provider,model,reasoningEffort}=selection;
  const route={provider,model,...reasoningEffort?{reasoningEffort}:{}};
  try {
    if(typeof scoped.tools.setExecutor==='function') {
      const {NativeToolExecutor}=await import('@deepseek-ai/dsh-tool-executor-native');
      const native=new NativeToolExecutor(scoped);
      disposers.push(scoped.tools.setExecutor({
        describe:definitions=>native.describe(definitions.filter(tool=>allowed.has(tool.name))),
        execute:input=>native.execute(input),
      }));
    } else {
      disposers.push(scoped.tools.presentAs('native'));
      disposers.push(scoped.on('system-prompt/assemble',async(_assembly,_context,next)=>{
        const assembly=await next();
        return {...assembly,tools:assembly.tools.filter(tool=>allowed.has(tool.name))};
      }));
    }
    if(typeof agent.model?.select==='function') agent.model.select(route);
    else disposers.push(installModelSelection(scoped,{current:route,assembled:undefined}));
    return disposers;
  } catch(error) {
    for(const dispose of disposers.reverse()) dispose();
    throw error;
  }
}
