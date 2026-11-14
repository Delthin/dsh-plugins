#!/usr/bin/env node
import { readFile, writeFile, rename, mkdir, realpath, lstat, unlink } from 'node:fs/promises';
import { resolve, join, dirname, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash, randomUUID } from 'node:crypto';
import { PATCHES_BY_VERSION, HOST_VERSION, patchSource } from './patches.js';

const digest = value => createHash('sha256').update(value).digest('hex');
const here = dirname(fileURLToPath(import.meta.url));
const exists = async path => { try { await lstat(path); return true; } catch (error) { if (error.code === 'ENOENT') return false; throw error; } };
async function readRegular(path) {
  if (!(await lstat(path)).isFile()) throw new Error(`Refusing non-regular file: ${path}`);
  return readFile(path);
}
async function atomic(path, content) {
  const temp = path + '.tool-wrap-' + randomUUID() + '.tmp';
  const mode = await lstat(path).then(stat => stat.mode & 0o777, error => { if (error.code === 'ENOENT') return 0o600; throw error; });
  await writeFile(temp, content, { flag: 'wx', mode });
  await rename(temp, path);
}
const args = process.argv.slice(2);
const options = {};
for (let index = 0; index < args.length; index++) {
  const arg = args[index];
  if (['--check', '--apply', '--restore'].includes(arg)) { if (options.mode) throw new Error('Choose exactly one action'); options.mode = arg; }
  else if (['--root', '--backup'].includes(arg) && args[index + 1] && !args[index + 1].startsWith('--')) options[arg.slice(2)] = args[++index];
  else throw new Error(`Unknown or incomplete argument: ${arg}`);
}
if (!options.mode || !options.root) throw new Error('Usage: adapter.mjs --check|--apply|--restore --root <installation-root> [--backup <backup-directory>]');
const root = await realpath(resolve(options.root));
const targetOf = path => {
  const target = resolve(root, path);
  if (!target.startsWith(join(root, 'node_modules', '@deepseek-ai') + sep)) throw new Error('Invalid target outside audited host packages');
  return target;
};
const hostVersion = JSON.parse(await readRegular(targetOf('node_modules/@deepseek-ai/dsh-system-prompt/package.json'))).version;
const PATCHES = PATCHES_BY_VERSION[hostVersion];
if (!PATCHES) throw new Error(`Unsupported host version ${hostVersion}; this local adapter only audits ${Object.keys(PATCHES_BY_VERSION).join(', ')}`);
const backup = resolve(options.backup ?? join(root, '.tool-wrap-host-adapter-v1' + (hostVersion === HOST_VERSION ? '' : '-' + hostVersion)));
if (backup === root || backup.startsWith(join(root, 'node_modules') + sep)) throw new Error('Backup must be outside node_modules and not the installation root');
const manifestPath = join(backup, 'manifest.json');

async function restore(manifest) {
  if (manifest.version !== 1 || manifest.root !== root || !Array.isArray(manifest.files) || manifest.files.length !== PATCHES.length) throw new Error('Invalid restoration manifest');
  const prepared = [];
  for (const [index, file] of manifest.files.entries()) {
    const expectedPath = `node_modules/${PATCHES[index].name}/${PATCHES[index].file ?? 'lib/index.js'}`;
    if (file.path !== expectedPath || file.originalHash !== PATCHES[index].sha256 || typeof file.patchedHash !== 'string') throw new Error('Manifest does not match audited patch targets');
    const target = targetOf(file.path), current = await readRegular(target);
    if (![file.originalHash, file.patchedHash].includes(digest(current))) throw new Error(`Refusing to overwrite independently modified host file: ${file.path}`);
    const original = await readRegular(join(backup, `${index}.original.js`));
    if (digest(original) !== file.originalHash) throw new Error('Restoration backup hash mismatch');
    prepared.push({ target, original });
  }
  const helperPath = 'node_modules/@deepseek-ai/dsh-agent-loop/lib/tool-wrap-admission.js';
  if (manifest.helper?.path !== helperPath) throw new Error('Invalid helper restoration target');
  const helper = targetOf(helperPath);
  if (await exists(helper) && digest(await readRegular(helper)) !== manifest.helper.sha256) throw new Error('Refusing to remove independently modified admission helper');
  for (const file of prepared) await atomic(file.target, file.original);
  // Exact audited helper path was resolved and its hash checked above; no recursive deletion.
  if (await exists(helper)) await unlink(helper);
  await atomic(manifestPath, JSON.stringify({ ...manifest, state: 'restored' }, null, 2) + '\n');
  console.log('Restored audited host files. No process was restarted.');
}

