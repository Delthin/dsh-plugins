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
  const text = node => typeof node === 'object' ? node.type === 'style' ? '' : node.children.map(text).join(' ') : String(node);
  const find = predicate => { const node = nodes().find(predicate); assert.ok(node, 'Expected matching rendered node'); return node; };
  render(); didEffect = true;
  effects.forEach(effect => cleanups.push(effect()));
  await new Promise(resolve => setImmediate(resolve)); render();
  return { render, nodes, text: () => text(tree), find, calls, timers,
    unmount() { cleanups.forEach(cleanup => cleanup?.()); },
    selectPlugin(label = 'browser-plugin') { find(node => node.type === 'button' && node.props['aria-label'] === '查看提示词与工具 · ' + label).props.onClick(); render(); },
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
  assert.equal(ui.find(node => node.props['data-list-view'] === 'tools').props['aria-selected'], true);
  assert.equal(ui.nodes().some(node => node.props['data-list-view'] === 'injected'), false);
  assert.equal(ui.nodes().filter(node => node.type === 'li' && node.props.className?.split(' ').includes('td-group')).length, 1);
  assert.doesNotMatch(ui.text(), /scoped-plugin|empty-plugin|会话专属工具；/);
  assert.equal(ui.nodes().filter(node => checkbox(node) && node.props.role === 'switch').length, 1);
  assert.equal(ui.nodes().filter(node => node.type === 'button' && node.props['aria-label'] === '移出按需工具包 · browser-plugin').length, 2);
  assert.equal(ui.nodes().filter(node => node.props.className === 'td-check td-tool').length, 2);
  ui.find(checkbox).props.onChange({ target: { checked: false } }); ui.render();
  await ui.save();
  const saved = ui.calls.find(call => call.method === 'PUT').body;
  assert.deepEqual(saved, { ...fixture().config, enabled: false });
});

test('tool search selects the matching plugin with all tools and exclusion preserves hidden configuration', async () => {
  const ui = await mount();
  ui.search('read_page');
  const selected = ui.find(node => node.type === 'button' && node.props['aria-label'] === '查看提示词与工具 · browser-plugin');
  assert.equal(selected.props['aria-current'], 'true');
  assert.equal(ui.nodes().filter(node => node.props.className === 'td-check td-tool').length, 2, 'search must not trim the selected plugin detail');
  const tool = descendants(ui.find(node => node.props.className === 'td-check td-tool' && descendants(node).some(child => child.type === 'code' && child.children.includes('read_page')))).find(checkbox);
  tool.props.onChange({ target: { checked: false } }); ui.render();
  ui.search('');
  assert.ok(ui.find(node => node.props.className === 'td-count' && node.props['aria-label'] === '已选 1 / 2'));
  await ui.save();
  const saved = ui.calls.find(call => call.method === 'PUT').body;
  assert.deepEqual(saved.groups, fixture().config.groups);
  assert.deepEqual(saved.tools, fixture().config.tools);
  assert.deepEqual(saved.exclude, ['retained_exclusion', 'read_page']);
  click(ui, '移出按需工具包 · browser-plugin');
  await ui.save();
  const movedOut = ui.calls.filter(call => call.method === 'PUT').at(-1).body;
  assert.deepEqual(movedOut, { ...fixture().config, groups: ['scoped-plugin'] }, 'moving a pack out clears its partial selections and preserves unrelated configuration');
  click(ui, '移入按需工具包 · browser-plugin');
  await ui.save();
  const movedIn = ui.calls.filter(call => call.method === 'PUT').at(-1).body;
  assert.deepEqual(movedIn, { ...fixture().config, groups: ['scoped-plugin', 'browser-plugin'] }, 'moving in selects the whole pack, including future tools, rather than individual current tool names');
});

test('search empty state and refresh preserve draft; cancel restores saved state', async () => {
  const ui = await mount();
  ui.search('does-not-exist'); assert.match(ui.text(), /没有匹配的插件、工具或提示词/);
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
  const ui = await mount(); ui.selectPlugin();
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
  const ui = await mount(withoutDeveloper()); ui.selectPlugin();
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
  const ui = await mount(data); ui.selectPlugin();
  assert.equal(ui.find(node => node.type === 'select').props.disabled, true);
  assert.equal(ui.find(button('生成简介')).props.disabled, true);
  assert.match(ui.text(), /请先配置并连接模型/);
  await ui.generate();
  assert.equal(ui.calls.length, 1);
});

test('failed generation preserves the original draft and never saves', async () => {
  const ui = await mount(withoutDeveloper(), 'zh', { generate: async () => ({ error: { code: 'MODEL_FAILED', message: 'Model unavailable' } }) });
  ui.selectPlugin(); ui.editDescription('Original draft'); ui.chooseModel();
  await ui.generate();
  assert.equal(ui.find(node => node.type === 'textarea').props.value, 'Original draft');
  assert.match(ui.text(), /MODEL_FAILED.*Model unavailable/);
  assert.equal(ui.calls.some(call => call.method === 'PUT'), false);
});

