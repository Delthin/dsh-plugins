import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {readFile} from 'node:fs/promises';

// Verify the actual npm file list, not merely .gitignore. No upload occurs.
const pkg=JSON.parse(await readFile('package.json','utf8'));
const npm=process.platform==='win32'?'npm.cmd':'npm';
const result=JSON.parse(execFileSync(npm,['pack','--dry-run','--json','--ignore-scripts'],{encoding:'utf8',shell:process.platform==='win32'}))[0];
const expected=[...pkg.files,'package.json'].sort();
assert.deepEqual(result.files.map(f=>f.path).sort(),expected,'Unexpected files in npm package');
for(const file of expected) {
  const body=await readFile(file,'utf8');
  assert.ok(!/(?:\/Users\/|\/Volumes\/|\/home\/[^$\s]+\/|[A-Z]:\\Users\\)/.test(body),'Machine-specific path in '+file);
  assert.ok(!/(?:npm_[A-Za-z0-9]{20,}|gh[pousr]_[A-Za-z0-9]{20,}|-----BEGIN .*PRIVATE KEY-----)/.test(body),'Possible credential in '+file);
}
const source=await readFile('index.js','utf8');
assert.match(source,/store\.load\(\[\]\)/,'Fresh installs must have an empty catalog');
assert.doesNotMatch(source,/seed-roles/,'Private seeds must not be loaded');
assert.equal(pkg.license,'MIT');
assert.equal(pkg.engines.dsh,'>=0.2.1-rc.5');
for(const [name,range] of Object.entries({...pkg.dependencies,...pkg.peerDependencies})){
  if(name.startsWith('@deepseek-ai/dsh-'))assert.equal(range,name==='@deepseek-ai/dsh-tool-executor-native'?'>=0.2.2-rc.1':'>=0.2.1-rc.5','DSH dependency must not pin the host: '+name);
}
console.log(JSON.stringify({name:result.name,version:result.version,files:expected,size:result.size,unpackedSize:result.unpackedSize},null,2));
