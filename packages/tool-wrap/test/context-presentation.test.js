import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('../client.js', import.meta.url), 'utf8');

test('composition chat presentation hides bookkeeping, keeps native messages and survives registration changes', () => {
  const definitions = new Map(), listeners = new Set(), cleanups = [];
  const notify = () => { for (const listener of [...listeners]) listener(); };
  const events = {
    entries: () => [...definitions.values()],
    subscribe(listener) { listeners.add(listener); return () => listeners.delete(listener); },
    register(definition) {
      assert.equal(definitions.has(definition.kind), false);
      definitions.set(definition.kind, definition); notify();
      return () => { if (definitions.get(definition.kind) === definition) { definitions.delete(definition.kind); notify(); } };
    },
  };
  const native = {
    kind: 'input-message', target: 'chat',
    match: event => event.type === 'user/message' && event.surfaceOp === 'append' ? { id: event.data.id, role: 'start' } : null,
    start: (_context, match) => ({ kind: 'context', content: match.event.data.content, source: match.event.data.source, producer: { role: 'inject', label: match.event.data.source.kind } }),
    update: context => context.state,
    buildViewNode: context => ({ target: 'chat', data: context.state }),
  };
  const active = { uiConversation: { events }, effect(fn) { cleanups.push(fn()); } };
  let factory;
  vm.runInNewContext(source, { window: { __ModuleLoader__: { load(module) { factory = module.factory; } } } });
  factory(() => ({ createElement() {} })).apply({
    locale: { register() {}, bind: () => key => key }, effect: fn => fn(),
    slots: { inject() {} }, inject(names, apply) { assert.equal(names.join(','), 'uiConversation'); apply(active); },
  });
  assert.equal(events.entries().length, 0, 'wait for the native chat definition');
  const removeNative = events.register(native);
  const adapted = () => events.entries().find(definition => definition.kind === 'tool-wrap/context-message');
  assert.ok(adapted(), 'register through the host conversation registry');
  const event = (source, content = []) => ({ type: 'user/message', seq: 1, time: 1, surfaceOp: 'append', data: { id: 'message-1', role: 'user', source, content } });
  const text = [{ type: 'text', text: 'Visible guidance' }];
  const render = item => {
    const definition = adapted(), match = definition.match(item);
    assert.equal(match?.exclusive, true);
    const context = { start: { event: item } };
    context.state = definition.start(context, { ...match, event: item }, {});
    return definition.buildViewNode(context);
  };
  for (const source of [{ kind: 'prompt-composition-state' }, { kind: 'prompt-composition-cleared' }, { kind: 'prompt-composition', contributionId: 'message:skill-catalog:catalog:' }, { kind: 'agent-instructions', compositionAuthority: true }]) assert.equal(render(event(source)), null);
  assert.equal(render(event({ kind: 'prompt-composition', placement: 'state', operation: 'remove', contributionId: '' }, text)), null, 'empty state control is internal');
  for (const source of [{ kind: 'user' }, { kind: 'retry' }, { kind: 'time-context' }, { kind: 'dsh-mnemon', form: 'memory-snapshot' }]) assert.equal(adapted().match(event(source)), null, 'leave unrelated native messages alone');
  const projected = id => event({ kind: 'prompt-composition', contributionId: id }, text);
  for (const [id, label] of [['instructions:' + encodeURIComponent('/project/AGENTS.md'), '/project/AGENTS.md'], ['context:host:working-directory%3Acurrent', 'working-directory:current'], ['message:skill-catalog:catalog:', 'skill-catalog'], ['section:plugin:guidance', 'guidance']]) {
    const item = projected(id), before = JSON.stringify(item), view = render(item);
    assert.equal(view.data.producer.label, label);
    assert.equal(view.data.content, text);
    assert.equal(JSON.stringify(item), before, 'presentation cannot mutate persisted messages');
    assert.equal(render(JSON.parse(before)).data.producer.label, label, 'replayed messages use the same presentation');
  }
  assert.equal(render(projected('context:host:%broken')).data.producer.label, 'prompt-composition');
  assert.ok(render(event({ kind: 'prompt-composition', operation: 'remove', contributionId: 'message:skill-catalog:catalog:' }, text)), 'real instruction removals stay visible');
  const image = event({ kind: 'agent-instructions', compositionAuthority: true }, [{ type: 'image', url: 'image:test' }]);
  assert.equal(adapted().match(image), null, 'nonempty opaque content is retained');
  assert.equal(adapted().match({ ...projected('message:skill-catalog:catalog:'), surfaceOp: { op: 'replace', startSeq: 1, endSeq: 1 } }), null, 'respect native replacement visibility');
  removeNative(); assert.equal(adapted(), undefined);
  events.register({ ...native }); assert.ok(adapted(), 'recover after native plugin reload');
  cleanups.reverse().forEach(dispose => dispose?.());
  assert.equal(adapted(), undefined); assert.equal(listeners.size, 0);
});
