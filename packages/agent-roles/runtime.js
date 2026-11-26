import { NativeToolExecutor } from '@deepseek-ai/dsh-tool-executor-native';
import { nativeSelection } from './fallback.js';

export async function installRoleRuntime(agent,selection,allowed) {
  const scoped=agent.ctx,native=new NativeToolExecutor(scoped);
  const dispose=scoped.tools.setExecutor({
    describe:definitions=>native.describe(definitions.filter(tool=>allowed.has(tool.name))),
    execute:input=>native.execute(input),
  });
  try {
    agent.model.select(nativeSelection(selection));
    return [dispose];
  } catch(error) {
    dispose();
    throw error;
  }
}
