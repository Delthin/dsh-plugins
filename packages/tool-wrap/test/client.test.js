import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('../client.js', import.meta.url), 'utf8');
const clone = value => JSON.parse(JSON.stringify(value));
const fixture = () => ({
  config: { version: 3, enabled: true, groups: ['browser-plugin', 'scoped-plugin'], tools: ['retained_tool'], exclude: ['retained_exclusion'], descriptions: { 'scoped-plugin': 'Retain hidden description', 'absent-plugin': 'Retain absent description' } },
  groups: [
    { id: 'browser-plugin', label: 'browser-plugin', description: 'Developer browser description', developerDescription: 'Developer browser description', descriptionSource: 'developer', tools: [{ name: 'open_page', description: 'Open a browser page' }, { name: 'read_page', description: 'Read page content' }] },
    { id: 'scoped-plugin', label: 'scoped-plugin', description: '会话专属工具；实际列表以调用会话为准', developerDescription: '', descriptionSource: 'custom', scopedOnly: true, tools: [] },
    { id: 'empty-plugin', label: 'empty-plugin', description: '', developerDescription: '', descriptionSource: 'missing', tools: [] },
  ], generation: { models: [{ provider: 'test-provider', model: 'default-model', label: 'test-provider / default-model' }] }, otherTools: [], warnings: [], coverage: { known: 2, unknown: 0 },
  estimate: { beforeChars: 2000, afterChars: 1000, savedChars: 1000, hiddenCount: 2 }, lastAssembly: null, discoveryCalls: 0,
});

async function mount(data = fixture(), language = 'zh', options = {}) {
  let factory, Component, cursor = 0, tree;
  const slots = [], dictionaries = {}, calls = [], effects = [], cleanups = [], timers = [];
  let didEffect = false;
  const state = (initial) => {
    const index = cursor++;
    if (!(index in slots)) slots[index] = typeof initial === 'function' ? initial() : initial;
    return [slots[index], value => { slots[index] = typeof value === 'function' ? value(slots[index]) : value; }];
  };
  const React = {
    Fragment: 'fragment',
    createElement: (type, props, ...children) => ({ type, props: props || {}, children: children.flat(Infinity).filter(child => child !== false && child != null) }),
    useState: state,
    useRef: initial => state(() => ({ current: initial }))[0],
    useId: () => 'test-instance',
    useSyncExternalStore() {},
    useEffect: effect => { if (!didEffect) effects.push(effect); },
  };
  vm.runInNewContext(source, {
    window: { __ModuleLoader__: { load: module => { factory = module.factory; } } },
    AbortController, clearTimeout,
    setTimeout: (fn, delay) => { timers.push({ fn, delay }); return setTimeout(fn, delay); },
    fetch: async (url, request) => {
      const call = { url, method: request.method, body: request.body && JSON.parse(request.body), signal: request.signal };
      calls.push(call);
      if (url.endsWith('/generate')) {
        const result = options.generate ? await options.generate(call) : { description: 'Generated browser description' };
        return { ok: !result.error, json: async () => clone(result) };
      }
      if (url.endsWith('/prompt-composition')) {
        const result = options.composition ? await options.composition(call, clone(data.promptComposition)) : { ...data.promptComposition, config: request.method === 'PUT' ? JSON.parse(request.body) : data.promptComposition.config };
        if (!result.error) data = { ...data, promptComposition: result };
        return { ok: !result.error, json: async () => clone(result) };
      }
      if (request.method === 'PUT') {
        const failure = options.toolsSave?.(call);
        if (failure) return { ok: false, json: async () => clone(failure) };
        data = { ...data, config: JSON.parse(request.body) };
      }
      return { ok: true, json: async () => clone(data) };
    },
  });
  factory(name => { assert.equal(name, 'react'); return React; }).apply({
    effect: fn => fn(),
    locale: {
      register: (_id, lang, dictionary) => { dictionaries[lang] = dictionary; },
      bind: () => key => dictionaries[language][key],
      resolveText: value => value,
    },
    slots: { inject: (_name, fn) => fn(), register: (definition, component) => { if (definition.name === 'settings.section') Component = component; } },
  });
  const render = () => { cursor = 0; tree = Component(); return tree; };
  const nodes = () => {
    const output = [];
    const visit = node => { if (typeof node === 'object') { output.push(node); node.children.forEach(visit); } };
    visit(tree); return output;
  };
  const text = node => typeof node === 'object' ? node.children.map(text).join(' ') : String(node);
  const find = predicate => { const node = nodes().find(predicate); assert.ok(node, 'Expected matching rendered node'); return node; };
  render(); didEffect = true;
  effects.forEach(effect => cleanups.push(effect()));
  await new Promise(resolve => setImmediate(resolve)); render();
  return { render, nodes, text: () => text(tree), find, calls, timers,
    unmount() { cleanups.forEach(cleanup => cleanup?.()); },
    expand() { find(node => node.props.className === 'td-expand').props.onClick(); render(); },
    editDescription(value) { find(node => node.type === 'textarea').props.onChange({ target: { value } }); render(); },
    chooseModel() { const select = find(node => node.type === 'select'); select.props.onChange({ target: { value: select.children[1].props.value } }); render(); },
    async generate() { const pending = find(node => node.type === 'button' && node.children.includes('生成简介')).props.onClick(); render(); await pending; render(); },
    search(value) { find(node => node.type === 'input' && node.props.type === 'search').props.onChange({ target: { value } }); render(); },
    async save() { await find(node => node.type === 'form').props.onSubmit({ preventDefault() {} }); render(); },
    async flush() { await new Promise(resolve => setImmediate(resolve)); render(); },
  };
}

