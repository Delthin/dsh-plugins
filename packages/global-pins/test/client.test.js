import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { runInNewContext } from 'node:vm';

const source = await readFile(new URL('../client.js', import.meta.url), 'utf8');
const flag = 'data-dgp-native-pin';

// DOM ownership/geometry contract coverage. The host browser verifies actual
// theme paint, hit testing, hover cards and React's native event handling.
function fixture({ zoom = 1.15, currentZoom = true, resizeObserver = true } = {}) {
  let layoutReads = 0, queries = 0, stateWrites = 0;
  class Style {
    values = new Map();
    setProperty(key, value, priority = '') { this.values.set(key, [value, priority]); }
    getPropertyValue(key) { return this.values.get(key)?.[0] ?? ''; }
    getPropertyPriority(key) { return this.values.get(key)?.[1] ?? ''; }
    removeProperty(key) { this.values.delete(key); }
  }
  class Element {
    constructor(name) { this.nodeType = 1; this.name = name; this.children = []; this.attributes = new Map(); this.style = new Style(); this.parentNode = null; this.width = 260; this.height = 28; this.left = 8; this.top = 100; this._scrollTop = 0; this.textContent = ''; }
    get currentCSSZoom() { return currentZoom ? zoom : undefined; }
    get parentElement() { return this.parentNode; }
    get isConnected() { return html.contains(this); }
    get firstChild() { return this.children[0] ?? null; }
    get nextSibling() { return this.parentNode?.children[this.parentNode.children.indexOf(this) + 1] ?? null; }
    get clientLeft() { return 0; }
    get clientTop() { return 0; }
    get clientWidth() { return this.className === 'dgp-mount' || this.className === 'dgp-native-viewport' ? this.parentElement.clientWidth : this.width; }
    get scrollHeight() { return this.className === 'dgp-native-viewport' ? Number.parseFloat(this.firstChild.style.height) || 0 : 1500; }
    get clientHeight() {
      if (this.className === 'dgp-mount') return this.hidden ? 0 : 28 + this.children[1].clientHeight;
      if (this.className === 'dgp-native-viewport') return this.parentNode.getAttribute('data-placement') === 'inside' ? this.scrollHeight : Math.min(this.scrollHeight, Math.max(0, Number.parseFloat(this.parentNode.style.maxHeight) - 28) || 0);
      return this.height;
    }
    get scrollTop() { return this._scrollTop; }
    set scrollTop(value) { this._scrollTop = Math.max(0, Math.min(value, this.scrollHeight - this.clientHeight)); }
    setAttribute(key, value) { this.attributes.set(key, String(value)); }
    getAttribute(key) { return this.attributes.get(key) ?? null; }
    hasAttribute(key) { return this.attributes.has(key); }
    removeAttribute(key) { this.attributes.delete(key); }
    append(...nodes) { for (const node of nodes) { node.remove(); this.children.push(node); node.parentNode = this; } }
    insertBefore(node, before) { const index = before === null ? this.children.length : this.children.indexOf(before); assert.ok(index >= 0); node.remove(); this.children.splice(index, 0, node); node.parentNode = this; }
    remove() { if (this.parentNode) { const parent = this.parentNode; parent.children.splice(parent.children.indexOf(this), 1); this.parentNode = null; } }
    contains(node) { return this === node || this.children.some(child => child.contains(node)); }
    matches(selector) {
      if (selector === '[data-slot="sidebar.workspaces"]') return this.getAttribute('data-slot') === 'sidebar.workspaces';
      if (selector === '[role="tree"]') return this.getAttribute('role') === 'tree';
      if (selector === '[data-row-key^="session:"]') return this.getAttribute('data-row-key')?.startsWith('session:') ?? false;
      if (selector === `[${flag}]`) return this.hasAttribute(flag);
      throw new Error(`Unexpected selector: ${selector}`);
    }
    closest(selector) { for (let node = this; node; node = node.parentElement) if (node.matches(selector)) return node; return null; }
    querySelectorAll(selector) { return this.children.flatMap(child => [...(child.matches(selector) ? [child] : []), ...child.querySelectorAll(selector)]); }
    querySelector(selector) { return this.querySelectorAll(selector)[0] ?? null; }
    getBoundingClientRect() {
      layoutReads++;
      let left = this.left, top = this.top, width = this.clientWidth, height = this.clientHeight;
      if (this.className === 'dgp-mount') {
        const rect = this.parentNode.getBoundingClientRect();
        left = rect.left / zoom; top = rect.top / zoom - (this.getAttribute('data-placement') === 'inside' ? this.parentNode.scrollTop : 0);
      } else if (this.className === 'dgp-native-viewport') {
        const rect = this.parentNode.getBoundingClientRect(); left = rect.left / zoom; top = rect.top / zoom + 28;
      } else if (this.hasAttribute(flag)) {
        left = Number.parseFloat(this.style.getPropertyValue('--dgp-x'));
        top = Number.parseFloat(this.style.getPropertyValue('--dgp-y'));
        width = Number.parseFloat(this.style.getPropertyValue('--dgp-width'));
      }
      return { left: left * zoom, top: top * zoom, right: (left + width) * zoom, bottom: (top + height) * zoom, width: width * zoom, height: height * zoom };
    }
  }
  const html = new Element('html'), body = new Element('body'), root = new Element('native-region'), anchor = new Element('native-anchor'), tree = new Element('native-tree');
  root.height = 600; tree.height = 400; tree.top = 140;
  html.append(body); body.append(root); root.append(anchor); anchor.append(tree);
  anchor.setAttribute('data-slot', 'sidebar.workspaces'); tree.setAttribute('role', 'tree'); tree.overflowY = 'auto';
  const nativeRows = new Map(), created = [];
  function nativeRow(id, parent = tree) {
    const wrapper = new Element('native-hover-card'), row = new Element(`native-row-${id}`), title = new Element('native-title'), status = new Element('native-status');
    row.setAttribute('data-row-key', `session:${id}`); row.className = 'native-theme-row';
    row.onClick = () => { row.opened = true; }; row.onContextMenu = () => { row.menuOpened = true; };
    title.textContent = `Native ${id}`; status.textContent = 'Native ongoing';
    row.append(title, status); wrapper.append(row); parent.append(wrapper); nativeRows.set(id, { wrapper, row, title, status });
    return nativeRows.get(id);
  }
  nativeRow('a'); nativeRow('b');
  const observers = [], resizers = [], frames = new Map(), documentListeners = new Map(), windowListeners = new Map();
  let nextFrame = 0;
  const document = {
    body, createElement(name) { const node = new Element(name); created.push(node); return node; },
    querySelector(selector) { queries++; return html.querySelector(selector); },
    addEventListener(type, listener) { documentListeners.set(type, listener); },
    removeEventListener(type, listener) { if (documentListeners.get(type) === listener) documentListeners.delete(type); },
  };
  const window = {
    innerWidth: 1200, innerHeight: 900,
    __ModuleLoader__: { load(value) { window.module = value; } },
    getComputedStyle(node) { return { zoom: node === body ? String(zoom) : '1', overflowY: node.overflowY ?? 'visible', transform: node.transform ?? 'none', perspective: 'none', filter: 'none', backdropFilter: 'none', contain: 'none', willChange: 'auto', containerType: 'normal', contentVisibility: 'visible', marginTop: '0px', marginRight: '0px', marginBottom: '0px', marginLeft: '0px' }; },
    requestAnimationFrame(callback) { const id = ++nextFrame; frames.set(id, callback); return id; },
    cancelAnimationFrame(id) { frames.delete(id); },
    addEventListener(type, listener) { windowListeners.set(type, listener); },
    removeEventListener(type, listener) { if (windowListeners.get(type) === listener) windowListeners.delete(type); },
    MutationObserver: class {
      constructor(callback) { this.callback = callback; this.active = false; observers.push(this); }
      observe(target, options) { this.target = target; this.options = options; this.active = true; }
      disconnect() { this.active = false; }
    },
    ...(resizeObserver ? { ResizeObserver: class {
      constructor(callback) { this.callback = callback; this.targets = new Set(); this.initial = false; resizers.push(this); }
      observe(node) { if (!this.targets.has(node)) { this.targets.add(node); this.initial = true; } }
      unobserve(node) { this.targets.delete(node); }
      disconnect() { this.targets.clear(); this.initial = false; }
    } } : {}),
  };
  const flush = () => {
    let batches = 0;
    while (frames.size || resizers.some(observer => observer.initial)) {
      assert.ok(++batches < 10, 'geometry and ResizeObserver initial notifications must settle');
      const pending = [...frames.values()]; frames.clear(); pending.forEach(callback => callback());
      for (const observer of resizers) if (observer.initial) { observer.initial = false; observer.callback(); }
    }
  };
  const notify = records => observers.filter(observer => observer.active).forEach(observer => {
    const accepted = records.filter(record => record.type !== 'attributes' || observer.options.attributeFilter.includes(record.attributeName)).map(record => ({ type: 'childList', addedNodes: [], removedNodes: [], ...record }));
    if (accepted.length) observer.callback(accepted);
  });
  let config = { status: 'ready', writable: true, value: { density: 'compact', placement: 'above' } };
  const configListeners = new Set(), configWrites = [];
  const updateConfig = value => { config = { ...config, ...value }; configListeners.forEach(listener => listener()); };
  const form = {
    store: { getSnapshot: () => config, subscribe: listener => { configListeners.add(listener); return () => configListeners.delete(listener); } },
    getSnapshot() { return this.store.getSnapshot(); }, subscribe(listener) { return this.store.subscribe(listener); },
    async set(field, value) { assert.equal(this, form); configWrites.push([field, value]); updateConfig({ value: { ...config.value, [field]: value } }); return true; },
  };
  let scope, cursor = 0, visited, jobs = [];
  const scopes = new Map();
  const cleanup = value => value.effects.forEach(effect => effect?.cleanup?.());
  function component(type, props) {
    const key = type.name; visited.add(key);
    if (!scopes.has(key)) scopes.set(key, { values: [], effects: [] });
    const outer = scope, oldCursor = cursor; scope = scopes.get(key); cursor = 0;
    const result = type(props); scope = outer; cursor = oldCursor; return result;
  }
  const React = {
    createElement(type, props, ...children) { assert.ok(type, 'a private or missing primitive must not be rendered'); return typeof type === 'function' ? component(type, { ...props, children }) : { type, props: props ?? {}, children }; },
    useState(initial) { const owner = scope, index = cursor++; if (!(index in owner.values)) owner.values[index] = initial; return [owner.values[index], value => { stateWrites++; owner.values[index] = typeof value === 'function' ? value(owner.values[index]) : value; }]; },
    useRef(initial) { return scope.values[cursor++] ??= { current: initial }; },
    useEffect(setup, dependencies) { const owner = scope, index = cursor++, old = owner.effects[index]; if (!old || dependencies.some((value, i) => value !== old.dependencies[i])) { const effect = { dependencies }; owner.effects[index] = effect; jobs.push(() => { old?.cleanup?.(); effect.cleanup = setup(); }); } },
    useSyncExternalStore(subscribe, getSnapshot) { React.useEffect(() => subscribe(() => {}), [subscribe]); return getSnapshot(); },
  };
  runInNewContext(source, { window, document });
  const plugin = window.module.factory(name => {
    if (name === 'react') return React;
    assert.equal(name, '@deepseek-ai/dsh-client-ui-primitives');
    return { Button: 'button' };
  });
  const registrations = [], dictionaries = new Map(), disposers = [];
  plugin.apply({
    configForms: { get(id) { assert.equal(id, 'global-pins'); return form; } },
    effect(setup) { disposers.push(setup()); },
    locale: { register(ns, language, dictionary) { dictionaries.set(language, dictionary); return () => dictionaries.delete(language); } },
    slots: { inject(name, setup) { assert.ok(['shell.overlay', 'plugins.bundle.config'].includes(name)); return setup(); }, register(options, render) { registrations.push({ options, render }); } },
  });
  const data = { pinnedSessionIds: ['a', 'b', 'missing'], archivedSessionIds: [] };
  const props = { useWorkspaces: select => select(data), t: key => dictionaries.get('en')[key] };
  const render = (view = 'sidebar') => {
    visited = new Set();
    const rendered = view === 'both' ? registrations.map(entry => entry.render(props)) : registrations[view === 'settings' ? 1 : 0].render(props);
    for (const [key, value] of scopes) if (!visited.has(key)) { cleanup(value); scopes.delete(key); }
    const pending = jobs; jobs = []; pending.forEach(job => job());
    return rendered;
  };
  const byClass = (node, value) => node.className === value ? node : node.children.map(child => byClass(child, value)).find(Boolean);
  const unmount = () => { scopes.forEach(cleanup); scopes.clear(); };
  return {
    root, anchor, tree, nativeRows, nativeRow, created, data, form, configWrites, configListeners, updateConfig, render, flush, notify, observers, resizers, frames, documentListeners, windowListeners, Element,
    get host() { return byClass(body, 'dgp-mount'); }, get viewport() { return byClass(body, 'dgp-native-viewport'); },
    get layoutReads() { return layoutReads; }, get queries() { return queries; }, get stateWrites() { return stateWrites; },
    scroll(target) { documentListeners.get('scroll')?.({ target }); flush(); },
    resize() { windowListeners.get('resize')?.(); flush(); },
    wheel(target, deltaY) { let prevented = false; documentListeners.get('wheel')?.({ target, deltaY, deltaMode: 0, ctrlKey: false, preventDefault() { prevented = true; } }); flush(); return prevented; },
    unmount, dispose() { unmount(); disposers.forEach(dispose => dispose?.()); },
  };
}
function nodes(tree, predicate) {
  const result = [];
  const visit = node => { if (!node || typeof node !== 'object') return; if (Array.isArray(node)) return node.forEach(visit); if (predicate(node)) result.push(node); node.children?.forEach(visit); };
  visit(tree); return result;
}
const byClass = (tree, value) => nodes(tree, node => node.props.className === value);
const text = node => Array.isArray(node) ? node.map(text).join('') : node && typeof node === 'object' ? text(node.children ?? []) : typeof node === 'string' ? node : '';
const close = (actual, expected) => assert.ok(Math.abs(actual - expected) < 0.001, `${actual} must equal ${expected}`);