test('cancel aborts generation, ignores a late response and allows discarding generated drafts', async () => {
  let resolveGeneration;
  const ui = await mount(withoutDeveloper(), 'zh', { generate: () => new Promise(resolve => { resolveGeneration = resolve; }) });
  ui.selectPlugin(); ui.editDescription('Original draft'); ui.chooseModel();
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
  ui.selectPlugin(); ui.chooseModel();
  const pending = ui.generate();
  assert.equal(ui.find(button('取消更改')).props.disabled, false);
  ui.find(button('取消更改')).props.onClick(); ui.render();
  resolveGeneration({ description: 'Discarded result' }); await pending;
  assert.equal(ui.find(node => node.type === 'textarea').props.value, '');
  assert.equal(ui.find(button('保存设置')).props.disabled, true);
});

test('generation uses a 120-second timeout and preserves drafts on timeout', async () => {
  const ui = await mount(withoutDeveloper(), 'zh', { generate: call => new Promise((_resolve, reject) => call.signal.addEventListener('abort', () => { const error = new Error('Aborted'); error.name = 'AbortError'; reject(error); })) });
  ui.selectPlugin(); ui.editDescription('Keep on timeout'); ui.chooseModel();
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
    ui.selectPlugin(); ui.editDescription('Keep valid draft'); ui.chooseModel();
    await ui.generate();
    assert.equal(ui.find(node => node.type === 'textarea').props.value, 'Keep valid draft');
    assert.match(ui.text(), /宿主返回了无效响应/);
    assert.equal(ui.calls.some(call => call.method === 'PUT'), false);
  }
});