const checkbox = node => node.type === 'input' && node.props.type === 'checkbox';
const withoutDeveloper = () => {
  const data = fixture();
  Object.assign(data.groups[0], { description: '', developerDescription: '', descriptionSource: 'missing' });
  return data;
};
const button = label => node => node.type === 'button' && node.children.includes(label);

test('empty and scoped-only rows are hidden without removing persisted selections', async () => {
  const ui = await mount();
  assert.equal(ui.nodes().filter(node => node.props.className === 'td-group').length, 1);
  assert.doesNotMatch(ui.text(), /scoped-plugin|empty-plugin|会话专属工具；/);
  assert.equal(ui.nodes().filter(checkbox).length, 2);
  ui.find(checkbox).props.onChange({ target: { checked: false } }); ui.render();
  await ui.save();
  const saved = ui.calls.find(call => call.method === 'PUT').body;
  assert.deepEqual(saved, { ...fixture().config, enabled: false });
});

test('tool search expands matching children and exclusion preserves hidden configuration', async () => {
  const ui = await mount();
  ui.search('read_page');
  const expand = ui.find(node => node.props.className === 'td-expand');
  assert.equal(expand.props['aria-expanded'], true);
  assert.equal(ui.nodes().filter(node => node.props.className === 'td-check td-tool').length, 1);
  const tool = ui.nodes().filter(checkbox).at(-1);
  tool.props.onChange({ target: { checked: false } }); ui.render();
  ui.search('');
  const groupCheck = ui.nodes().filter(checkbox)[1];
  const element = {}; groupCheck.props.ref(element); assert.equal(element.indeterminate, true);
  assert.equal(ui.find(node => node.props.className === 'td-count').children.join(''), '1 / 2');
  await ui.save();
  const saved = ui.calls.find(call => call.method === 'PUT').body;
  assert.deepEqual(saved.groups, fixture().config.groups);
  assert.deepEqual(saved.tools, fixture().config.tools);
  assert.deepEqual(saved.exclude, ['retained_exclusion', 'read_page']);
});

test('search empty state and refresh preserve draft; cancel restores saved state', async () => {
  const ui = await mount();
  ui.search('does-not-exist'); assert.match(ui.text(), /没有匹配的来源或工具/);
  ui.search('');
  ui.find(checkbox).props.onChange({ target: { checked: false } }); ui.render();
  ui.find(node => node.type === 'button' && node.children.includes('刷新')).props.onClick(); await ui.flush();
  assert.equal(ui.find(checkbox).props.checked, false);
  ui.find(node => node.type === 'button' && node.children.includes('取消更改')).props.onClick(); ui.render();
  assert.equal(ui.find(checkbox).props.checked, true);
  assert.equal(ui.find(node => node.type === 'button' && node.props.type === 'submit').props.disabled, true);
  assert.equal(ui.calls.filter(call => call.method === 'PUT').length, 0);
});

