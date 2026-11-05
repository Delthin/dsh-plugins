import assert from 'node:assert/strict';
import { readFile, readdir, access } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import yaml from 'js-yaml';
import semver from 'semver';

const rootDir = fileURLToPath(new URL('../', import.meta.url));
process.env.npm_config_cache ??= path.join(rootDir, '.cache/npm');
const readJson = async (file) => JSON.parse(await readFile(path.join(rootDir, file), 'utf8'));
const root = await readJson('package.json');
assert.equal(root.private, true, 'The root workspace must never be published');
assert.deepEqual(root.workspaces, ['packages/*']);
const changesets = await readJson('.changeset/config.json');
assert.deepEqual(changesets.fixed, [], 'Package versions must remain independent');
assert.deepEqual(changesets.linked, [], 'Package versions must remain independent');

const expected = new Map([
  ['feishu-notify', '@delthin/dsh-feishu-notify'],
  ['agent-roles', '@delthin/dsh-agent-roles'],
  ['fast', '@delthin/dsh-fast'],
  ['tool-wrap', '@delthin/dsh-tool-wrap'],
]);
const directories = (await readdir(path.join(rootDir, 'packages'), {withFileTypes:true})).filter(e => e.isDirectory()).map(e => e.name).sort();
assert.deepEqual(directories, [...expected.keys()].sort());
const leaves = (value, prefix = '') => Object.entries(value).flatMap(([key, child]) => child && typeof child === 'object' && !Array.isArray(child) ? leaves(child, prefix + key + '.') : [prefix + key]).sort();

for (const [slug, name] of expected) {
  const directory = path.join(rootDir, 'packages', slug);
  const pkg = await readJson('packages/' + slug + '/package.json');
  assert.equal(pkg.name, name);
  assert.equal(pkg.private, true, name + ' must remain unpublished until authorized');
  assert.equal(pkg.repository?.url, 'git+https://github.com/Delthin/dsh-plugins.git');
  assert.equal(pkg.repository?.directory, 'packages/' + slug);
  assert(semver.valid(pkg.version), name + ' needs a valid independent version');
  assert(semver.validRange(pkg.engines?.node), name + ' needs Node compatibility');
  assert.match(pkg.engines?.dsh ?? '', /^>=/, name + ' must declare a tested minimum, not an exact host pin');
  assert(semver.satisfies('0.2.2-rc.1', pkg.engines.dsh), name + ' rejects current host');
  for (const [dep, range] of Object.entries({...pkg.dependencies, ...pkg.peerDependencies})) {
    if (dep.startsWith('@deepseek-ai/dsh-')) assert.match(range, /^>=/, dep + ' must not pin the host');
  }
  for (const file of ['README.md', 'README.en.md', 'CHANGELOG.md']) await access(path.join(directory, file));
  assert.equal(pkg.dsh?.bundle?.patch, './cordis.patch.yml');
  const patch = yaml.load(await readFile(path.join(directory, 'cordis.patch.yml'), 'utf8'));
  const names = [];
  const visit = value => {
    if (!value || typeof value !== 'object') return;
    if (typeof value.name === 'string') names.push(value.name);
    for (const child of Object.values(value)) visit(child);
  };
  visit(patch);
  assert(names.includes(name), name + ' missing from bundle patch');
  if (slug === 'tool-wrap') assert(names.includes(name + '/origin-bootstrap'));
  for (const [key, target] of Object.entries(pkg.exports ?? {})) {
    assert.equal(typeof target, 'string', name + ': unsupported export ' + key);
    assert(target.startsWith('./') && !target.includes('..'), name + ': unsafe export target');
    if (!target.includes('*')) await access(path.join(directory, target));
  }
  if (slug !== 'agent-roles') {
    const localeDir = path.join(directory, 'locale');
    const locales = (await readdir(localeDir)).filter(file => file.endsWith('.json')).sort();
    assert(locales.some(file => /^zh(?:-|\.)/.test(file)), name + ' needs a Chinese locale');
    assert(locales.some(file => /^en(?:-|\.)/.test(file)), name + ' needs an English locale');
    const keys = await Promise.all(locales.map(async file => leaves(JSON.parse(await readFile(path.join(localeDir, file), 'utf8')))));
    for (let i = 1; i < keys.length; i++) assert.deepEqual(keys[0], keys[i], name + ': translated locale keys differ: ' + locales[i]);
  }
  for (const script of ['check', 'test']) {
    assert(pkg.scripts?.[script], name + ' needs ' + script);
    const result = spawnSync('npm', ['run', script, '--workspace', name], {cwd:rootDir, stdio:'inherit'});
    if (result.error) throw result.error;
    assert.equal(result.status, 0, name + ': ' + script + ' failed');
  }
  if (slug === 'agent-roles') {
    const result = spawnSync(process.execPath, ['scripts/check-package.mjs'], {cwd:directory, stdio:'inherit'});
    if (result.error) throw result.error;
    assert.equal(result.status, 0, name + ': package contract check failed');
  }
}
console.log('All four independent workspace manifests, patches, locales and tests passed.');