test('promotes only rendered native rows at normalized zoom coordinates, preserving parents, status nodes and original events', () => {
  const f = fixture(), a = f.nativeRows.get('a'), b = f.nativeRows.get('b');
  const click = a.row.onClick, menu = a.row.onContextMenu, originalChildren = [...a.row.children];
  const rendered = f.render(); f.flush();
  assert.equal(rendered.type, 'style');
  assert.deepEqual(f.root.children, [f.host, f.anchor]);
  assert.equal(a.row.parentNode, a.wrapper); assert.equal(b.row.parentNode, b.wrapper);
  assert.equal(a.wrapper.parentNode, f.tree);
  assert.deepEqual(a.row.children, originalChildren);
  assert.equal(a.row.onClick, click); assert.equal(a.row.onContextMenu, menu);
  a.row.onClick(); a.row.onContextMenu();
  assert.ok(a.row.opened && a.row.menuOpened);
  assert.ok(a.row.hasAttribute(flag) && b.row.hasAttribute(flag));
  assert.equal(f.host.children[0].children[1].textContent, '2');
  assert.equal(f.created.filter(node => node.getAttribute('data-row-key')).length, 0, 'missing sessions must not be fabricated or cloned');
  close(Number.parseFloat(a.row.style.getPropertyValue('--dgp-x')), 8);
  close(Number.parseFloat(a.row.style.getPropertyValue('--dgp-y')), 128);
  close(Number.parseFloat(b.row.style.getPropertyValue('--dgp-y')), 156);
  close(Number.parseFloat(a.row.style.getPropertyValue('--dgp-width')), 260);
  const reads = f.layoutReads, queries = f.queries;
  a.status.textContent = 'Native completed';
  f.notify([{ target: a.status, addedNodes: [new f.Element('native-completion-dot')] }, { target: a.row, type: 'attributes', attributeName: 'style' }]); f.flush();
  assert.equal(f.layoutReads, reads); assert.equal(f.queries, queries);
  assert.equal(a.row.children[1], a.status);
  for (let index = 0; index < 12; index++) { const id = `extra-${index}`; f.nativeRow(id); f.data.pinnedSessionIds = [...f.data.pinnedSessionIds, id]; }
  f.render(); f.flush();
  const view = f.viewport, before = a.row.getBoundingClientRect().top;
  assert.ok(f.wheel(a.row, 100));
  assert.ok(view.scrollTop > 0);
  assert.ok(a.row.getBoundingClientRect().top < before);
  assert.notEqual(a.row.style.getPropertyValue('--dgp-clip'), 'inset(0px 0px 0px 0px)');
  f.dispose();
});

