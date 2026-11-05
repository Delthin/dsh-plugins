import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const manifest = JSON.parse(await readFile(new URL('package.json', root), 'utf8'));

test('scoped package exports resolve both host entries and all client resources', async () => {
  assert.equal(manifest.name, '@delthin/dsh-tool-wrap');
  assert.equal((await import(manifest.name)).name, 'tool-discovery');
  assert.equal((await import(`${manifest.name}/origin-bootstrap`)).name, 'tool-discovery-origins');
  for (const path of ['./client', './icon', './package.json', './cordis.patch.yml']) {
    assert.equal(import.meta.resolve(`${manifest.name}${path.slice(1)}`), new URL(manifest.exports[path], root).href);
    await readFile(new URL(manifest.exports[path], root));
  }
  for (const lang of ['en-US', 'zh-CN']) {
    const specifier = `${manifest.name}/locale/${lang}.json`;
    const url = new URL(`locale/${lang}.json`, root);
    assert.equal(import.meta.resolve(specifier), url.href);
    const dictionary = JSON.parse(await readFile(url, 'utf8'));
    assert.equal(typeof dictionary['meta.title'], 'string');
    assert.equal(typeof dictionary['meta.description'], 'string');
  }
  for (const file of ['README.md', 'README.en.md', 'CHANGELOG.md']) assert.ok(manifest.files.includes(file));
});

test('scoped patch retains internal ids and the origin bootstrap dependency gate', async () => {
  const patch = await readFile(new URL(manifest.dsh.bundle.patch, root), 'utf8');
  assert.match(patch, /id: tool-discovery-origins\s+name: '@delthin\/dsh-tool-wrap\/origin-bootstrap'/);
  assert.match(patch, /id: tool-discovery\s+name: '@delthin\/dsh-tool-wrap'/);
  assert.match(patch, /id: tools\s+name: '@deepseek-ai\/dsh-tools'\s+inject:\s+toolDiscoveryOriginsReady: null/);
  assert.doesNotMatch(patch, /name: ['"]?dsh-tool-discovery/);
});

test('all direct host test imports are declared as peers or explicit test dependencies', async () => {
  const { readdir } = await import('node:fs/promises');
  const declared = { ...manifest.dependencies, ...manifest.peerDependencies, ...manifest.devDependencies };
  for (const file of await readdir(new URL('test/', root))) {
    if (!file.endsWith('.js')) continue;
    const source = await readFile(new URL(`test/${file}`, root), 'utf8');
    for (const [, dependency] of source.matchAll(/['"](@deepseek-ai\/[^'"]+)['"]/g)) {
      // Tool/plugin ids in fixture data are not host imports.
      if (!source.includes(`from '${dependency}'`) && !source.includes(`import('${dependency}')`)) continue;
      assert.ok(declared[dependency], `${file}: undeclared host dependency ${dependency}`);
    }
  }
});
