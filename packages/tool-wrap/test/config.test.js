import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, readFile, readdir, rmdir, stat, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { ConfigStore, DEFAULT_CONFIG, DiscoveryError, validateConfig } from '../core.js';
import { enabledConfig, hostFixture, temporaryDirectory } from './fixture.js';

const invalidConfigs = () => [
  null, [], 'true', {},
  enabledConfig({ enabled: 1 }), enabledConfig({ enabled: 'true' }),
  enabledConfig({ unknown: true }), enabledConfig({ version: 4 }), enabledConfig({ version: 1, groups: ['missing'] }),
  enabledConfig({ descriptions: null }), enabledConfig({ descriptions: [] }), enabledConfig({ descriptions: 'summary' }),
  ...['', ' leading', 'trailing ', 'control\u0000id', 'line\nbreak', 'x'.repeat(513)].map(id => enabledConfig({ descriptions: { [id]: 'Valid summary' } })),
  ...[null, 1, {}, [], '', ' \n ', 'x'.repeat(2001), 'control\u0000text', 'control\u0001text', 'tab\ttext', 'delete\u007ftext'].map(description => enabledConfig({ descriptions: { 'dsh-ego-browser': description } })),
  enabledConfig({ descriptions: Object.fromEntries(Array.from({ length: 513 }, (_, index) => [`@fixture/${index}`, 'Summary'])) }),
  ...['groups', 'tools', 'exclude'].flatMap(key => [
    enabledConfig({ [key]: null }), enabledConfig({ [key]: 'browser' }),
    enabledConfig({ [key]: [1] }), enabledConfig({ [key]: [''] }),
    enabledConfig({ [key]: [key === 'groups' ? ' leading space' : 'has space'] }),
    enabledConfig({ [key]: [key === 'groups' ? 'trailing space ' : '../path'] }),
    enabledConfig({ [key]: ['control\u0000character'] }), enabledConfig({ [key]: ['line\nbreak'] }),
    enabledConfig({ [key]: ['x'.repeat(key === 'groups' ? 513 : 129)] }), enabledConfig({ [key]: Array(513).fill('x') }),
  ]),
  ...['tools', 'exclude'].flatMap(key => ['run_code', 'discover_tools'].map(name => enabledConfig({ [key]: [name] }))),
];

test('strict config validation rejects every malformed/protected setting without changing persisted or in-memory config', async t => {
  const dir = await temporaryDirectory(t);
  const store = new ConfigStore(dir);
  const initial = enabledConfig({ groups: ['dsh-image-gen'], tools: ['virtual_echo'] });
  await store.save(initial);
  const bytes = await readFile(store.path, 'utf8');
  for (const value of invalidConfigs()) {
    assert.throws(() => validateConfig(value), DiscoveryError, JSON.stringify(value));
    assert.throws(() => store.save(value), DiscoveryError, JSON.stringify(value));
    assert.deepEqual(store.config, initial);
    assert.equal(await readFile(store.path, 'utf8'), bytes);
  }
  assert.deepEqual(await readdir(dir), ['tool-discovery.json']);
});

test('ConfigStore defaults, normalized round-trip, private mode, detached copies and serialized writes', async t => {
  const dir = await temporaryDirectory(t);
  const store = new ConfigStore(dir);
  const defaults = await store.load();
  assert.deepEqual(defaults, DEFAULT_CONFIG);
  assert.deepEqual(defaults, { version: 3, enabled: false, groups: [], tools: [], exclude: [], descriptions: {} });
  defaults.groups.push('changed copy');
  assert.deepEqual(store.config, DEFAULT_CONFIG);
  const input = enabledConfig({ groups: ['dsh-image-gen', 'dsh-ego-browser', 'dsh-image-gen'], tools: ['z', 'a', 'a'], exclude: ['z', 'z'], descriptions: { 'dsh-ego-browser': '  Browser overview\nSecond line  ' } });
  const pending = store.save(input);
  input.tools.push('mutated after save');
  input.descriptions['dsh-ego-browser'] = 'mutated after save';
  const saved = await pending;
  const normalized = enabledConfig({ groups: ['dsh-ego-browser', 'dsh-image-gen'], tools: ['a', 'z'], exclude: ['z'], descriptions: { 'dsh-ego-browser': 'Browser overview\nSecond line' } });
  assert.deepEqual(saved, normalized);
  saved.tools.push('mutated return');
  saved.descriptions['dsh-ego-browser'] = 'mutated save return';
  assert.deepEqual(store.config, normalized);
  const fresh = new ConfigStore(dir);
  const loaded = await fresh.load();
  assert.deepEqual(loaded, normalized);
  loaded.tools.push('mutated load return');
  loaded.descriptions['dsh-ego-browser'] = 'mutated load return';
  assert.deepEqual(fresh.config, normalized);
  assert.equal((await stat(store.path)).mode & 0o777, 0o600);
  const variants = Array.from({ length: 12 }, (_, i) => enabledConfig({ groups: [], tools: [`fixture_${i}`] }));
  const writes = variants.map(value => store.save(value));
  // Reading during queued same-directory rename publication must always see complete valid JSON.
  for (let i = 0; i < 20; i++) {
    const observed = JSON.parse(await readFile(store.path, 'utf8'));
    assert.doesNotThrow(() => validateConfig(observed));
  }
  assert.deepEqual(await Promise.all(writes), variants);
  assert.deepEqual(store.config, variants.at(-1));
  assert.deepEqual(JSON.parse(await readFile(store.path, 'utf8')), variants.at(-1));
  assert.deepEqual(await readdir(dir), ['tool-discovery.json']);
});

