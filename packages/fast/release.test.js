import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const json = async path => JSON.parse(await readFile(new URL(path, import.meta.url), 'utf8'));

test('release metadata retains standalone exports and declares the authorized 0.1.3 package', async () => {
  const pkg = await json('./package.json');
  assert.equal(pkg.name, '@delthin/dsh-fast');
  assert.equal(pkg.version, '0.1.3');
  assert.equal(pkg.license, 'PolyForm-Noncommercial-1.0.0');
  assert.equal(Object.hasOwn(pkg, 'private'), false);
  assert.equal(pkg.publishConfig.access, 'public');
  assert.equal(pkg.engines.dsh, '>=0.2.1-rc.5 || >=0.2.2-rc.1');
  assert.equal(pkg.dependencies.undici, '7.30.1');
  assert.equal(pkg.dependencies.zod, '4.6.7');
  assert.equal(pkg.devDependencies['@deepseek-ai/cordis'], '4.1.0');
  assert.equal(pkg.devDependencies['@deepseek-ai/schemastery'], '3.19.0');
  assert.ok(pkg.keywords.includes('dsh-plugin'));
  assert.equal(pkg.exports['.'], './index.js');
  assert.equal(pkg.exports['./client'], './client.js');
  assert.equal(pkg.exports['./cordis.patch.yml'], './cordis.patch.yml');
  for (const file of ['index.js', 'config.js', 'state.js', 'transport.js', 'client.js', 'LICENSE']) assert.ok(pkg.files.includes(file));
  assert.match(await readFile(new URL('./cordis.patch.yml', import.meta.url), 'utf8'), /name: ["']@delthin\/dsh-fast["']/);
  assert.match(await readFile(new URL('./cordis.patch.yml', import.meta.url), 'utf8'), /config: \{\}/);
});

test('plugin locale metadata uses the host meta namespace in both languages', async () => {
  for (const language of ['zh', 'en']) {
    const locale = await json(`./locale/${language}.json`);
    assert.ok(locale.meta.title);
    assert.ok(locale.meta.description);
  }
});
