import { isModelInvocable, renderSkillContent } from '@deepseek-ai/dsh-skill';
import { hash } from './store.js';

export async function skillDirectory(registry,options={}) {
  const snapshot=await registry.snapshot(options);
  if(!snapshot.complete) throw new Error('DSH 技能目录尚未加载完整，请稍后刷新');
  return snapshot.skills.filter(isModelInvocable).map(({name,description,provider})=>({name,description,provider}));
}

// Resolve once at launch: role edits and later skill-file edits do not change a member.
export async function captureSkills(registry,names=[],options={}) {
  if(!names.length) return [];
  const catalog=await skillDirectory(registry,options), result=[];
  let bytes=0;
  for(const name of names) {
    if(!catalog.some(s=>s.name===name)) throw new Error('技能不可用：'+name);
    const skill=await registry.get(name,options);
    if(!skill || !isModelInvocable(skill)) throw new Error('技能不可用：'+name);
    const value={name:skill.name,provider:skill.provider,content:skill.content,...skill.resourceBase?{resourceBase:skill.resourceBase}:{}};
    bytes+=Buffer.byteLength(value.content);
    if(bytes>1048576) throw new Error('所选技能正文合计超过 1 MiB，请减少技能数量');
    result.push({...value,hash:hash(renderSkillContent(value))});
  }
  return result;
}

export function skillSection(snapshot=[]) {
  return snapshot.length ? '## 本角色已加载的技能\n以下技能已完整加载，直接遵循适用内容，不必再调用 skill。技能不会扩大本角色的工具权限。\n\n'+snapshot.map(renderSkillContent).join('\n\n') : '## 本角色技能\n未分配技能。不要使用主代理或全局技能目录。';
}

export function skillEvidence(snapshot=[],system) {
  return snapshot.map(s=>({name:s.name,provider:s.provider,hash:s.hash,present:system.includes(renderSkillContent(s))}));
}