test('unmount aborts generation and ignores a late result', async () => {
  let resolveGeneration;
  const ui = await mount(withoutDeveloper(), 'zh', { generate: () => new Promise(resolve => { resolveGeneration = resolve; }) });
  ui.selectPlugin(); ui.editDescription('Original draft'); ui.chooseModel();
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
const sourceGroup = (owner, label) => sourceEntry(ownerId(owner), label, owner, 'group', { defaultRole: 'inherit' });
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
const policyChoices = (ui, label) => descendants(ui.find(node => node.props.role === 'radiogroup' && node.props['aria-label'] === label)).filter(node => node.props.role === 'radio');
const policyValue = (ui, label) => policyChoices(ui, label).find(node => String(node.props['aria-checked']) === 'true')?.props.value;
const choosePolicy = (ui, label, value) => { const radio = policyChoices(ui, label).find(node => node.props.value === value); assert.ok(radio && !radio.props.disabled, 'Expected an available policy choice'); radio.props.onClick(); ui.render(); };
const click = (ui, label) => { ui.find(node => node.type === 'button' && node.props['aria-label'] === label).props.onClick(); ui.render(); };
const showList = (ui, name) => { ui.find(node => node.props['data-list-view'] === name).props.onClick(); ui.render(); };
const descendants = node => [node, ...node.children.filter(child => typeof child === 'object').flatMap(descendants)];

// Previews must be visible without expanding rows and must not mislabel runtime content.
test('master detail shows complete static previews, explains dynamic bodies and preserves disabled injection on save', async () => {
  const data = withComposition();
  const baseText = 'REGISTERED_BEGIN\n' + '完整注册文本\n'.repeat(1000) + '{{session_variable}}\nREGISTERED_END';
  const browserText = 'Browser static instructions\nEvery line remains available.';
  data.promptComposition.sources.find(source => source.id === 'base:identity').preview = { kind: 'static', text: baseText };
  Object.assign(data.promptComposition.sources.find(source => source.id === 'opaque:a'), { preview: { kind: 'static', text: browserText }, canToggleInjection: true });
  data.promptComposition.sources.find(source => source.id === 'opaque:b').preview = { kind: 'dynamic', reason: 'session-context-required', message: '需会话上下文动态生成。' };
  data.promptComposition.config.rules['opaque:a'] = { role: 'inherit', delivery: 'always', enabled: false };
  const ui = await mount(data);
  const baseBody = ui.find(node => node.type === 'pre' && node.props['aria-label'] === 'Identity');
  assert.equal(baseBody.children.join(''), baseText, 'static registration text must not be truncated or interpolated');
  assert.equal(ui.find(node => node.type === 'button' && node.props['aria-label'] === '查看提示词 · Identity').props['aria-current'], 'true');
  assert.equal(ui.nodes().some(node => node.props.className === 'td-expand'), false);
  click(ui, '查看提示词 · Runtime facts');
  assert.equal(ui.nodes().some(node => node.type === 'pre' && node.props['aria-label'] === 'Important note'), false, 'excluded content must not be mixed into injected prompt details');
  assert.equal(ui.nodes().some(node => node.type === 'pre' && node.props['aria-label'] === 'Runtime facts'), false);
  assert.match(ui.text(), /随会话动态生成/);
  assert.equal(ui.nodes().filter(node => node.props.className === 'td-prompt-card').length, 1);
  assert.equal(ui.nodes().filter(node => node.props.className === 'td-check td-tool').length, 0, 'prompt details must not mix in tool configuration');
  assert.equal(ui.nodes().some(node => node.props.role === 'radiogroup' && node.props['aria-label']?.startsWith('消息角色')), false);
  const more = ui.find(node => node.type === 'details' && node.props.className === 'td-prompt-options');
  assert.equal(more.props.open, undefined, 'advanced controls start collapsed');
  assert.ok(descendants(more).some(node => node.props['aria-label'] === '加载方式 · Runtime facts'));
  showList(ui, 'archive');
  assert.equal(ui.find(node => node.type === 'pre' && node.props['aria-label'] === 'Important note').children.join(''), browserText, 'excluded text remains fully inspectable in its own tab');
  assert.ok(ui.find(node => node.props['data-archived-id'] === 'opaque:a'));
  assert.equal(ui.nodes().some(node => node.props.role === 'radiogroup' && node.props['aria-label']?.startsWith('注入 · ')), false);
  click(ui, '移到用户上下文 · Important note');
  assert.equal(ui.find(node => node.props['aria-label'] === '恢复默认角色 · Important note').props.title, '默认：系统', 'reset follows the owner rather than the local user override');
  await ui.save();
  const saved = ui.calls.find(call => call.url.endsWith('/prompt-composition') && call.method === 'PUT').body;
  assert.deepEqual(saved.rules['opaque:a'], { role: 'user', delivery: 'always', enabled: false });
  assert.deepEqual(saved.rules['absent:kept'], data.promptComposition.config.rules['absent:kept']);
});

// Dragging is scoped; moving siblings must leave absent IDs and other sibling sets intact.
test('list exclusion and restore honor inherited injection, preserve sibling overrides and remain reversible drafts', async () => {
  const data = withComposition(), owner = ownerId('browser-plugin');
  for (const source of data.promptComposition.sources) source.canToggleInjection = source.owner !== '@delthin/dsh-tool-wrap' && Boolean(source.owner);
  data.promptComposition.config.rules[owner].enabled = false;
  data.promptComposition.config.rules['opaque:b'] = { role: 'user', delivery: 'pack', enabled: true };
  const ui = await mount(data);
  const archived = id => ui.nodes().some(node => node.props['data-archived-id'] === id);
  const tab = name => ui.find(node => node.props['data-list-view'] === name);
  const panel = name => ui.find(node => node.props.id === tab(name).props['aria-controls']);
  const before = clone(data.promptComposition.config);
  assert.equal(tab('injected').props['aria-selected'], true);
  assert.equal(panel('archive').props.hidden, true);
  assert.equal(archived('opaque:a'), true, 'parent exclusion must appear in the archive');
  assert.equal(archived('opaque:b'), false, 'a child’s explicit true must override its parent');
  showList(ui, 'archive');
  assert.equal(tab('archive').props['aria-selected'], true);
  assert.equal(panel('injected').props.hidden, true);
  assert.equal(panel('archive').props.hidden, false);
  ui.search('Runtime facts');
  assert.equal(archived('opaque:a'), false, 'an active sibling matching search must not leak into excluded results');
  ui.search('Important note');
  assert.equal(archived('opaque:a'), true);
  click(ui, '恢复 · Important note');
  assert.equal(archived('opaque:a'), false, 'restore must actually enable a child of an excluded parent');
  assert.equal(tab('injected').props['aria-selected'], true);
  assert.equal(ui.find(node => node.type === 'button' && node.props['aria-label'] === '查看提示词 · Important note').props['aria-current'], 'true');
  assert.ok(descendants(ui.find(node => node.props['data-role-zone'] === 'system')).some(node => node.props['data-prompt-id'] === 'opaque:a'));
  ui.search('');
  click(ui, '移到不注入 · Runtime facts');
  assert.equal(archived('opaque:b'), true);
  assert.equal(tab('injected').props['aria-selected'], true, 'removing one prompt must not interrupt work in the injected list');
  showList(ui, 'archive');
  assert.equal(panel('archive').props.hidden, false);
  assert.equal(ui.nodes().some(node => node.type === 'button' && node.props['aria-label'] === '移到不注入 · unwrap directory entry'), false, 'fixed directory sources cannot be excluded');
  assert.equal(ui.calls.some(call => call.method !== 'GET'), false, 'list actions must not save immediately');
  await ui.save();
  const saved = ui.calls.find(call => call.method === 'PUT');
  assert.equal(saved.url, '/api/tool-discovery/prompt-composition', 'exclusion cannot rewrite tool membership');
  assert.deepEqual(saved.body, { ...before, rules: { ...before.rules,
    'opaque:a': { role: 'inherit', delivery: 'inherit', enabled: true },
    'opaque:b': { role: 'user', delivery: 'pack', enabled: false },
  } });
  click(ui, '恢复 · Runtime facts');
  click(ui, '移到不注入 · Prompt-only note');
  assert.equal(archived('solo:note'), true);
  assert.equal(ui.nodes().some(node => node.props['data-source-id'] === ownerId('scoped-plugin') && node.props.className?.includes('td-group')), false, 'a fully excluded prompt-only source leaves the outer list');
  showList(ui, 'archive');
  click(ui, '恢复 · Prompt-only note');
  assert.equal(archived('solo:note'), false);
  assert.equal(tab('injected').props['aria-selected'], true);
  assert.equal(ui.find(node => node.type === 'button' && node.props['aria-label'] === '查看提示词 · Prompt-only note').props['aria-current'], 'true', 'restoring a different source selects that prompt rather than the previous package');
  assert.ok(ui.find(node => node.props['aria-label'] === '加载方式 · Prompt-only note'));
  assert.ok(descendants(ui.find(node => node.props['data-role-zone'] === 'system')).some(node => node.props['data-prompt-id'] === 'solo:note'));
  ui.find(button('取消更改')).props.onClick(); ui.render();
  showList(ui, 'archive');
  assert.equal(archived('opaque:b'), true, 'cancel restores the saved archive state');
  assert.equal(ui.find(button('保存设置')).props.disabled, true);
  assert.equal(ui.calls.filter(call => call.method === 'PUT').length, 1);
});

test('prompt drag and Alt sorting cross sources and roles while preserving legacy order, rules and cancel baselines', async () => {
  const data = withComposition();
  data.promptComposition.sources.push(sourceEntry('opaque:c', 'Third rule', 'browser-plugin'));
  data.promptComposition.sources.find(source => source.id === 'context:browser-plugin-looking').roles = ['inherit', 'system', 'user'];
  data.promptComposition.config.rules['opaque:a'] = { role: 'inherit', delivery: 'pack', enabled: true };
  const original = ['missing:slot', 'opaque:a', 'solo:note', 'opaque:b', 'base:identity', 'opaque:c', 'instructions:global', 'instructions:project', 'context:browser-plugin-looking', 'unwrap:directory', 'absent:kept'];
  data.promptComposition.config.sourceOrder = [...original];
  const before = clone(data.promptComposition.config);
  const ui = await mount(data);
  const zone = role => ui.find(node => node.props['data-role-zone'] === role);
  const order = role => descendants(zone(role)).filter(node => node.props['data-prompt-id']).map(node => node.props['data-prompt-id']);
  const handle = label => ui.find(node => node.type === 'button' && node.props['aria-label'] === '拖动排序；也可按 Alt + ↑ / ↓ · ' + label);
  const row = id => ui.find(node => node.props['data-prompt-id'] === id);
  const start = label => { handle(label).props.onDragStart({ preventDefault() { assert.fail('valid drag should start'); }, dataTransfer: { setData(type, id) { assert.equal(type, 'text/plain'); assert.ok(original.includes(id) || id === ownerId('browser-plugin')); } }, currentTarget: { closest: () => null } }); ui.render(); };
  const drop = (node, after = false) => { node.props.onDrop({ preventDefault() {}, currentTarget: { getBoundingClientRect: () => ({ top: 0, height: 44 }) }, clientY: after ? 43 : 1 }); ui.render(); };
  const initial = order('system');
  drop(row('solo:note'));
  assert.deepEqual(order('system'), initial, 'external drops cannot reorder');
  start('Browser rules'); drop(row('solo:note')); handle('Browser rules').props.onDragEnd(); ui.render();
  assert.deepEqual(order('system'), initial, 'tool-pack drags cannot enter prompt scope');
  start('Important note');
  drop(ui.find(node => node.props['data-sort-id'] === ownerId('browser-plugin')));
  handle('Important note').props.onDragEnd(); ui.render();
  assert.equal(ui.find(button('保存设置')).props.disabled, true, 'prompt drags cannot reorder tool packs');
  start('Important note'); drop(row('solo:note'), true);
  assert.deepEqual(order('system').slice(0, 3), ['solo:note', 'opaque:a', 'opaque:b'], 'cross-source sorting is allowed inside one role');
  handle('Runtime facts').props.onKeyDown({ altKey: true, key: 'ArrowUp', preventDefault() {} }); ui.render();
  assert.deepEqual(order('system').slice(0, 3), ['solo:note', 'opaque:b', 'opaque:a']);
  start('Important note'); drop(zone('user'));
  assert.deepEqual(order('user'), ['context:browser-plugin-looking', 'opaque:a']);
  assert.equal(ui.find(node => node.type === 'button' && node.props['aria-label'] === '查看提示词 · Important note').props['aria-current'], 'true');
  start('Unknown origin'); drop(row('opaque:b'));
  assert.deepEqual(order('user'), ['opaque:a']);
  start('Important note'); drop(row('opaque:b'));
  assert.deepEqual(order('user'), []);
  start('Important note'); drop(zone('user'));
  assert.deepEqual(order('user'), ['opaque:a'], 'an empty role zone accepts a drop');
  await ui.save();
  const calls = ui.calls.filter(call => call.method === 'PUT');
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, '/api/tool-discovery/prompt-composition');
  assert.deepEqual(calls[0].body.order, before.order, 'flat prompt sorting cannot rewrite legacy group order');
  assert.equal(calls[0].body.sourceOrder[0], 'missing:slot');
  assert.equal(calls[0].body.sourceOrder.at(-1), 'absent:kept');
  assert.deepEqual(calls[0].body.rules, { ...before.rules, 'opaque:a': { role: 'user', delivery: 'pack', enabled: true }, 'context:browser-plugin-looking': { role: 'system', delivery: 'inherit' } });
  const savedSystem = order('system');
  handle('Runtime facts').props.onKeyDown({ altKey: true, key: 'ArrowDown', preventDefault() {} }); ui.render();
  assert.notDeepEqual(order('system'), savedSystem);
  ui.find(button('取消更改')).props.onClick(); ui.render();
  assert.deepEqual(order('system'), savedSystem);
  assert.deepEqual(order('user'), ['opaque:a']);
  assert.equal(ui.find(button('保存设置')).props.disabled, true);
  assert.equal(ui.calls.filter(call => call.method === 'PUT').length, 1);
});

test('edge drag scrolls continuously through the nearest scroll pane and stops on exit, drop and unmount', async () => {
  const ui = await mount(withComposition());
  let nextFrame = 0;
  const frames = new Map();
  const view = {
    requestAnimationFrame(fn) { frames.set(++nextFrame, fn); return nextFrame; },
    cancelAnimationFrame(id) { frames.delete(id); },
    getComputedStyle(element) { return { overflowY: element.overflowY }; },
  };
  const boundary = {};
  ui.find(node => node.props.className === 'td-settings').props.ref.current = { parentElement: boundary };
  const pane = () => ({ ownerDocument: { defaultView: view }, parentElement: boundary, overflowY: 'auto', isConnected: true,
    scrollTop: 100, clientHeight: 200, scrollHeight: 1000, getBoundingClientRect: () => ({ top: 0, bottom: 200, height: 200, left: 0, right: 300 }) });
  const master = pane(), userZone = pane(), detail = pane();
  const nestedList = { ...pane(), parentElement: master, overflowY: 'visible', scrollHeight: 200 };
  const list = () => ui.find(node => node.props.className === 'td-master-list td-role-master-list');
  const handle = () => ui.find(node => node.props['aria-label'] === '拖动排序；也可按 Alt + ↑ / ↓ · Important note');
  const over = (node, element, y) => node.props.onDragOver({ currentTarget: element, clientY: y, preventDefault() {} });
  const frame = time => { const pending = [...frames.values()]; frames.clear(); pending.forEach(fn => fn(time)); };
  const start = () => { handle().props.onDragStart({ dataTransfer: { setData() {} }, currentTarget: { closest: () => null } }); ui.render(); };
  over(list(), nestedList, 199);
  assert.equal(frames.size, 0, 'external drags cannot start auto-scroll');
  start(); over(list(), nestedList, 199); frame(16);
  const first = master.scrollTop;
  frame(32);
  assert.ok(first > 100 && master.scrollTop > first, 'one edge event must keep scrolling across frames');
  assert.equal(nestedList.scrollTop, 100, 'non-scrolling nested lists must not absorb edge scrolling');
  over(list(), nestedList, 100); const centered = master.scrollTop; frame(48);
  assert.equal(master.scrollTop, centered); assert.equal(frames.size, 0, 'center hover stops the loop');
  over(list(), nestedList, 1); frame(64);
  assert.ok(master.scrollTop < centered, 'the top edge reverses direction');
  over(ui.find(node => node.props['data-role-zone'] === 'user'), userZone, 199); frame(80);
  assert.ok(userZone.scrollTop > 100, 'the user role zone has an independent scroll pane');
  const masterStopped = master.scrollTop; frame(96); assert.equal(master.scrollTop, masterStopped);
  over(ui.find(node => node.props.className === 'td-detail'), detail, 199); frame(112);
  assert.ok(detail.scrollTop > 100, 'prompt details use their own scroll pane');
  const userStopped = userZone.scrollTop; frame(128); assert.equal(userZone.scrollTop, userStopped);
  ui.find(node => node.props.className === 'td-detail').props.onDragLeave({ currentTarget: detail, clientX: -1, clientY: 100 });
  assert.equal(frames.size, 0, 'leaving a pane cancels its animation');
  over(list(), nestedList, 199); list().props.onDrop(); ui.render();
  assert.equal(frames.size, 0, 'dropping on blank list space cancels scrolling');
  over(list(), nestedList, 199); assert.equal(frames.size, 0, 'completed drags cannot restart scrolling');
  start(); over(list(), nestedList, 199); ui.unmount();
  assert.equal(frames.size, 0, 'unmount cancels a pending frame');
});

test('selected packages sort only inside their parent and deselection is reversible without changing saved tool selections', async () => {
  const data = withComposition();
  data.groups[1].tools = [{ name: 'scoped_tool', description: 'Scoped package tool' }];
  data.promptComposition.sources = data.promptComposition.sources.filter(source => source.id !== 'solo:note');
  const browser = ownerId('browser-plugin'), scoped = ownerId('scoped-plugin'), base = ownerId('@deepseek-ai/dsh-system-prompt'), parent = ownerId('@delthin/dsh-tool-wrap');
  const original = ['absent:kept', base, browser, 'base:identity', scoped, 'opaque:a', parent, 'solo:note'];
  data.promptComposition.config.order = [...original];
  const ui = await mount(data);
  const packs = () => ui.find(node => node.type === 'ul' && node.props.className === 'td-pack-list');
  const packageOrder = () => packs().children.map(node => node.props['data-sort-id']);
  const row = id => ui.find(node => node.props['data-sort-id'] === id);
  const handle = label => ui.find(node => node.type === 'button' && node.props['aria-label'] === '拖动排序；也可按 Alt + ↑ / ↓ · ' + label);
  const start = label => { handle(label).props.onDragStart({ preventDefault() { assert.fail('valid drag should start'); }, dataTransfer: { setData() {} }, currentTarget: { closest: () => null } }); ui.render(); };
  const drop = id => { row(id).props.onDrop({ preventDefault() {}, currentTarget: { getBoundingClientRect: () => ({ top: 0, height: 44 }) }, clientY: 1 }); ui.render(); };
  assert.deepEqual(packageOrder(), [browser, scoped]);
  ui.selectPlugin('Prompt only');
  assert.equal(ui.nodes().filter(node => node.props.className?.split(' ').includes('td-prompt-card')).length, 0, 'tool-only group metadata must not fabricate a prompt');
  assert.equal(handle('Prompt only').props.disabled, false, 'registered tool-only packages remain sortable');
  start('Prompt only'); drop('base:identity'); handle('Prompt only').props.onDragEnd(); ui.render();
  start('Identity'); drop(scoped); handle('Identity').props.onDragEnd(); ui.render();
  assert.equal(ui.find(button('保存设置')).props.disabled, true, 'parent/package cross-scope drops cannot create drafts');
  handle('Prompt only').props.onKeyDown({ altKey: true, key: 'ArrowUp', preventDefault() {} }); ui.render();
  assert.deepEqual(packageOrder(), [scoped, browser]);
  await ui.save();
  const calls = ui.calls.filter(call => call.method === 'PUT');
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, '/api/tool-discovery/prompt-composition');
  assert.deepEqual(calls[0].body.order, ['absent:kept', base, scoped, 'base:identity', browser, 'opaque:a', parent, 'solo:note']);
  click(ui, '移出按需工具包 · Prompt only');
  assert.deepEqual(packageOrder(), [browser]);
  assert.ok(!descendants(packs()).includes(row(scoped)), 'a deselected package returns to the outer list');
  ui.find(button('取消更改')).props.onClick(); ui.render();
  assert.deepEqual(packageOrder(), [scoped, browser]);
  assert.equal(ui.find(button('保存设置')).props.disabled, true);
  assert.equal(ui.calls.filter(call => call.method === 'PUT').length, 1, 'tool selection and cancellation stay local');
});

