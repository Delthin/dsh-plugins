import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';

const root=new URL('../',import.meta.url);
const read=file=>readFile(new URL(file,root),'utf8');
const pkg=JSON.parse(await read('package.json'));
const expected=[
  'CHANGELOG.md','LICENSE','LICENSE-MIT-legacy','README.en.md','README.md','client.js',
  'cordis.patch.yml','index.js','package.json','runtime.js','skills.js','store.js',
].sort();
assert.equal(pkg.name,'@delthin/dsh-agent-roles');
assert.notEqual(pkg.private,true);
assert.equal(pkg.license,'PolyForm-Noncommercial-1.0.0');
assert.equal(pkg.publishConfig.access,'public');
assert.deepEqual(pkg.repository,{
  type:'git',url:'git+https://github.com/Delthin/dsh-plugins.git',directory:'packages/agent-roles',
});
assert.equal(pkg.homepage,'https://github.com/Delthin/dsh-plugins/tree/main/packages/agent-roles#readme');
assert.equal(pkg.bugs.url,'https://github.com/Delthin/dsh-plugins/issues');
assert.deepEqual([...pkg.files,'package.json'].sort(),expected,'Unexpected public file allowlist');
assert.deepEqual(pkg.exports,{
  '.':'./index.js','./client':'./client.js','./package.json':'./package.json','./cordis.patch.yml':'./cordis.patch.yml',
});
assert.equal(pkg.main,'index.js');
assert.equal(pkg.dsh.bundle.patch,'./cordis.patch.yml');
assert.equal(pkg.dsh.client.platform,'web');
assert.deepEqual(pkg.dsh.client.inject,[
  '@deepseek-ai/dsh-client-ui-primitives','@deepseek-ai/dsh-client-ui-layout',
  '@deepseek-ai/dsh-client-ui-sidebar','@deepseek-ai/dsh-client-ui-workspace',
]);
assert.equal(pkg.engines.dsh,'>=0.2.1-rc.5 || >=0.2.2-rc.1');
assert.equal(pkg.engines.node,'>=22.18.0');
for(const [name,range] of Object.entries({...pkg.dependencies,...pkg.peerDependencies})){
  if(name.startsWith('@deepseek-ai/dsh-'))assert.equal(range,name==='@deepseek-ai/dsh-tool-executor-native'?'>=0.2.2-rc.1':'>=0.2.1-rc.5 || >=0.2.2-rc.1','DSH dependency must not pin the host: '+name);
}
const patch=await read('cordis.patch.yml');
assert.match(patch,/- id: agent-roles\s+name: '@delthin\/dsh-agent-roles'/);
for(const name of ['agent-team','tool-agent-team','client-ui-agent-team']){
  assert.ok(patch.includes("name: '@deepseek-ai/dsh-experimental-"+name+"'"),'Missing native Team plugin: '+name);
}
const source=await read('index.js');
assert.match(source,/store\.load\(\[\]\)/,'Fresh installs must have an empty catalog');
assert.doesNotMatch(source,/seed-roles/,'Private seeds must not be loaded');
assert.match(source,/export const name='agent-roles'/,'Internal plugin ID must remain stable');
assert.match(await read('client.js'),/load\(\{id:'@delthin\/dsh-agent-roles'/,'Client module ID must match the scoped package');

// Verify the actual npm file list without uploading or running lifecycle scripts.
const npm=process.platform==='win32'?'npm.cmd':'npm';
const result=JSON.parse(execFileSync(npm,['pack','--dry-run','--json','--ignore-scripts'],{
  cwd:fileURLToPath(root),encoding:'utf8',shell:process.platform==='win32',
  env:{...process.env,npm_config_cache:fileURLToPath(new URL('../../../.cache/npm',import.meta.url))},
}))[0];
assert.equal(result.name,pkg.name);
assert.equal(result.version,pkg.version);
assert.deepEqual(result.files.map(f=>f.path).sort(),expected,'Unexpected files in npm package');
for(const file of expected) {
  const body=await read(file);
  assert.ok(!/(?:\/Users\/|\/Volumes\/|\/home\/[^$\s]+\/|[A-Z]:\\Users\\)/.test(body),'Machine-specific path in '+file);
  assert.ok(!/(?:npm_[A-Za-z0-9]{20,}|gh[pousr]_[A-Za-z0-9]{20,}|-----BEGIN .*PRIVATE KEY-----)/.test(body),'Possible credential in '+file);
}
console.log(JSON.stringify({name:result.name,version:result.version,files:expected,size:result.size,unpackedSize:result.unpackedSize},null,2));