test('failed publication preserves memory and target, cleans staging files and does not poison the write queue', async t => {
  const dir = await temporaryDirectory(t);
  const store = new ConfigStore(dir);
  const initial = enabledConfig({ groups: [] });
  await store.save(initial);
  const previousBytes = await readFile(store.path, 'utf8');
  const realPath = store.path;
  const blocked = join(dir, 'blocked-publication-target');
  await mkdir(blocked);
  // An existing directory forces rename failure deterministically, including root/Windows hosts.
  store.path = blocked;
  await assert.rejects(store.save(enabledConfig({ tools: ['virtual_echo'] })), error => error instanceof DiscoveryError && error.status === 500);
  assert.deepEqual(store.config, initial);
  assert.equal(await readFile(realPath, 'utf8'), previousBytes);
  assert.deepEqual(await readdir(blocked), []);
  assert.deepEqual((await readdir(dir)).sort(), ['blocked-publication-target', 'tool-discovery.json']);
  store.path = realPath;
  const recovered = enabledConfig({ groups: ['@deepseek-ai/dsh-tool-schedule'] });
  assert.deepEqual(await store.save(recovered), recovered);
  assert.deepEqual(JSON.parse(await readFile(realPath, 'utf8')), recovered);
  // The exact empty directory was created above, remains under this test's own root.
  assert.equal(blocked, join(dir, 'blocked-publication-target'));
  await rmdir(blocked);
});

test('missing config uses defaults; malformed JSON and invalid on-disk config fail closed', async t => {
  const dir = await temporaryDirectory(t);
  const store = new ConfigStore(dir);
  assert.deepEqual(await store.load(), DEFAULT_CONFIG);
  for (const bytes of ['{', JSON.stringify(enabledConfig({ enabled: 'true' })), 'null']) {
    await writeFile(store.path, bytes);
    await assert.rejects(new ConfigStore(dir).load(), error => error instanceof DiscoveryError && error.status === 500);
  }
});

test('legacy configs migrate atomically once, preserving enabled, explicit tools and exclusions', async t => {
  for (const version of [undefined, 1]) for (const enabled of [false, true]) {
    const dir = await temporaryDirectory(t);
    const store = new ConfigStore(dir);
    const legacy = { ...(version === undefined ? {} : { version }), enabled, groups: ['schedule', 'browser', 'image', 'browser'], tools: ['virtual_echo', 'ego_visit'], exclude: ['ego_visit', 'schedule_list'] };
    const expected = enabledConfig({ enabled, tools: ['ego_visit', 'virtual_echo'], exclude: ['ego_visit', 'schedule_list'] });
    assert.deepEqual(validateConfig(legacy), expected);
    await writeFile(store.path, JSON.stringify(legacy));
    const before = await stat(store.path);
    assert.deepEqual(await store.load(), expected);
    const migrated = await stat(store.path);
    assert.notEqual(migrated.ino, before.ino, 'migration publishes a replacement inode using atomic rename');
    assert.equal(migrated.mode & 0o777, 0o600);
    const bytes = await readFile(store.path, 'utf8');
    assert.deepEqual(JSON.parse(bytes), expected);
    assert.deepEqual(await readdir(dir), ['tool-discovery.json']);
    assert.deepEqual(await new ConfigStore(dir).load(), expected);
    assert.equal(await readFile(store.path, 'utf8'), bytes);
    assert.equal((await stat(store.path)).ino, migrated.ino, 'v3 load must not rewrite the config');
  }
});

