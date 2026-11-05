import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { runInNewContext } from 'node:vm';

const source = await readFile(new URL('./client.js', import.meta.url), 'utf8');

function render(tier, { provider = 'responses-provider', locked = false } = {}) {
  let module, slot, stateIndex = 0;
  const requests = [];
  const React = {
    Fragment: Symbol('Fragment'),
    createElement: (type, props, ...children) => ({ type, props: props ?? {}, children: children.flat(Infinity) }),
    useState: initial => [stateIndex++ === 0 ? tier : initial, () => {}],
    useEffect() {},
    useRef: initial => ({ current: initial }),
    useId: () => 'synthetic-picker',
    useSyncExternalStore: (_subscribe, snapshot) => snapshot(),
  };
  runInNewContext(source, {
    window: { __ModuleLoader__: { load(value) { module = value; } } },
    document: { createElement: () => ({ remove() {} }), head: { appendChild() {} } },
    fetch: async (_url, options) => {
      requests.push(JSON.parse(options.body));
      return { ok: true, json: async () => ({ ...tier, fast: false }) };
    },
  });
  assert.equal(module.id, '@delthin/dsh-fast');
  const plugin = module.factory(name => { assert.equal(name, 'react'); return React; });
  const directory = {
    store: { subscribe() {}, getSnapshot: () => ({ status: 'ready', current: { provider, model: 'synthetic-model' }, groups: [{ id: provider, models: [{ id: 'synthetic-model', name: 'Synthetic model' }] }], failures: [] }) },
  };
  const ctx = {
    effect: effect => effect(),
    locale: { register: () => () => {}, bind: () => key => key, subscribe() {}, getSnapshot() {} },
    modelDirectories: { directoryFor: () => directory },
    slots: { inject: (_name, effect) => effect(), register: (_options, component) => { slot = component; return () => {}; } },
  };
  plugin.apply(ctx);
  const picker = slot({ sessionId: 'ordinary', locked });
  const tree = picker.type(picker.props);
  const elements = [];
  const visit = node => {
    if (!node || typeof node !== 'object') return;
    elements.push(node);
    for (const child of node.children ?? []) visit(child);
  };
  visit(tree);
  return { button: elements.find(node => node.props.className === 'df-tier'), requests };
}

test('scoped client only enables Fast for an explicitly configured matching provider', () => {
  const base = { provider: 'responses-provider', fast: false, locked: false };
  assert.equal(render({ ...base, configured: true }).button.props.disabled, false);
  assert.equal(render({ ...base, configured: false }).button.props.disabled, true);
  assert.equal(render(base).button.props.disabled, true);
  assert.equal(render({ ...base, configured: true }, { provider: 'other-provider' }).button.props.disabled, true);
  assert.equal(render(null).button.props.disabled, true);
  assert.equal(render({ ...base, configured: true, locked: true }).button.props.disabled, true);
  assert.equal(render({ ...base, configured: true }, { locked: true }).button.props.disabled, true);
});

test('client lets a persisted unsupported Fast session safely switch back to Standard', async () => {
  for (const configured of [false, true]) {
    const { button, requests } = render({ provider: 'responses-provider', fast: true, configured, locked: false }, { provider: 'other-provider' });
    assert.equal(button.props.disabled, false);
    await button.props.onClick();
    assert.deepEqual(requests, [{ sessionId: 'ordinary', action: 'set', fast: false }]);
  }
});