test('effective roles split mixed plugins and reset only local roles while preserving absent rules and tool membership', async () => {
  const data = withComposition(), owner = ownerId('browser-plugin');
  data.promptComposition.sources.push(sourceEntry('grouped:note', 'Grouped note', 'browser-plugin', 'section', { groupId: 'browser:subgroup' }));
  data.promptComposition.config.rules['browser:subgroup'] = { role: 'user', delivery: 'always' };
  data.promptComposition.config.rules['opaque:b'] = { role: 'user', delivery: 'pack', enabled: true };
  const before = clone(data.promptComposition.config);
  const ui = await mount(data);
  const inRole = (role, id) => descendants(ui.find(node => node.props['data-role-zone'] === role)).some(node => node.props['data-prompt-id'] === id);
  assert.equal(ui.nodes().filter(node => node.type === 'form').length, 1);
  assert.equal(inRole('system', 'base:identity'), true, 'unconfigured sources use their own default');
  assert.equal(inRole('system', 'opaque:a'), true, 'owner rules apply to inherited children');
  assert.equal(inRole('user', 'opaque:b'), true, 'a local rule overrides the owner');
  assert.equal(inRole('user', 'grouped:note'), true, 'group overrides take precedence over owner rules');
  assert.equal(inRole('user', 'context:browser-plugin-looking'), true);
  assert.doesNotMatch(ui.text(), /Empty metadata|Absent saved source/);
  assert.equal(ui.nodes().some(node => node.props['data-prompt-id'] === owner), false, 'plugin metadata cannot fabricate a prompt row');
  assert.equal(descendants(ui.find(node => node.props['data-role-zone'] === 'user')).some(node => node.props['data-source-id'] === owner), false, 'tool packs stay outside role lists');
  click(ui, '查看提示词 · Unknown origin');
  assert.equal(ui.nodes().some(node => node.type === 'textarea' || node.props.className === 'td-check td-tool'), false, 'a name resembling a plugin cannot claim its description or tools');
  const toolsTab = ui.find(node => node.props['data-list-view'] === 'tools');
  const toolsPanel = ui.find(node => node.props.id === toolsTab.props['aria-controls']);
  assert.equal(descendants(toolsPanel).some(node => node.props['data-source-id'] === ownerId('@host/unknown')), false, 'unattributed prompts do not acquire a tool package');
  click(ui, '查看提示词 · Runtime facts');
  click(ui, '恢复默认角色 · Runtime facts');
  assert.equal(inRole('system', 'opaque:b'), true);
  assert.equal(policyValue(ui, '加载方式 · Runtime facts'), 'pack');
  ui.find(button('刷新')).props.onClick(); await ui.flush();
  assert.equal(inRole('system', 'opaque:b'), true, 'refresh preserves the reset draft');
  assert.equal(policyValue(ui, '加载方式 · Runtime facts'), 'pack');
  ui.find(button('取消更改')).props.onClick(); ui.render();
  assert.equal(inRole('user', 'opaque:b'), true, 'cancel restores the explicit saved role');
  click(ui, '查看提示词 · Runtime facts');
  click(ui, '恢复默认角色 · Runtime facts');
  ui.find(node => node.props['aria-label'] === '拖动排序；也可按 Alt + ↑ / ↓ · Runtime facts').props.onKeyDown({ altKey: true, key: 'ArrowUp', preventDefault() {} }); ui.render();
  await ui.save();
  const saved = ui.calls.find(call => call.url.endsWith('/prompt-composition') && call.method === 'PUT').body;
  const { sourceOrder, ...legacy } = saved;
  assert.deepEqual(legacy, { ...before, rules: { ...before.rules, 'opaque:b': { role: 'inherit', delivery: 'pack', enabled: true } } });
  assert.ok(sourceOrder.indexOf('opaque:b') < sourceOrder.indexOf('opaque:a'), 'Alt sorting creates optional flat source order without rewriting legacy order');
  assert.ok(sourceOrder.includes('absent:kept'), 'absent saved sources survive creation of flat order');
  assert.equal(ui.calls.filter(call => call.method === 'PUT').length, 1, 'composition-only changes cannot rewrite tool membership');
  ui.find(button('恢复提示词默认')).props.onClick(); ui.render();
  assert.equal(ui.calls.filter(call => call.method === 'PUT').length, 1, 'defaults remain a local draft');
  ui.find(button('取消更改')).props.onClick(); ui.render();
  assert.equal(ui.find(button('保存设置')).props.disabled, true);
});

