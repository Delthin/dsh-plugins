import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFile, writeFile, mkdir, readdir, copyFile, cp, mkdtemp, realpath } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';
import path from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
const cache = path.join(root, '.cache/npm');
const output = path.join(root, '.cache/packs');
await mkdir(output, {recursive:true});
const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const baseEnv = {...process.env, npm_config_cache:cache};
const slugs = ['feishu-notify', 'agent-roles', 'fast', 'tool-wrap'];
const results = [];
function run(command, args, cwd, env = baseEnv, json = false) {
  const result = spawnSync(command, args, {cwd, env, encoding:'utf8', maxBuffer:32 * 1024 * 1024, shell:process.platform === 'win32'});
  if (result.error) throw result.error;
  if (!json && result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);
  assert.equal(result.status, 0, command + ' failed in ' + cwd + (json ? '\n' + result.stdout : ''));
  return json ? JSON.parse(result.stdout) : result.stdout;
}
for (const slug of slugs) {
  const source = path.join(root, 'packages', slug);
  const pkg = JSON.parse(await readFile(path.join(source, 'package.json'), 'utf8'));
  const packed = run(npm, ['pack', '--json', '--ignore-scripts', '--pack-destination', output], source, baseEnv, true)[0];
  assert.equal(packed.name, pkg.name);
  const files = new Set(packed.files.map(file => file.path));
  for (const file of ['package.json', 'README.md', 'README.en.md', 'CHANGELOG.md', 'index.js', 'client.js', 'cordis.patch.yml']) assert(files.has(file), pkg.name + ' missing packaged file: ' + file);
  if (pkg.license === 'MIT') assert(files.has('LICENSE'));
  for (const file of files) {
    assert(!file.includes('..') && !path.isAbsolute(file), 'Unsafe packed path: ' + file);
    assert(!/(?:^|\/)(?:test|tests|node_modules|home|profiles?|scripts|\.github)(?:\/|$)|\.test\.[cm]?js$|\.(?:tgz|log)$/.test(file), 'Unexpected runtime package file: ' + file);
    assert(!/(?:seed-roles|roles|runs)\.json$/.test(file), 'Private role data in tarball');
  }
  for (const target of Object.values(pkg.exports ?? {})) {
    if (target.includes('*')) {
      const [before, after] = target.slice(2).split('*');
      assert([...files].some(file => file.startsWith(before) && file.endsWith(after)), pkg.name + ' empty export wildcard: ' + target);
    } else assert(files.has(target.slice(2)), pkg.name + ' exports an unpackaged target: ' + target);
  }
  const fixture = await realpath(await mkdtemp(path.join(tmpdir(), 'dsh-plugin-pack-')));
  console.log('\nIsolated fixture: ' + pkg.name + ' -> ' + fixture);
  const dependencies = {...pkg.devDependencies};
  for (const name of Object.keys(pkg.peerDependencies ?? {})) {
    if (name.startsWith('@deepseek-ai/dsh-')) dependencies[name] = '0.2.2-rc.1';
    else if (name === '@deepseek-ai/cordis') dependencies[name] = '4.1.0';
    else if (name === '@deepseek-ai/schemastery') dependencies[name] = '3.19.0';
    else dependencies[name] ??= pkg.peerDependencies[name];
  }
  const archive = path.join(fixture, packed.filename);
  await copyFile(path.join(output, packed.filename), archive);
  dependencies[pkg.name] = 'file:./' + packed.filename;
  await writeFile(path.join(fixture, 'package.json'), JSON.stringify({name:'isolated-plugin-fixture',version:'0.0.0',private:true,type:'module',dependencies}, null, 2) + '\n');
  const profile = path.join(fixture, 'empty-profile');
  await mkdir(profile);
  const env = {...baseEnv, DSH_HOME:profile, DSH_PROFILE_DIR:profile, NODE_PATH:''};
  run(npm, ['install', '--ignore-scripts', '--no-audit', '--no-fund', '--registry=https://registry.npmjs.org'], fixture, env);
  const installed = path.join(fixture, 'node_modules', ...pkg.name.split('/'));
  assert((await realpath(installed)).startsWith(fixture + path.sep), 'Installed package must not be a workspace symlink');
  const check = [
    "import assert from 'node:assert/strict';",
    "import { readFile } from 'node:fs/promises';",
    "import { fileURLToPath } from 'node:url';",
    'const name = ' + JSON.stringify(pkg.name) + ';',
    'const fixture = ' + JSON.stringify(fixture + path.sep) + ';',
    'const resolved = fileURLToPath(import.meta.resolve(name));',
    "assert(resolved.startsWith(fixture), 'Runtime resolved outside fixture: ' + resolved);",
    'const plugin = await import(name);',
    "assert.equal(typeof plugin.apply, 'function');",
    'const manifest = JSON.parse(await readFile(new URL(\'./node_modules/\' + name + \'/package.json\', import.meta.url), \'utf8\'));',
    'const registrations = [];',
    'globalThis.window = {__ModuleLoader__:{load:entry => registrations.push(entry)}};',
    "await import(name + '/client');",
    'assert.equal(registrations.length, 1);',
    "assert.equal(typeof registrations[0].factory, 'function');",
    "if (manifest.exports['./origin-bootstrap']) assert.equal(typeof (await import(name + '/origin-bootstrap')).apply, 'function');",
    "console.log('Isolated runtime imports and client registration passed: ' + name);",
  ].join('\n');
  await writeFile(path.join(fixture, 'verify.mjs'), check + '\n');
  run(process.execPath, ['verify.mjs'], fixture, env);
  // Copy tests and their fixtures only. Runtime modules must come from the tarball.
  for (const entry of await readdir(source, {withFileTypes:true})) {
    if (entry.isFile() && /\.test\.[cm]?js$/.test(entry.name)) await copyFile(path.join(source, entry.name), path.join(installed, entry.name));
    if (entry.isDirectory() && ['test', 'fixtures'].includes(entry.name)) await cp(path.join(source, entry.name), path.join(installed, entry.name), {recursive:true});
  }
  run(npm, ['test'], installed, env);
  results.push({name:pkg.name,version:pkg.version,tarball:packed.filename,files:files.size,integrity:packed.integrity,fixture});
}
await writeFile(path.join(output, 'validation.json'), JSON.stringify({node:process.version,host:'0.2.2-rc.1',packages:results}, null, 2) + '\n');
console.log('\nAll four tarballs installed independently and passed runtime imports plus copied tests.');
