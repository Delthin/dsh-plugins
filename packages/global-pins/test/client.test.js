import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { runInNewContext } from 'node:vm';

const source = await readFile(new URL('../client.js', import.meta.url), 'utf8');

// A small DOM/hook harness exercises the actual registered component and effects.
// Browser layout/paint is intentionally left to the host integration check.
function fixture({ resizeObserver = true } = {}) {
  let writes = 0, layoutReads = 0, queries = 0;
  class Element {
    constructor(name) { this.name = name; this.children = []; this.style = {}; this.parentNode = null; this.width = 260; this.height = 600; }
    get parentElement() { return this.parentNode; }
    get isConnected() { return body.contains(this); }
    get nextSibling() { return this.parentNode?.children[this.parentNode.children.indexOf(this) + 1] ?? null; }
    insertBefore(node, before) {
      writes++;
      assert.ok(writes < 30, 'DOM observer must settle rather than reinserting forever');
      node.remove();
      const index = this.children.indexOf(before);
      assert.notEqual(index, -1);
      this.children.splice(index, 0, node); node.parentNode = this;
    }
    append(node) { node.remove(); this.children.push(node); node.parentNode = this; }
    remove() { if (!this.parentNode) return; const parent = this.parentNode; parent.children.splice(parent.children.indexOf(this), 1); this.parentNode = null; }
    contains(node) { return this === node || this.children.some(child => child.contains(node)); }
    getBoundingClientRect() { layoutReads++; return { width: this.width, height: this.height }; }
  }
  const body = new Element('body'), parent = new Element('regionArea'), anchor = new Element('native-workspaces');
  body.append(parent); parent.append(anchor);
  const observers = [], resizers = [], listeners = new Map();
  const window = {
    __ModuleLoader__: { load(value) { window.module = value; } },
    MutationObserver: class {
      constructor(callback) { this.callback = callback; this.active = false; observers.push(this); }
      observe(target, options) { this.target = target; this.options = options; this.active = true; }
      disconnect() { this.active = false; }
    },
    ...(resizeObserver ? { ResizeObserver: class {
      constructor(callback) { this.callback = callback; this.targets = []; resizers.push(this); }
      observe(target) { this.targets.push(target); }
      disconnect() { this.targets = []; }
    } } : {}),
    addEventListener(type, listener) { listeners.set(type, listener); },
    removeEventListener(type, listener) { if (listeners.get(type) === listener) listeners.delete(type); },
  };
  const document = { body, createElement: name => new Element(name), querySelector: selector => {
    queries++;
    assert.equal(selector, '[data-slot="sidebar.workspaces"]');
    return body.contains(currentAnchor) ? currentAnchor : null;
  } };
  let currentAnchor = anchor;
  const scopes = new Map();
  let currentScope, cursor = 0, visited, jobs = [], stateWrites = 0;
  const scopeCleanup = scope => scope.effects.forEach(effect => effect?.cleanup?.());
  function component(type, props) {
    const key = `${type.name}:${props.key ?? ''}`;
    visited.add(key);
    if (!scopes.has(key)) scopes.set(key, { values: [], effects: [] });
    const outer = currentScope, outerCursor = cursor;
    currentScope = scopes.get(key); cursor = 0;
    const result = type(props);
    currentScope = outer; cursor = outerCursor;
    return result;
  }
  const React = {
    Fragment: 'fragment',
    createElement(type, props, ...children) { return typeof type === 'function' ? component(type, { ...props, children }) : { type, props: props ?? {}, children }; },
    useState(initial) {
      const scope = currentScope, index = cursor++;
      if (!(index in scope.values)) scope.values[index] = typeof initial === 'function' ? initial() : initial;
      return [scope.values[index], value => { stateWrites++; scope.values[index] = typeof value === 'function' ? value(scope.values[index]) : value; }];
    },
    useRef(value) { const index = cursor++; return currentScope.values[index] ??= { current: value }; },
    useEffect(setup, dependencies) {
      const scope = currentScope, index = cursor++, old = scope.effects[index];
      if (!old || dependencies.some((value, i) => value !== old.dependencies[i])) {
        const effect = { dependencies };
        scope.effects[index] = effect;
        jobs.push(() => { old?.cleanup?.(); effect.cleanup = setup(); });
      }
    },
  };
  runInNewContext(source, { window, document });
  assert.equal(window.module.id, '@delthin/dsh-global-pins');
  const plugin = window.module.factory(name => {
    if (name === 'react') return React;
    assert.equal(name, 'react-dom');
    return { createPortal: (tree, host) => ({ type: 'portal', props: { host }, children: [tree] }) };
  });
  const registrations = [], dictionaries = new Map(), calls = [];
  let language = 'en';
  const uiWorkspace = { openSession: id => { calls.push(['open', id]); }, unpinSession: async id => { calls.push(['unpin', id]); } };
  const localeCleanups = [];
  plugin.apply({
    effect(fn) { localeCleanups.push(fn()); }, uiWorkspace,
    locale: { register(ns, lang, dictionary) { assert.equal(ns, 'delthin.globalPins'); dictionaries.set(lang, dictionary); return () => dictionaries.delete(lang); } },
    slots: {
      inject(name, fn) { assert.equal(name, 'shell.overlay'); return fn(); },
      register(options, render) { registrations.push({ options, render }); },
    },
  });
  assert.equal(registrations.length, 1);
  assert.equal(registrations[0].options.name, 'shell.overlay');
  const data = { pinnedSessionIds: ['a'], archivedSessionIds: [], items: [{ title: 'Workspace A', sessionIds: ['a'] }] };
  const sessions = { byId: { a: { id: 'a', displayTitle: 'First session', retainedBy: { mainView: 1 } } } };
  let panel = null, allowed = true;
  const props = {
    useWorkspaces: select => select(data), useSessions: select => select(sessions), usePanelInfo: select => select({ activePanelId: panel }),
    useSessionAccess(id, action) { assert.ok(sessions.byId[id]); assert.equal(action, 'workspace/unpinSession'); return allowed; },
    t: key => dictionaries.get(language)[key],
  };
  const render = () => {
    visited = new Set();
    const tree = registrations[0].render(props);
    for (const [key, scope] of scopes) if (!visited.has(key)) { scopeCleanup(scope); scopes.delete(key); }
    const pending = jobs; jobs = []; pending.forEach(job => job());
    return tree;
  };
  const unmount = () => { scopes.forEach(scopeCleanup); scopes.clear(); };
  const notify = records => observers.filter(observer => observer.active).forEach(observer => observer.callback(records));
  return {
    data, sessions, calls, uiWorkspace, body, parent, anchor, window, observers, resizers, listeners, Element, render, unmount, notify,
    settle() { render(); return render(); },
    set panel(value) { panel = value; }, set allowed(value) { allowed = value; }, set language(value) { language = value; },
    replaceAnchor(next) { currentAnchor = next; }, get writes() { return writes; }, get stateWrites() { return stateWrites; },
    get layoutReads() { return layoutReads; }, get queries() { return queries; },
    dispose() { unmount(); localeCleanups.forEach(cleanup => cleanup()); },
  };
}
function nodes(tree, predicate) {
  const found = [];
  const visit = node => {
    if (!node || typeof node !== 'object') return;
    if (Array.isArray(node)) return node.forEach(visit);
    if (predicate(node)) found.push(node);
    node.children?.forEach(visit);
  };
  visit(tree); return found;
}
const byClass = (tree, value) => nodes(tree, node => node.props.className === value);
const text = node => Array.isArray(node) ? node.map(text).join('') : node && typeof node === 'object' ? text(node.children ?? []) : typeof node === 'string' || typeof node === 'number' ? String(node) : '';