test('rescans native row replacement and removal without parent moves, ignores streaming mutations, and restores owned flags and variables on teardown', () => {
  const f = fixture(), old = f.nativeRows.get('a');
  old.row.style.setProperty('--dgp-x', 'native-previous', 'important');
  f.render(); f.flush();
  const reads = f.layoutReads, queries = f.queries;
  f.notify([{ target: new f.Element('streaming-chat'), addedNodes: [new f.Element('text')] }]); f.flush();
  assert.equal(f.layoutReads, reads); assert.equal(f.queries, queries);
  old.wrapper.remove(); const replacement = f.nativeRow('a');
  f.notify([{ target: f.tree, addedNodes: [replacement.wrapper], removedNodes: [old.wrapper] }]); f.flush();
  assert.equal(old.row.hasAttribute(flag), false);
  assert.equal(old.row.style.getPropertyValue('--dgp-x'), 'native-previous');
  assert.equal(old.row.style.getPropertyPriority('--dgp-x'), 'important');
  assert.ok(replacement.row.hasAttribute(flag));
  assert.equal(replacement.row.parentNode, replacement.wrapper);
  f.data.pinnedSessionIds = ['b']; f.render(); f.flush();
  assert.equal(replacement.row.hasAttribute(flag), false);
  assert.equal(f.host.children[0].children[1].textContent, '1');
  const b = f.nativeRows.get('b'); b.wrapper.transform = 'matrix(1,0,0,1,0,0)';
  f.resize();
  assert.equal(b.row.hasAttribute(flag), false, 'containing-block ancestors keep native rows at their original position');
  assert.ok(f.host.hidden);
  b.wrapper.transform = 'none'; f.resize();
  assert.ok(b.row.hasAttribute(flag));
  f.data.pinnedSessionIds = []; f.render(); f.flush();
  assert.equal(f.host, undefined);
  assert.equal(b.row.hasAttribute(flag), false);
  assert.equal(b.row.style.getPropertyValue('--dgp-y'), '');
  f.dispose();
  assert.equal(f.frames.size, 0);
  assert.ok(f.observers.every(observer => !observer.active));
  assert.ok(f.resizers.every(observer => observer.targets.size === 0));
  assert.equal(f.documentListeners.size, 0); assert.equal(f.windowListeners.size, 0);
});

