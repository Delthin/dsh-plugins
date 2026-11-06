import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { runInNewContext } from 'node:vm';

const source = await readFile(new URL('./client.js', import.meta.url), 'utf8');

function render(tier, { provider = 'responses-provider', locked = false, reasoning = null, effort = '' } = {}) {
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
  const selects = [];
  const model = { id: 'synthetic-model', name: 'Synthetic model', ...reasoning ? { reasoning } : {} };
  const directory = {
    store: { subscribe() {}, getSnapshot: () => ({ status: 'ready', current: { provider, model: 'synthetic-model', ...effort ? { reasoningEffort: effort } : {} }, groups: [{ id: provider, models: [model] }], failures: [] }) },
    select: async selection => { selects.push(selection); return { ok: true }; },
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
  return { button: elements.find(node => node.props.className === 'df-tier'), elements, selects, requests };
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

test('client keeps an effort drag alive when another script moves focus during pointer capture', async () => {
  const reasoning = { defaultEffort: 'low', efforts: [{ id: 'low', name: 'Low' }, { id: 'high', name: 'High' }] };
  const flatten = node => {
    const nodes = [];
    const walk = value => { if (!value || typeof value !== 'object') return; nodes.push(value); for (const child of value.children ?? []) walk(child); };
    walk(node);
    return nodes;
  };
  const startDrag = capture => {
    const { elements, selects } = render({ provider: 'responses-provider', fast: false, configured: true, locked: false }, { reasoning, effort: 'low' });
    const control = elements.find(node => typeof node.type === 'function' && node.props.options?.length > 1);
    assert.ok(control, 'effort slider component rendered');
    const slider = flatten(control.type(control.props)).find(node => node.props?.className === 'df-slider');
    assert.equal(slider.props.role, 'slider');
    const currentTarget = {
      focus() {}, setPointerCapture() {}, releasePointerCapture() {},
      hasPointerCapture: () => capture,
      getBoundingClientRect: () => ({ left: 0, width: 208 }),
    };
    const event = clientX => ({ button: 0, isPrimary: true, pointerId: 7, clientX, target: { closest: () => null }, currentTarget, preventDefault() {} });
    slider.props.onPointerDown(event(13));
    slider.props.onBlur({ currentTarget });
    return { slider, selects, event };
  };

  const kept = startDrag(true);
  kept.slider.props.onPointerMove(kept.event(150));
  kept.slider.props.onPointerUp(kept.event(182));
  await new Promise(resolve => setTimeout(resolve, 0));
  assert.equal(kept.selects.length, 1);
  assert.equal(kept.selects[0].provider, 'responses-provider');
  assert.equal(kept.selects[0].model, 'synthetic-model');
  assert.equal(kept.selects[0].reasoningEffort, 'high');

  const lost = startDrag(false);
  lost.slider.props.onPointerUp(lost.event(182));
  await new Promise(resolve => setTimeout(resolve, 0));
  assert.deepEqual(lost.selects, []);
});