test('prompt-only plugin keeps its editable description but cannot spend a generation call without tool data', async () => {
  const data = withComposition();
  data.groups[0] = { ...data.groups[0], tools: [], developerDescription: '', description: '', descriptionSource: 'missing' };
  const ui = await mount(data);
  click(ui, '查看提示词 · Important note');
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
  assert.equal(supported.nodes().some(node => node.props.role === 'radio' && node.props.value === 'developer'), false);
  click(supported, 'View prompt · unwrap directory entry');
  assert.deepEqual(policyChoices(supported, 'Loading · unwrap directory entry').map(radio => radio.props.value), ['inherit', 'always']);
  const data = withComposition();
  data.promptComposition.config.enabled = false;
  data.promptComposition.capabilities = { admission: false, roles: ['inherit'], developer: false, reason: 'host-adapter-required' };
  data.promptComposition.sources.forEach(source => { source.roles = ['inherit']; source.deliveryModes = ['inherit']; });
  const unavailable = await mount(data);
  assert.match(unavailable.text(), /宿主未启用编排适配/);
  assert.match(unavailable.text(), /DSH基础|Global AGENTS|Prompt only/);
  assert.equal(unavailable.nodes().filter(node => node.props.role === 'radio').every(node => node.props.disabled), true);
  assert.equal(unavailable.find(node => checkbox(node) && node.props.role === 'switch' && node.props['aria-label'] === '启用提示词编排').props.disabled, true);
  click(unavailable, '查看提示词 · Important note');
  assert.equal(unavailable.find(node => node.props['aria-label'] === '移到用户上下文 · Important note').props.disabled, true);
  assert.equal(unavailable.nodes().some(node => node.props.role === 'radiogroup' && node.props['aria-label']?.startsWith('消息角色')), false);
});