test('developer description is the default and custom override can be restored or cleared', async () => {
  const ui = await mount(); ui.expand();
  assert.equal(ui.find(node => node.type === 'textarea').props.value, 'Developer browser description');
  assert.equal(ui.find(node => node.type === 'textarea').props.maxLength, 2000);
  assert.match(ui.text(), /开发者说明/);
  assert.equal(ui.nodes().some(node => node.type === 'select'), false);
  ui.editDescription('Edited description');
  assert.match(ui.text(), /自定义简介/);
  await ui.save();
  assert.deepEqual(ui.calls.find(call => call.method === 'PUT').body.descriptions, { ...fixture().config.descriptions, 'browser-plugin': 'Edited description' });
  ui.find(button('恢复开发者说明')).props.onClick(); ui.render();
  assert.equal(ui.find(node => node.type === 'textarea').props.value, 'Developer browser description');
  await ui.save();
  assert.deepEqual(ui.calls.filter(call => call.method === 'PUT').at(-1).body.descriptions, fixture().config.descriptions);
  ui.editDescription('Another draft'); ui.editDescription('');
  assert.equal(ui.find(node => node.type === 'textarea').props.value, 'Developer browser description');
  assert.equal(ui.find(node => node.props.type === 'submit').props.disabled, true);
});

test('generation requires explicit model selection, fills only a draft, then saves manually', async () => {
  const ui = await mount(withoutDeveloper()); ui.expand();
  assert.match(ui.text(), /缺少简介/);
  assert.equal(ui.find(node => node.type === 'select').props.value, '');
  assert.equal(ui.find(button('生成简介')).props.disabled, true);
  await ui.generate();
  assert.equal(ui.calls.length, 1);
  ui.chooseModel();
  assert.match(ui.text(), /可能产生调用费用/);
  assert.equal(ui.calls.length, 1);
  await ui.generate();
  const call = ui.calls.find(call => call.method === 'POST');
  assert.equal(call.url, '/api/tool-discovery/generate');
  assert.deepEqual(call.body, { plugin: 'browser-plugin', model: { provider: 'test-provider', model: 'default-model' } });
  assert.equal(ui.find(node => node.type === 'textarea').props.value, 'Generated browser description');
  assert.match(ui.text(), /简介草稿已生成，可继续编辑；保存后生效/);
  assert.equal(ui.calls.some(call => call.method === 'PUT'), false);
  ui.editDescription('Edited generated description');
  await ui.save();
  assert.deepEqual(ui.calls.find(call => call.method === 'PUT').body.descriptions, { ...fixture().config.descriptions, 'browser-plugin': 'Edited generated description' });
});

test('generation without connected models stays disabled and explains configuration', async () => {
  const data = withoutDeveloper(); data.generation.models = [];
  const ui = await mount(data); ui.expand();
  assert.equal(ui.find(node => node.type === 'select').props.disabled, true);
  assert.equal(ui.find(button('生成简介')).props.disabled, true);
  assert.match(ui.text(), /请先配置并连接模型/);
  await ui.generate();
  assert.equal(ui.calls.length, 1);
});

test('failed generation preserves the original draft and never saves', async () => {
  const ui = await mount(withoutDeveloper(), 'zh', { generate: async () => ({ error: { code: 'MODEL_FAILED', message: 'Model unavailable' } }) });
  ui.expand(); ui.editDescription('Original draft'); ui.chooseModel();
  await ui.generate();
  assert.equal(ui.find(node => node.type === 'textarea').props.value, 'Original draft');
  assert.match(ui.text(), /MODEL_FAILED.*Model unavailable/);
  assert.equal(ui.calls.some(call => call.method === 'PUT'), false);
});

test('cancel aborts generation, ignores a late response and allows discarding generated drafts', async () => {
  let resolveGeneration;
  const ui = await mount(withoutDeveloper(), 'zh', { generate: () => new Promise(resolve => { resolveGeneration = resolve; }) });
  ui.expand(); ui.editDescription('Original draft'); ui.chooseModel();
  const pending = ui.generate();
  assert.equal(ui.find(button('保存设置')).props.disabled, true);
  ui.find(button('取消生成')).props.onClick(); ui.render();
  assert.equal(ui.calls.find(call => call.method === 'POST').signal.aborted, true);
  assert.equal(ui.find(node => node.type === 'textarea').props.value, 'Original draft');
  resolveGeneration({ description: 'Late generated draft' }); await pending;
  assert.equal(ui.find(node => node.type === 'textarea').props.value, 'Original draft');
  const next = ui.generate(); resolveGeneration({ description: 'Generated draft to discard' }); await next;
  assert.equal(ui.find(node => node.type === 'textarea').props.value, 'Generated draft to discard');
  ui.find(button('取消更改')).props.onClick(); ui.render();
  assert.equal(ui.find(node => node.type === 'textarea').props.value, '');
  assert.equal(ui.calls.some(call => call.method === 'PUT'), false);
});

