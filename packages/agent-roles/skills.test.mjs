import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {RoleStore,validateRole} from './store.js';
import {captureSkills,skillDirectory,skillSection,skillEvidence} from './skills.js';
const seed=JSON.parse(await readFile(new URL('./fixtures/roles.json',import.meta.url),'utf8'));
const skill={name:'sample',description:'Test skill',provider:'test',invocation:{modelInvocable:true,userInvocable:true},content:'Use {{literal}} unchanged.',resourceBase:{kind:'directory',path:'/test'}};
const registry={snapshot:async()=>({complete:true,skills:[skill,{...skill,name:'human-only',invocation:{modelInvocable:false,userInvocable:true}}]}),get:async name=>name===skill.name?skill:undefined};
test('existing and new roles default to no skills; validate and deduplicate selection',()=>{
 assert.deepEqual(validateRole(seed[0]).skills,[]);
 assert.deepEqual(validateRole({...seed[0],skills:['sample','sample']}).skills,['sample']);
 for(const skills of ['sample',[null],['../private'],Array(65).fill('sample')])assert.throws(()=>validateRole({...seed[0],skills}),/技能/);
});
test('empty selection never queries providers; only model-invocable skills resolve',async()=>{
 assert.deepEqual(await captureSkills({},[]),[]);assert.deepEqual((await skillDirectory(registry)).map(s=>s.name),['sample']);
 for(const name of ['missing','human-only'])await assert.rejects(captureSkills(registry,[name]),/不可用/);
 await assert.rejects(skillDirectory({snapshot:async()=>({complete:false,skills:[]})}),/完整/);
});
test('native rendering, actual-body audit, and frozen snapshot survive source/catalog changes',async()=>{
 const captured=await captureSkills(registry,['sample']);
 const text=skillSection(captured);assert.ok(text.includes('{{literal}}'));assert.ok(text.includes('<skill_content'));assert.ok(!text.includes('human-only'));
 assert.equal(skillEvidence(captured,text)[0].present,true);assert.equal(skillEvidence(captured,'not loaded')[0].present,false);assert.deepEqual(skillEvidence([],'native system'),[]);
 const dir=await mkdtemp(join(tmpdir(),'agent-role-skills-'));
 try{const store=new RoleStore(dir);await store.load(seed);await store.saveRun({sessionId:'skill-test',role:{...store.catalog.roles[0],skills:['sample']},skillSnapshot:captured});
 await store.change(store.catalog.revision,roles=>roles.map(r=>({...r,skills:[]})));
 const restored=new RoleStore(dir);await restored.load(seed);assert.deepEqual(restored.run('skill-test').skillSnapshot,captured);assert.equal(skillSection(restored.run('skill-test').skillSnapshot),text);
 }finally{await rm(dir,{recursive:true,force:true});}
});