test('unsupported saved fields can recover locally, including a single remaining inherit choice', async () => {
  const data = withComposition();
  data.promptComposition.config.rules['opaque:a'] = { role: 'developer', delivery: 'pack', enabled: false };
  Object.assign(data.promptComposition.sources.find(source => source.id === 'opaque:a'), {
    roles: ['inherit'], deliveryModes: ['inherit'], canToggleInjection: false,
  });
  const ui = await mount(data);
  assert.ok(descendants(ui.find(node => node.props['data-role-zone'] === 'invalid')).some(node => node.props['data-prompt-id'] === 'opaque:a'));
  for (const role of ['system', 'user']) assert.equal(descendants(ui.find(node => node.props['data-role-zone'] === role)).some(node => node.props['data-prompt-id'] === 'opaque:a'), false);
  click(ui, '查看提示词 · Important note');
  assert.match(ui.text(), /已存设置当前不可用/);
  const reset = ui.find(node => node.props['aria-label'] === '恢复默认角色 · Important note');
  assert.equal(reset.props.disabled, false, 'a single inherit option still permits role recovery');
  assert.equal(ui.find(node => node.props['aria-label'] === '移到用户上下文 · Important note').props.disabled, true);
  click(ui, '恢复默认角色 · Important note');
  assert.ok(descendants(ui.find(node => node.props['data-role-zone'] === 'system')).some(node => node.props['data-prompt-id'] === 'opaque:a'));
  assert.equal(ui.nodes().some(node => node.props['data-role-zone'] === 'invalid'), false);
  const delivery = policyChoices(ui, '加载方式 · Important note');
  assert.equal(delivery.length, 1);
  assert.equal(delivery[0].props.tabIndex, 0, 'an invalid stored delivery retains a keyboard entry point');
  assert.equal(delivery[0].props.disabled, false);
  let focused = false;
  delivery[0].props.onKeyDown({ key: 'ArrowRight', preventDefault() {}, currentTarget: { parentElement: { querySelectorAll: () => [{ focus() { focused = true; } }] } } });
  ui.render();
  assert.equal(focused, true);
  assert.equal(policyValue(ui, '加载方式 · Important note'), 'inherit');
  click(ui, '重置停用设置 · Important note');
  assert.equal(ui.calls.some(call => call.method === 'PUT'), false, 'repair remains a draft');
  await ui.save();
  const expected = clone(data.promptComposition.config);
  delete expected.rules['opaque:a'];
  assert.deepEqual(ui.calls.find(call => call.method === 'PUT').body, expected, 'unrelated rules and order must survive recovery');
});