test('cancel changes during generation resets all drafts and ignores the result', async () => {
  let resolveGeneration;
  const ui = await mount(withoutDeveloper(), 'zh', { generate: () => new Promise(resolve => { resolveGeneration = resolve; }) });
  ui.expand(); ui.chooseModel();
  const pending = ui.generate();
  assert.equal(ui.find(button('取消更改')).props.disabled, false);
  ui.find(button('取消更改')).props.onClick(); ui.render();
  resolveGeneration({ description: 'Discarded result' }); await pending;
  assert.equal(ui.find(node => node.type === 'textarea').props.value, '');
  assert.equal(ui.find(button('保存设置')).props.disabled, true);
});

test('generation uses a 120-second timeout and preserves drafts on timeout', async () => {
  const ui = await mount(withoutDeveloper(), 'zh', { generate: call => new Promise((_resolve, reject) => call.signal.addEventListener('abort', () => { const error = new Error('Aborted'); error.name = 'AbortError'; reject(error); })) });
  ui.expand(); ui.editDescription('Keep on timeout'); ui.chooseModel();
  const pending = ui.generate();
  assert.equal(ui.timers.at(-1).delay, 120000);
  ui.timers.at(-1).fn(); await pending;
  assert.match(ui.text(), /请求超时/);
  assert.equal(ui.find(node => node.type === 'textarea').props.value, 'Keep on timeout');
  assert.equal(ui.calls.some(call => call.method === 'PUT'), false);
});

test('invalid generated descriptions preserve drafts and cannot be saved implicitly', async () => {
  for (const description of ['', 'x'.repeat(2001)]) {
    const ui = await mount(withoutDeveloper(), 'zh', { generate: async () => ({ description }) });
    ui.expand(); ui.editDescription('Keep valid draft'); ui.chooseModel();
    await ui.generate();
    assert.equal(ui.find(node => node.type === 'textarea').props.value, 'Keep valid draft');
    assert.match(ui.text(), /宿主返回了无效响应/);
    assert.equal(ui.calls.some(call => call.method === 'PUT'), false);
  }
});

test('unmount aborts generation and ignores a late result', async () => {
  let resolveGeneration;
  const ui = await mount(withoutDeveloper(), 'zh', { generate: () => new Promise(resolve => { resolveGeneration = resolve; }) });
  ui.expand(); ui.editDescription('Original draft'); ui.chooseModel();
  const pending = ui.generate(); ui.unmount();
  assert.equal(ui.calls.find(call => call.method === 'POST').signal.aborted, true);
  resolveGeneration({ description: 'Ignored after unmount' }); await pending;
  assert.equal(ui.find(node => node.type === 'textarea').props.value, 'Original draft');
  assert.equal(ui.calls.some(call => call.method === 'PUT'), false);
});

test('version 2 requires a service restart and never renders the new form', async () => {
  const data = fixture(); data.config.version = 2;
  const ui = await mount(data);
  assert.match(ui.text(), /更新需重启服务/);
  assert.equal(ui.nodes().some(node => node.type === 'form' || node.type === 'textarea'), false);
});