test('projects native pins in source order, excludes missing/archived IDs, and follows titles, membership and active panel changes', () => {
  const f = fixture();
  f.data.pinnedSessionIds = ['b', 'gone', 'a', 'b', 'archived'];
  f.data.archivedSessionIds = ['archived'];
  f.sessions.byId.b = { id: 'b', displayTitle: '', retainedBy: { controllerOperation: 1 } };
  f.sessions.byId.archived = { id: 'archived', displayTitle: 'Archived', retainedBy: {} };
  let tree = f.settle();
  assert.deepEqual(byClass(tree, 'dgp-title').map(text), ['Untitled conversation', 'First session']);
  assert.deepEqual(byClass(tree, 'dgp-workspace').map(text), ['Ungrouped', 'Workspace A']);
  assert.equal(text(byClass(tree, 'dgp-count')[0]), '2');
  assert.deepEqual(byClass(tree, 'dgp-row').map(row => row.props['data-active']), [false, true]);
  f.panel = 'settings';
  f.sessions.byId.a = { ...f.sessions.byId.a, displayTitle: 'Renamed live' };
  f.data.items = [{ title: 'Moved workspace', sessionIds: ['b', 'a'] }];
  tree = f.render();
  assert.ok(byClass(tree, 'dgp-row').every(row => !row.props['data-active']));
  assert.equal(text(byClass(tree, 'dgp-title')[1]), 'Renamed live');
  assert.deepEqual(byClass(tree, 'dgp-workspace').map(text), ['Moved workspace', 'Moved workspace']);
  f.data.pinnedSessionIds = [];
  assert.equal(f.render(), null, 'empty native state must remove the whole region');
  f.dispose();
});

