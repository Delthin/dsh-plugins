import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFile, lstat, access } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
const files = [...new Set(execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard', '-z'], {cwd:root, encoding:'utf8'}).split('\0').filter(Boolean))];
let checked = 0;
for (const file of files) {
  let info;
  try { info = await lstat(path.join(root, file)); }
  catch (error) { if (error.code === 'ENOENT') continue; throw error; }
  assert(!info.isSymbolicLink(), 'Symlink requires manual public review: ' + file);
  if (!info.isFile()) continue;
  assert(!/(?:^|\/)(?:node_modules|home|profiles?|sessions?|logs?|\.cache|\.npm)(?:\/|$)/.test(file), 'Runtime directory: ' + file);
  assert(!/(?:^|\/)(?:\.env(?:\..*)?|\.npmrc|seed-roles\.json|runs\.json)$/.test(file), 'Private runtime file: ' + file);
  assert(!/(?:^|\/)roles\.json$/.test(file) || file.includes('/fixtures/'), 'Real role catalog: ' + file);
  assert(!/\.(?:tgz|log)$/.test(file), 'Runtime artifact: ' + file);
  const body = await readFile(path.join(root, file), 'utf8');
  assert(!/(?:npm_[A-Za-z0-9]{20,}|gh[pousr]_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{30,}|-----BEGIN [A-Z ]*PRIVATE KEY-----)/.test(body), 'Possible credential: ' + file);
  assert(!/\/(?:Users|Volumes)\/[A-Za-z0-9]/.test(body), 'Machine-specific absolute path: ' + file);
  if (file.endsWith('.md')) {
    for (const match of body.matchAll(/!?\[[^\]]*\]\((?:<([^>]+)>|([^\s)]+))(?:\s+"[^"]*")?\)/g)) {
      const destination = match[1] ?? match[2];
      if (/^[a-z][a-z0-9+.-]*:|^#|^\/\//i.test(destination)) continue;
      const local = decodeURIComponent(destination.split(/[?#]/)[0]);
      if (!local) continue;
      await access(path.resolve(root, path.dirname(file), local)).catch(() => { throw new Error('Broken local documentation link in ' + file + ': ' + destination); });
    }
  }
  checked++;
}
console.log('Public-source boundary and documentation links checked: ' + checked + ' files.');