const ownerId = owner => 'owner:' + encodeURIComponent(owner);
const sourceEntry = (id, label, owner, kind = 'section', extra = {}) => ({ id, label, owner, kind, groupId: ownerId(owner || '@host/unknown'), groupLabel: owner || 'Unknown origin', defaultRole: kind === 'context' ? 'user' : 'system', roles: ['inherit', 'system', 'user'], deliveryModes: ['inherit', 'always', 'pack'], ...extra });
const sourceGroup = (owner, label) => sourceEntry(ownerId(owner), label, owner, 'group');
const withComposition = () => ({ ...fixture(), promptComposition: {
  config: { version: 1, enabled: true, order: ['absent:kept'], rules: { 'absent:kept': { role: 'user', delivery: 'always' }, [ownerId('browser-plugin')]: { role: 'system', delivery: 'inherit' } } },
  capabilities: { admission: true, roles: ['inherit', 'system', 'user'], developer: false, delivery: true, structuredInstructions: true },
  sources: [
    sourceGroup('@deepseek-ai/dsh-system-prompt', 'DSH基础'), sourceEntry('base:identity', 'Identity', '@deepseek-ai/dsh-system-prompt'),
    sourceEntry('instructions:global', 'Global AGENTS', '@host/instructions', 'group', { groupId: 'instructions:global', deliveryModes: ['inherit', 'always'] }),
    sourceEntry('instructions:project', 'Project AGENTS', '@host/instructions', 'group', { groupId: 'instructions:project', deliveryModes: ['inherit', 'always'] }),
    sourceGroup('browser-plugin', 'Browser rules'), sourceEntry('opaque:a', 'Important note', 'browser-plugin'), sourceEntry('opaque:b', 'Runtime facts', 'browser-plugin', 'context'),
    sourceGroup('scoped-plugin', 'Prompt only'), sourceEntry('solo:note', 'Prompt-only note', 'scoped-plugin'),
    sourceEntry('context:browser-plugin-looking', 'Unknown origin', null, 'context', { roles: ['inherit'], deliveryModes: ['inherit'], reason: 'explicit-source-adapter-required' }),
    sourceGroup('@delthin/dsh-tool-wrap', 'unwrap directory'), sourceEntry('unwrap:directory', 'unwrap directory entry', '@delthin/dsh-tool-wrap', 'section', { deliveryModes: ['inherit', 'always'], reason: 'entrypoint-always' }),
    sourceGroup('empty-plugin', 'Empty metadata'),
    sourceEntry('absent:kept', 'Absent saved source', null, 'unavailable'),
  ],
} });
const select = (ui, label, value) => { ui.find(node => node.type === 'select' && node.props['aria-label'] === label).props.onChange({ target: { value } }); ui.render(); };
const click = (ui, label) => { ui.find(node => node.type === 'button' && node.props['aria-label'] === label).props.onClick(); ui.render(); };
const descendants = node => [node, ...node.children.filter(child => typeof child === 'object').flatMap(descendants)];

test('unified source rows use exact owners, retain absent rules and support group/source overrides and ordering', async () => {
  const data = withComposition(), ui = await mount(data);
  assert.equal(ui.nodes().filter(node => node.type === 'form').length, 1);
  for (const label of ['DSH基础', '全局 AGENTS', '项目 AGENTS', 'Prompt only', 'unwrap directory', '其他注入来源']) assert.ok(ui.text().includes(label), label);
  assert.doesNotMatch(ui.text(), /Empty metadata|Absent saved source/);
  const row = id => ui.find(node => node.props['data-source-id'] === id);
  assert.equal(descendants(row(ownerId('browser-plugin'))).filter(checkbox).length, 1);
  assert.equal(descendants(row(ownerId('scoped-plugin'))).filter(checkbox).length, 0);
  assert.equal(descendants(row(ownerId('@host/unknown'))).filter(checkbox).length, 0, 'a matching-looking source name cannot claim plugin tools');
  click(ui, '展开来源与工具 · Browser rules');
  select(ui, '加载方式 · Runtime facts', 'pack');
  click(ui, '上移 · Runtime facts');
  click(ui, '上移 · Browser rules');
  ui.find(button('刷新')).props.onClick(); await ui.flush();
  assert.equal(ui.find(node => node.props['aria-label'] === '加载方式 · Runtime facts').props.value, 'pack');
  await ui.save();
  const saved = ui.calls.find(call => call.url.endsWith('/prompt-composition')).body;
  assert.deepEqual(saved.rules['opaque:b'], { role: 'inherit', delivery: 'pack' });
  assert.deepEqual(saved.rules[ownerId('browser-plugin')], { role: 'system', delivery: 'inherit' });
  assert.deepEqual(saved.rules['absent:kept'], data.promptComposition.config.rules['absent:kept']);
  assert.equal(saved.order[0], 'absent:kept');
  assert.ok(saved.order.indexOf('opaque:b') < saved.order.indexOf('opaque:a'));
  assert.ok(saved.order.indexOf(ownerId('browser-plugin')) < saved.order.indexOf('instructions:project'));
  assert.equal(ui.calls.filter(call => call.method === 'PUT').length, 1, 'composition-only changes do not rewrite tool selections');
  ui.find(button('恢复提示词默认')).props.onClick(); ui.render();
  assert.equal(ui.calls.filter(call => call.method === 'PUT').length, 1, 'defaults are only a draft');
  ui.find(button('取消更改')).props.onClick(); ui.render();
  assert.equal(ui.find(button('保存设置')).props.disabled, true);
});

