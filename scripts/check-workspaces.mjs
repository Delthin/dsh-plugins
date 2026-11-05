import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';

const readJson = async (path) => JSON.parse(await readFile(new URL(path, import.meta.url), 'utf8'));
const root = await readJson('../package.json');
assert.equal(root.private, true, 'The root workspace must never be published');
assert.deepEqual(root.workspaces, ['packages/*']);
const changesets = await readJson('../.changeset/config.json');
assert.deepEqual(changesets.fixed, [], 'Package versions must remain independent');
assert.deepEqual(changesets.linked, [], 'Package versions must remain independent');

const expected = new Map([
  ['feishu-notify', '@delthin/dsh-feishu-notify'],
  ['agent-roles', '@delthin/dsh-agent-roles'],
  ['fast', '@delthin/dsh-fast'],
  ['tool-wrap', '@delthin/dsh-tool-wrap'],
]);
let count = 0;
for (const entry of await readdir(new URL('../packages/', import.meta.url), { withFileTypes: true })) {
  if (!entry.isDirectory()) continue;
  assert(expected.has(entry.name), 'Unexpected workspace: ' + entry.name);
  const path = '../packages/' + entry.name + '/package.json';
  let pkg;
  try { pkg = await readJson(path); }
  catch (error) { if (error.code === 'ENOENT') continue; throw error; }
  count++;
  assert.equal(pkg.name, expected.get(entry.name));
  assert.equal(pkg.repository?.url, 'git+https://github.com/Delthin/dsh-plugins.git');
  assert.equal(pkg.repository?.directory, 'packages/' + entry.name);
  assert(pkg.scripts?.check, pkg.name + ' needs a check script');
  assert(pkg.scripts?.test, pkg.name + ' needs a test script');
  for (const script of ['check', 'test']) {
    const result = spawnSync('npm', ['run', script, '--workspace', pkg.name], {
      cwd: new URL('../', import.meta.url), stdio: 'inherit',
    });
    if (result.error) throw result.error;
    assert.equal(result.status, 0, pkg.name + ': ' + script + ' failed');
  }
}
console.log('Workspace structure checked; migrated plugin packages: ' + count + '/4.');
if (count === 0) console.log('Skeleton only: plugin packaging and DSH integration have not been validated.');
