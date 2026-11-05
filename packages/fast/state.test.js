import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createTierState, readRoleTier } from './state.js';

const fixture = (roleTier = async () => undefined) => {
  const records = new Map();
  return createTierState({ get: id => records.get(id), put: async (id,v) => { records.set(id,v); } }, roleTier);
};
test('sessions are independent and switches serialize', async () => {
  const state = fixture();
  assert.equal((await state.get('first')).fast,false);
  await state.set('first',true);
  assert.equal((await state.get('second')).fast,false);
  await Promise.all([state.set('first','toggle'),state.set('first','toggle')]);
  assert.equal((await state.get('first')).fast,true);
  await state.set('first',false);
  assert.equal((await state.get('first')).fast,false);
});
test('role snapshot overrides session values and cannot be changed', async () => {
  let role;
  const state = fixture(async () => role);
  await state.set('child',true);
  role = {fast:false,locked:true,source:'role'};
  assert.equal((await state.get('child')).fast,false);
  await assert.rejects(state.set('child',true),/角色档位固定/);
  role = {fast:true,locked:true,source:'role'};
  assert.equal((await state.get('child')).fast,true);
});
test('optional role snapshot paths leave ordinary sessions usable', async () => {
  for (const path of [undefined, null, '', '  ']) {
    assert.equal(await readRoleTier(path, 'ordinary'), undefined);
    const state = fixture(id => readRoleTier(path, id));
    assert.deepEqual(await state.get('ordinary'), { fast: false, locked: false, source: 'session' });
    assert.equal((await state.set('ordinary', true)).fast, true);
    assert.equal((await state.set('ordinary', false)).fast, false);
  }
});
test('only immutable selection owns role tier, missing snapshot remains standard',async () => {
  const dir = await mkdtemp(join(tmpdir(),'dsh-fast-state-'));
  try {
    const path = join(dir,'runs.json');
    assert.equal(await readRoleTier(path,'new'),undefined);
    await writeFile(path,JSON.stringify({items:[{sessionId:'old',role:{fast:true}},{sessionId:'fixed',selection:{fast:false},role:{fast:true}},{sessionId:'fast',selection:{fast:true}}]}));
    assert.equal((await readRoleTier(path,'old')).fast,false);
    assert.equal((await readRoleTier(path,'fixed')).fast,false);
    assert.equal((await readRoleTier(path,'fast')).fast,true);
    assert.equal(await readRoleTier(path,'other'),undefined);
    await writeFile(path,'broken');
    await assert.rejects(readRoleTier(path,'old'));
  } finally { await rm(dir,{recursive:true}); }
});