test('v2 migration preserves opaque plugin IDs, explicit tools and exclusions and publishes v3 once', async t => {
  const dir = await temporaryDirectory(t);
  const store = new ConfigStore(dir);
  const legacy = { version: 2, enabled: true, groups: ['browser', '@unavailable/plugin', './local plugin.js'], tools: ['virtual_echo'], exclude: ['ego_visit'] };
  const expected = enabledConfig({ groups: [...legacy.groups].sort(), tools: legacy.tools, exclude: legacy.exclude });
  assert.deepEqual(validateConfig(legacy), expected);
  await writeFile(store.path, JSON.stringify(legacy));
  const before = await stat(store.path);
  assert.deepEqual(await store.load(), expected);
  const migrated = await stat(store.path);
  assert.notEqual(migrated.ino, before.ino);
  assert.equal(migrated.mode & 0o777, 0o600);
  const bytes = await readFile(store.path, 'utf8');
  assert.deepEqual(JSON.parse(bytes), expected);
  assert.deepEqual(await new ConfigStore(dir).load(), expected);
  assert.equal((await stat(store.path)).ino, migrated.ino);
  assert.equal(await readFile(store.path, 'utf8'), bytes);
  assert.deepEqual(await readdir(dir), ['tool-discovery.json']);
});

test('description limits accept 512 opaque plugin IDs and trim before the 2000-character check', () => {
  const descriptions = Object.fromEntries(Array.from({ length: 512 }, (_, index) => [`@fixture/${index}`, `  ${'x'.repeat(2000)}\n  `]));
  const validated = validateConfig(enabledConfig({ descriptions }));
  assert.equal(Object.keys(validated.descriptions).length, 512);
  assert.ok(Object.values(validated.descriptions).every(value => value === 'x'.repeat(2000)));
  assert.equal(validateConfig(enabledConfig({ descriptions: { './local plugin.js': ' First line\nSecond line ' } })).descriptions['./local plugin.js'], 'First line\nSecond line');
});

test('stale settings versions cannot overwrite persisted custom descriptions or emit a prompt change', async t => {
  const config = enabledConfig({ descriptions: { 'dsh-ego-browser': 'Persisted custom overview' } });
  const { ctx, dir, request } = await hostFixture(t, { config });
  const path = join(dir, 'tool-discovery.json');
  const original = await readFile(path, 'utf8');
  let changes = 0;
  ctx.on('system-prompt/change', () => { changes++; });
  for (const version of [undefined, 1, 2]) {
    const stale = { ...(version === undefined ? {} : { version }), enabled: false, groups: [], tools: [], exclude: [] };
    const rejected = await request('PUT', stale);
    assert.equal(rejected.statusCode, 409);
    assert.equal(rejected.headers['Cache-Control'], 'no-store');
    assert.equal(rejected.headers['X-Content-Type-Options'], 'nosniff');
    assert.equal(await readFile(path, 'utf8'), original);
    assert.deepEqual((await request()).body.config, config);
    assert.equal(changes, 0);
  }
});

test('settings route applies host rejection before reads/writes; invalid requests are atomic and bounded', async t => {
  const { ctx, dir, request } = await hostFixture(t);
  const path = join(dir, 'tool-discovery.json');
  const original = await readFile(path, 'utf8');
  let changes = 0;
  ctx.on('system-prompt/change', () => { changes++; });
  assert.equal((await request('GET', undefined, { 'x-fixture-reject': 'yes' })).statusCode, 403);
  assert.equal((await request('PUT', enabledConfig({ enabled: false }), { 'x-fixture-reject': 'yes' })).statusCode, 403);
  assert.equal((await request('POST')).statusCode, 405);
  assert.equal((await request('PUT', enabledConfig(), { 'content-type': 'text/plain' })).statusCode, 415);
  assert.equal((await request('PUT', '{')).statusCode, 400);
  assert.equal((await request('PUT', 'x'.repeat(65537))).statusCode, 413);
  for (const value of invalidConfigs()) assert.equal((await request('PUT', value)).statusCode, value?.version === 3 ? 400 : 409, JSON.stringify(value));
  assert.equal(changes, 0);
  assert.equal(await readFile(path, 'utf8'), original);
  const valid = enabledConfig({ groups: ['dsh-image-gen'], exclude: ['generate_image'] });
  const response = await request('PUT', valid);
  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.body.config, valid);
  assert.equal(response.headers['Cache-Control'], 'no-store');
  assert.equal(response.headers['X-Content-Type-Options'], 'nosniff');
  assert.equal(changes, 1);
  assert.deepEqual(JSON.parse(await readFile(path, 'utf8')), valid);
  assert.deepEqual((await request()).body.config, valid);
});