test('prompt-only plugin keeps its editable description but cannot spend a generation call without tool data', async () => {
  const data = withComposition();
  data.groups[0] = { ...data.groups[0], tools: [], developerDescription: '', description: '', descriptionSource: 'missing' };
  const ui = await mount(data);
  click(ui, '展开来源与工具 · Browser rules');
  const model = ui.find(node => node.type === 'select' && node.props['aria-label'] === '生成简介所用模型');
  assert.equal(model.props.disabled, true);
  assert.equal(ui.find(button('生成简介')).props.disabled, true);
  assert.match(ui.text(), /当前没有可用于生成简介的工具/);
  ui.editDescription('Authored prompt guidance summary');
  await ui.save();
  assert.equal(ui.calls.some(call => call.method === 'POST'), false);
  assert.equal(ui.calls.find(call => call.url === '/api/tool-discovery' && call.method === 'PUT').body.descriptions['browser-plugin'], 'Authored prompt guidance summary');
});

test('host/source capabilities gate role and loading choices without hiding sources or inventing developer support', async () => {
  const supported = await mount(withComposition(), 'en');
  assert.match(supported.text(), /Tools and prompts/);
  assert.equal(supported.nodes().some(node => node.type === 'option' && node.props.value === 'developer'), false);
  click(supported, 'Expand sources and tools · unwrap directory');
  const directory = supported.find(node => node.type === 'select' && node.props['aria-label'] === 'Loading · unwrap directory entry');
  assert.deepEqual(directory.children.map(option => option.props.value), ['inherit', 'always']);
  const data = withComposition();
  data.promptComposition.config.enabled = false;
  data.promptComposition.capabilities = { admission: false, roles: ['inherit'], developer: false, reason: 'host-adapter-required' };
  data.promptComposition.sources.forEach(source => { source.roles = ['inherit']; source.deliveryModes = ['inherit']; });
  const unavailable = await mount(data);
  assert.match(unavailable.text(), /宿主未启用编排适配/);
  assert.match(unavailable.text(), /DSH基础|Global AGENTS|Prompt only/);
  assert.equal(unavailable.nodes().filter(node => node.type === 'select').every(node => node.props.disabled), true);
  assert.equal(unavailable.find(node => checkbox(node) && node.props.checked === false).props.disabled, true);
  assert.match(unavailable.text(), /已存设置当前不可用/);
});

test('partial saves update only successful baselines; retry and cancel retain the correct remaining draft', async () => {
  for (const failure of ['tools', 'composition']) {
    let fail = true;
    const ui = await mount(withComposition(), 'zh', {
      toolsSave: () => failure === 'tools' && fail ? { error: { message: 'Tools write failed' } } : null,
      composition: async (call, data) => failure === 'composition' && fail ? { error: { message: 'Prompt write failed' } } : { ...data, config: call.body },
    });
    ui.find(checkbox).props.onChange({ target: { checked: false } }); ui.render();
    select(ui, '消息角色 · Browser rules', 'user');
    await ui.save();
    assert.match(ui.text(), /部分设置已保存，失败部分仍保留草稿/);
    assert.equal(ui.find(button('保存设置')).props.disabled, false);
    const first = ui.calls.filter(call => call.method === 'PUT'); assert.equal(first.length, 2);
    if (failure === 'composition') {
      ui.find(button('取消更改')).props.onClick(); ui.render();
      assert.equal(ui.find(checkbox).props.checked, false, 'successfully saved tools remain the cancel baseline');
      assert.equal(ui.find(node => node.props['aria-label'] === '消息角色 · Browser rules').props.value, 'system');
      assert.equal(ui.find(button('保存设置')).props.disabled, true);
      select(ui, '消息角色 · Browser rules', 'user');
    }
    fail = false; await ui.save();
    const last = ui.calls.filter(call => call.method === 'PUT').at(-1);
    assert.equal(last.url, failure === 'tools' ? '/api/tool-discovery' : '/api/tool-discovery/prompt-composition');
    assert.equal(ui.calls.filter(call => call.method === 'PUT').length, 3, 'retry sends only the still-dirty endpoint');
    assert.equal(ui.find(button('保存设置')).props.disabled, true);
  }
});