test('placement switches only owned spacers, inside scrolling clips native rows, and resize/remount cleanup cancels stale work', () => {
  const f = fixture({ currentZoom: false, resizeObserver: false }), a = f.nativeRows.get('a');
  f.render(); f.flush(); const above = f.host;
  f.updateConfig({ value: { density: 'default', placement: 'inside' } }); f.render(); f.flush();
  assert.equal(above.parentNode, null);
  assert.deepEqual(f.root.children, [f.anchor]);
  assert.equal(f.tree.firstChild, f.host);
  assert.equal(f.host.style.maxHeight, 'none');
  assert.equal(a.row.parentNode, a.wrapper);
  const before = a.row.getBoundingClientRect().top;
  f.tree.scrollTop = 70; f.scroll(f.tree);
  close(before - a.row.getBoundingClientRect().top, 70 * 1.15);
  assert.notEqual(a.row.style.getPropertyValue('--dgp-clip'), 'inset(0px 0px 0px 0px)');
  f.root.width = 159; f.resize(); assert.ok(f.host.hidden);
  f.root.width = 260; f.resize(); assert.equal(f.host.hidden, false);
  f.tree.removeAttribute('role');
  f.notify([{ target: f.anchor, removedNodes: [f.tree] }]); f.flush();
  assert.equal(f.host, undefined);
  assert.equal(a.row.hasAttribute(flag), false);
  const reads = f.layoutReads, queries = f.queries;
  f.notify([{ target: new f.Element('streaming-content') }]); f.flush();
  assert.equal(f.layoutReads, reads); assert.equal(f.queries, queries);
  f.updateConfig({ value: { placement: 'above' } }); f.render(); f.flush();
  assert.deepEqual(f.root.children, [f.host, f.anchor]);
  f.documentListeners.get('scroll')({ target: f.viewport });
  assert.ok(f.frames.size > 0);
  f.unmount();
  assert.equal(f.frames.size, 0);
  assert.equal(a.row.hasAttribute(flag), false);
  f.render(); f.flush();
  assert.ok(a.row.hasAttribute(flag));
  assert.equal(f.observers.filter(observer => observer.active).length, 1);
  f.dispose();
  assert.equal(f.documentListeners.size, 0); assert.equal(f.windowListeners.size, 0);
});