test('context growth is shown as a positive increase and saved estimates stay distinct from drafts', async () => {
  const data = fixture();
  data.estimate = { beforeChars: 1000, afterChars: 1600, savedChars: -600, hiddenCount: 1 };
  data.lastAssembly = { ...data.estimate, status: 'projected', mode: 'ptc' };
  const ui = await mount(data);
  const deltas = ui.nodes().filter(node => node.props.className === 'td-stat' && descendants(node).some(child => child.type === 'dt' && child.children.includes('净增加')));
  assert.equal(deltas.length, 2);
  for (const delta of deltas) assert.ok(descendants(delta).some(child => child.type === 'dd' && child.children.includes('600 字符')));
  assert.match(ui.text(), /预计增加 token/);
  assert.doesNotMatch(ui.text(), /-600|-150|下方仍为已保存设置的统计/);
  ui.find(checkbox).props.onChange({ target: { checked: false } }); ui.render();
  assert.match(ui.text(), /下方仍为已保存设置的统计/);
  ui.find(button('取消更改')).props.onClick(); ui.render();
  assert.doesNotMatch(ui.text(), /下方仍为已保存设置的统计/);
});

test('partial saves update only successful baselines; retry and cancel retain the correct remaining draft', async () => {
  for (const failure of ['tools', 'composition']) {
    let fail = true;
    const ui = await mount(withComposition(), 'zh', {
      toolsSave: () => failure === 'tools' && fail ? { error: { message: 'Tools write failed' } } : null,
      composition: async (call, data) => failure === 'composition' && fail ? { error: { message: 'Prompt write failed' } } : { ...data, config: call.body },
    });
    ui.find(checkbox).props.onChange({ target: { checked: false } }); ui.render();
    click(ui, '查看提示词 · Important note');
    click(ui, '移到用户上下文 · Important note');
    await ui.save();
    assert.match(ui.text(), /部分设置已保存，失败部分仍保留草稿/);
    assert.equal(ui.find(button('保存设置')).props.disabled, false);
    const first = ui.calls.filter(call => call.method === 'PUT'); assert.equal(first.length, 2);
    if (failure === 'composition') {
      ui.find(button('取消更改')).props.onClick(); ui.render();
      assert.equal(ui.find(checkbox).props.checked, false, 'successfully saved tools remain the cancel baseline');
      assert.ok(descendants(ui.find(node => node.props['data-role-zone'] === 'system')).some(node => node.props['data-prompt-id'] === 'opaque:a'));
      assert.equal(ui.find(button('保存设置')).props.disabled, true);
      click(ui, '移到用户上下文 · Important note');
    }
    fail = false; await ui.save();
    const last = ui.calls.filter(call => call.method === 'PUT').at(-1);
    assert.equal(last.url, failure === 'tools' ? '/api/tool-discovery' : '/api/tool-discovery/prompt-composition');
    assert.equal(ui.calls.filter(call => call.method === 'PUT').length, 3, 'retry sends only the still-dirty endpoint');
    assert.equal(ui.find(button('保存设置')).props.disabled, true);
  }
});
