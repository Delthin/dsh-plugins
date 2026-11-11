import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { apply } from '../index.js';

test('fixed model settings reach the host request with the legacy stored shape', async (t) => {
  const root = await mkdtemp(join(tmpdir(), 'cardex-model-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const configPath = join(root, 'settings.json');
  const sessions = new Map();
  const calls = [];
  let handler;
  const ctx = {
    storageDomain: { open: async () => ({ table: () => ({ get: (id) => sessions.get(id), put: (id, value) => sessions.set(id, value) }), close() {} }) },
    effect: (fn) => fn(),
    commands: { register: (command) => { handler = command.handler; } },
    sessionQuery: {},
    llm: { prepareCall: async (request) => { calls.push(request); throw new Error('request captured'); } },
  };
  await apply(ctx, { configPath, directory: root, model: 'profile/default' });
  const agent = { id: 'session', status: 'idle', model: { current: () => ({ provider: 'live', model: 'other' }) } };
  const command = (rawInput) => handler({ agent, rawInput });
  const draft = { id: 'draft', directory: root, question: 'question', startedAt: new Date().toISOString(), startSeq: 0 };
  const prepared = { draftId: draft.id, recordId: 'record', messages: [{ role: 'user', text: 'question', timestamp: 1 }, { role: 'assistant', text: 'answer', timestamp: 2 }] };
  sessions.set(agent.id, { draft, prepared });

  assert.equal((await command('model fixed/vendor/model')).kind, 'success');
  assert.deepEqual(JSON.parse(await readFile(configPath, 'utf8')).model, { provider: 'fixed', id: 'vendor/model' });
  assert.match((await command('end')).text, /request captured/);
  assert.deepEqual(calls.pop(), { provider: 'fixed', model: 'vendor/model', maxTokens: 16000 });

  await writeFile(configPath, JSON.stringify({ version: 1, model: { provider: 'legacy', id: 'saved' } }));
  assert.match((await command('end')).text, /request captured/);
  assert.deepEqual(calls.pop(), { provider: 'legacy', model: 'saved', maxTokens: 16000 });
});