test('exposes only placement, preserves receiver-bound official config writes and legacy density, and retains rejected edits for retry', async () => {
  const f = fixture();
  let rendered = f.render('both'); f.flush();
  assert.equal(nodes(rendered, node => node.type === 'select').length, 1);
  assert.equal(nodes(rendered, node => node.type === 'select')[0].props.id, 'dgp-placement');
  const edit = value => nodes(f.render('both'), node => node.type === 'select')[0].props.onChange({ target: { value } });
  const save = () => byClass(f.render('both'), 'dgp-settings')[0].props.onSubmit({ preventDefault() {} });
  edit('inside');
  assert.equal(f.host.getAttribute('data-placement'), 'above');
  const stale = byClass(f.render('both'), 'dgp-settings')[0].props.onSubmit;
  f.updateConfig({ writable: false }); await stale({ preventDefault() {} });
  assert.deepEqual(f.configWrites, []);
  assert.ok(text(f.render('both')).includes('These settings are read-only.'));
  f.updateConfig({ writable: true });
  f.form.set = async () => false;
  await save(); rendered = f.render('both');
  assert.ok(text(nodes(rendered, node => node.props.role === 'alert')[0]).includes('Could not save settings'));
  assert.equal(nodes(rendered, node => node.type === 'select')[0].props.value, 'inside');
  f.form.set = async function (field, value) { assert.equal(this, f.form); f.configWrites.push([field, value]); f.updateConfig({ value: { ...this.getSnapshot().value, [field]: value } }); return true; };
  await save(); f.render('both'); f.flush();
  assert.deepEqual(f.configWrites, [['placement', 'inside']]);
  assert.equal(f.form.getSnapshot().value.density, 'compact');
  assert.equal(f.host.getAttribute('data-placement'), 'inside');
  edit('above');
  f.form.set = async () => { throw new Error('private transport details'); };
  await save(); rendered = f.render('both');
  assert.ok(text(nodes(rendered, node => node.props.role === 'alert')[0]).includes('Could not save settings'));
  assert.ok(!text(rendered).includes('private transport details'));
  let reject;
  f.form.set = () => new Promise((_, failure) => { reject = failure; });
  const pending = save(); f.unmount(); const before = f.stateWrites;
  reject(new Error('late failure')); await pending;
  assert.equal(f.stateWrites, before);
  assert.equal(f.configListeners.size, 0);
  f.dispose();
});