if (options.mode === '--restore') {
  await restore(JSON.parse(await readRegular(manifestPath)));
} else {
  const prepared = [];
  const prior = await exists(manifestPath) ? JSON.parse(await readRegular(manifestPath)) : undefined;
  for (const [index, patch] of PATCHES.entries()) {
    const packageDir = targetOf(`node_modules/${patch.name}`);
    const info = JSON.parse(await readRegular(join(packageDir, 'package.json')));
    if (info.name !== patch.name || info.version !== hostVersion) throw new Error(`Unsupported ${patch.name} version; expected audited host ${hostVersion}`);
    if (await realpath(packageDir) !== packageDir) throw new Error('Refusing a linked host package outside this installation');
    const path = `node_modules/${patch.name}/${patch.file ?? 'lib/index.js'}`, target = targetOf(path);
    const current = await readRegular(target);
    let original = current;
    if (digest(current) !== patch.sha256) {
      if (prior?.root !== root || prior.files?.[index]?.path !== path || prior.files[index].patchedHash !== digest(current)) throw new Error(`Unsupported source hash: ${patch.name}`);
      original = await readRegular(join(backup, `${index}.original.js`));
      if (digest(original) !== patch.sha256) throw new Error('Original backup hash mismatch');
    }
    const patched = Buffer.from(patchSource(original.toString('utf8'), patch));
    prepared.push({ path, target, original, patched, originalHash: patch.sha256, patchedHash: digest(patched) });
  }
  const helper = await readRegular(join(here, 'admission.js'));
  const helperPath = 'node_modules/@deepseek-ai/dsh-agent-loop/lib/tool-wrap-admission.js';
  const helperTarget = targetOf(helperPath);
  if (await exists(helperTarget)) {
    const currentHash = digest(await readRegular(helperTarget));
    const recordedHelper = prior?.root === root && prior.helper?.path === helperPath && prior.helper.sha256 === currentHash;
    if (currentHash !== digest(helper) && !recordedHelper) throw new Error('Admission helper target already exists with different content');
  }
  console.log(`Validated ${prepared.length} audited ${hostVersion} host files and all patch anchors.`);
  if (options.mode === '--apply') {
    if (prior && prior.root !== root) throw new Error('Backup directory belongs to another installation');
    await mkdir(backup, { recursive: true, mode: 0o700 });
    for (const [index, file] of prepared.entries()) {
      const path = join(backup, `${index}.original.js`);
      if (await exists(path)) { if (digest(await readRegular(path)) !== file.originalHash) throw new Error('Existing backup differs; choose a fresh backup directory'); }
      else await writeFile(path, file.original, { flag: 'wx', mode: 0o600 });
    }
    const manifest = { version: 1, root, state: 'prepared', files: prepared.map(({ path, originalHash, patchedHash }) => ({ path, originalHash, patchedHash })), helper: { path: helperPath, sha256: digest(helper) } };
    await atomic(manifestPath, JSON.stringify(manifest, null, 2) + '\n');
    try {
      await atomic(helperTarget, helper);
      for (const file of prepared) await atomic(file.target, file.patched);
      await atomic(manifestPath, JSON.stringify({ ...manifest, state: 'applied' }, null, 2) + '\n');
    } catch (error) {
      // Prepared backups and manifest survive both a partial write and process interruption.
      throw new Error(`Host application interrupted; restore with the same --root and --backup. Cause: ${error.message}`);
    }
    console.log(`Applied local host adapter; backups: ${backup}. No process was restarted.`);
  }
}