test('delegates keyboard-capable controls to native actions, guards unpin permission and duplicate pending operations, and reports failures', async () => {
  const f = fixture();
  let tree = f.settle();
  const open = byClass(tree, 'dgp-open')[0];
  assert.equal(open.type, 'button');
  assert.equal(open.props['aria-current'], 'page');
  await open.props.onClick();
  assert.deepEqual(f.calls, [['open', 'a']]);
  f.allowed = false;
  assert.equal(byClass(f.render(), 'dgp-unpin').length, 0);
  f.allowed = true;
  let reject;
  f.uiWorkspace.unpinSession = id => { f.calls.push(['unpin', id]); return new Promise((_, failure) => { reject = failure; }); };
  const unpin = byClass(f.render(), 'dgp-unpin')[0];
  const request = unpin.props.onClick();
  await unpin.props.onClick();
  assert.deepEqual(f.calls, [['open', 'a'], ['unpin', 'a']]);
  tree = f.render();
  assert.ok(byClass(tree, 'dgp-unpin')[0].props.disabled);
  assert.deepEqual(f.data.pinnedSessionIds, ['a'], 'pending requests do not maintain a second pin state');
  reject(new Error('private detail'));
  await request;
  tree = f.render();
  const alert = nodes(tree, node => node.props.role === 'alert')[0];
  assert.ok(text(alert).includes('Could not unpin. Please try again.'));
  assert.ok(!text(alert).includes('private detail'));
  nodes(alert, node => node.type === 'button')[0].props.onClick();
  f.uiWorkspace.openSession = () => { throw new Error('open refused'); };
  await byClass(f.render(), 'dgp-open')[0].props.onClick();
  assert.ok(text(nodes(f.render(), node => node.props.role === 'alert')[0]).includes('Could not open'));
  // A pending rejection after teardown must neither update React nor add an alert.
  const pending = byClass(f.render(), 'dgp-unpin')[0].props.onClick();
  f.unmount();
  const before = f.stateWrites;
  reject(new Error('late failure'));
  await pending;
  assert.equal(f.stateWrites, before);
  f.dispose();
});

test('portal insertion settles without self-triggering writes and follows replacement or missing anchors without touching the native browser', () => {
  const f = fixture();
  f.anchor.remove();
  assert.equal(f.settle(), null, 'the slot may not have mounted when the overlay starts');
  f.parent.append(f.anchor);
  f.notify([{ target: f.parent }]);
  let tree = f.render();
  const host = tree.props.host;
  assert.deepEqual(f.parent.children, [host, f.anchor]);
  const writes = f.writes, layoutReads = f.layoutReads, queries = f.queries;
  f.notify([{ target: f.parent }]);
  f.notify([{ target: host }]);
  const streamingContent = new f.Element('streaming-chat');
  f.body.append(streamingContent);
  f.notify([{ target: f.body }]);
  f.notify([{ target: streamingContent }]);
  assert.equal(f.writes, writes);
  assert.equal(f.layoutReads, layoutReads, 'unrelated body changes must not synchronously read sidebar geometry');
  assert.equal(f.queries, queries, 'a connected, correctly placed anchor needs no new document query');
  assert.equal(f.parent.children[1], f.anchor);
  f.parent.append(host);
  f.notify([{ target: f.parent }]);
  assert.deepEqual(f.parent.children, [host, f.anchor], 'anchor reordering still restores the plugin sibling');
  const replacementParent = new f.Element('replacement-region'), replacement = new f.Element('replacement-native');
  f.body.append(replacementParent); replacementParent.append(replacement); f.parent.remove(); f.replaceAnchor(replacement);
  f.notify([{ target: f.body }]);
  assert.deepEqual(replacementParent.children, [host, replacement]);
  assert.deepEqual(f.resizers[0].targets, [replacementParent]);
  replacement.remove(); f.notify([{ target: replacementParent }]);
  assert.equal(f.render(), null);
  assert.equal(host.parentNode, null);
  replacementParent.append(replacement); f.notify([{ target: replacementParent }]);
  tree = f.render();
  assert.equal(tree.props.host, host);
  f.dispose();
  assert.deepEqual(replacementParent.children, [replacement]);
  assert.ok(f.observers.every(observer => !observer.active));
  assert.ok(f.resizers.every(observer => observer.targets.length === 0));
  assert.equal(f.listeners.size, 0);
});

test('resize hides collapsed sidebars, bounds pin height, and cleans up safely across remounts including the window-resize fallback', () => {
  for (const resizeObserver of [true, false]) {
    const f = fixture({ resizeObserver });
    let host = f.settle().props.host;
    assert.equal(host.style.maxHeight, '240px');
    const resize = () => resizeObserver ? f.resizers[0].callback() : f.listeners.get('resize')();
    f.parent.width = 159; resize();
    assert.equal(host.style.display, 'none');
    f.parent.width = 160; f.parent.height = 300; resize();
    assert.equal(host.style.display, '');
    assert.equal(host.style.maxHeight, '120px', 'the native workspace browser keeps most of the available height');
    f.unmount();
    assert.deepEqual(f.parent.children, [f.anchor]);
    host = f.settle().props.host;
    assert.deepEqual(f.parent.children, [host, f.anchor]);
    assert.equal(f.observers.filter(observer => observer.active).length, 1);
    f.dispose();
    assert.deepEqual(f.parent.children, [f.anchor]);
    assert.equal(f.listeners.size, 0);
  }
});
