window.__ModuleLoader__.load({ id: '@delthin/dsh-global-pins', factory: (require) => {
  const React = require('react');
  const { Button } = require('@deepseek-ai/dsh-client-ui-primitives');
  const { createElement: h, useEffect, useRef, useState, useSyncExternalStore } = React;
  const namespace = 'delthin.globalPins';
  const dictionaries = {
    zh: { title: '置顶对话', regionLabel: '置顶对话', placement: '显示位置', placementHint: '始终集中显示一组置顶对话；选择随工作区列表滚动，或独立固定在列表上方。', placementAbove: '工作区列表上方', placementInside: '工作区列表内（一起滚动）', loading: '正在读取设置…', unavailable: '设置暂不可用，请稍后重试。', readOnly: '当前设置为只读。', save: '保存', saving: '保存中…', saved: '已保存', saveError: '设置保存失败，请重试。' },
    en: { title: 'Pinned conversations', regionLabel: 'Pinned conversations', placement: 'Placement', placementHint: 'Keep one group of pinned conversations, either scrolling with the workspace list or fixed above it.', placementAbove: 'Above the workspace list', placementInside: 'Inside the workspace list (scrolls together)', loading: 'Loading settings…', unavailable: 'Settings are unavailable. Please try again later.', readOnly: 'These settings are read-only.', save: 'Save', saving: 'Saving…', saved: 'Saved', saveError: 'Could not save settings. Please try again.' },
  };
  const placementOf = snapshot => snapshot.value?.placement === 'inside' ? 'inside' : 'above';
  const flag = 'data-dgp-native-pin';
  const variables = ['--dgp-x', '--dgp-y', '--dgp-width', '--dgp-clip'];
  const nativeCss = `
.dgp-mount{display:flex;flex-direction:column;flex:0 0 auto;min-height:0;overflow:hidden;pointer-events:auto;color:var(--dsw-alias-label-primary)}.dgp-mount[hidden]{display:none!important}.dgp-header{display:flex;align-items:center;gap:6px;flex:none;min-height:28px;padding:2px var(--dsh-sidebar-row-padding,12px);color:var(--dsw-alias-label-secondary);font-size:12px;font-weight:500}.dgp-header h2{margin:0;font:inherit}.dgp-count{margin-left:auto;font-size:11px;font-variant-numeric:tabular-nums}.dgp-native-viewport{min-height:0;flex:0 1 auto;overflow-y:auto;overscroll-behavior:contain}.dgp-mount[data-placement=inside]{overflow:visible}.dgp-mount[data-placement=inside] .dgp-native-viewport{flex:none;overflow:visible;overscroll-behavior:auto}
html body [data-dgp-native-pin][data-row-key]{position:fixed!important;left:var(--dgp-x)!important;top:var(--dgp-y)!important;width:var(--dgp-width)!important;max-width:none!important;clip-path:var(--dgp-clip)!important;z-index:10!important}
`;
  const settingsCss = `
.dgp-settings{display:grid;gap:16px;color:var(--dsw-alias-label-primary);font-family:inherit;font-size:13px;line-height:1.5}.dgp-settings fieldset{display:grid;gap:16px;min-width:0;margin:0;padding:0;border:0}.dgp-setting{display:grid;gap:6px}.dgp-setting label{font-weight:500}.dgp-setting p,.dgp-settings-notice{margin:0;color:var(--dsw-alias-label-secondary);font-size:12px}.dgp-setting select{width:100%;max-width:360px;min-height:32px;padding:5px 10px;border:1px solid var(--dsw-alias-border-l2);border-radius:var(--dsw-radius-md,8px);background:var(--dsw-alias-bg-layer-1,var(--dsw-alias-bg-base));color:inherit;font:inherit}.dgp-setting select:focus-visible{outline:var(--dsw-focus-ring-width,2px) solid var(--dsw-focus-ring-color,var(--dsw-alias-state-business-primary));outline-offset:2px}.dgp-settings-actions{display:flex;align-items:center;gap:10px}.dgp-settings-error{margin:0;color:var(--dsw-alias-state-error-primary);font-size:12px}
`;

  // Only plugin-owned spacers are inserted. React keeps every native row, wrapper,
  // handler and status projection in its original parent throughout promotion.
  function elevateNativeRows(doc, environment, { pinned, archived, placement, title, regionLabel }) {
    const inside = placement === 'inside';
    const wanted = new Set(pinned.filter(id => !archived.includes(id)));
    const host = doc.createElement('section'), header = doc.createElement('header'), heading = doc.createElement('h2');
    const count = doc.createElement('span'), viewport = doc.createElement('div'), spacer = doc.createElement('div');
    host.className = 'dgp-mount'; host.hidden = true; host.setAttribute('data-placement', placement); host.setAttribute('aria-label', regionLabel);
    header.className = 'dgp-header'; heading.textContent = title; count.className = 'dgp-count';
    viewport.className = 'dgp-native-viewport'; spacer.setAttribute('aria-hidden', 'true');
    header.append(heading, count); viewport.append(spacer); host.append(header, viewport);
    let anchor = null, root = null, scroller = null, parent = null, rows = [], frame = null, scanNeeded = false, live = true;
    const number = value => Number.parseFloat(value) || 0;
    const write = (style, key, value) => { if (style.getPropertyValue(key) !== value) style.setProperty(key, value); };
    const zoomOf = node => {
      const current = Number(node.currentCSSZoom);
      if (Number.isFinite(current) && current > 0) return current;
      let zoom = 1;
      for (let current = node; current; current = current.parentElement) {
        const value = environment.getComputedStyle(current).zoom;
        if (value && value !== 'normal') zoom *= value.endsWith('%') ? number(value) / 100 : number(value) || 1;
      }
      return zoom;
    };
    const safeForFixed = row => {
      for (let current = row.parentElement; current; current = current.parentElement) {
        const style = environment.getComputedStyle(current);
        if (['transform', 'perspective', 'filter', 'backdropFilter'].some(key => style[key] && style[key] !== 'none') ||
          /(?:paint|layout|strict|content)/.test(style.contain || '') || /(?:transform|perspective|filter)/.test(style.willChange || '') ||
          style.contentVisibility === 'auto' || style.containerType && style.containerType !== 'normal') return false;
      }
      return true;
    };
    const restore = entry => {
      if (entry.attribute === null) entry.row.removeAttribute(flag); else entry.row.setAttribute(flag, entry.attribute);
      for (const [key, value, priority] of entry.original) {
        if (value) entry.row.style.setProperty(key, value, priority); else entry.row.style.removeProperty(key);
      }
    };
    const positioned = () => parent && host.parentNode === parent && (inside ? parent.firstChild === host : host.nextSibling === anchor);
    const box = element => {
      const rect = element.getBoundingClientRect(), zoom = zoomOf(element);
      const left = rect.left + element.clientLeft * zoom, top = rect.top + element.clientTop * zoom;
      return { left, top, right: left + element.clientWidth * zoom, bottom: top + element.clientHeight * zoom };
    };
    const intersection = (...rects) => ({ left: Math.max(...rects.map(rect => rect.left)), top: Math.max(...rects.map(rect => rect.top)), right: Math.min(...rects.map(rect => rect.right)), bottom: Math.min(...rects.map(rect => rect.bottom)) });
    const observed = new Set();
    const resize = environment.ResizeObserver ? new environment.ResizeObserver(() => schedule(true)) : null;
    const scan = () => {
      anchor = doc.querySelector('[data-slot="sidebar.workspaces"]');
      root = anchor?.parentElement ?? null;
      const tree = anchor?.querySelector('[role="tree"]');
      scroller = tree && /^(auto|scroll)$/.test(environment.getComputedStyle(tree).overflowY) ? tree : null;
      parent = inside ? scroller : root;
      const previous = new Map(rows.map(entry => [entry.row, entry]));
      const available = new Map();
      if (parent) for (const row of anchor.querySelectorAll('[data-row-key^="session:"]')) {
        const id = row.getAttribute('data-row-key').slice(8);
        if (!wanted.has(id) || available.has(id) || !safeForFixed(row)) continue;
        const rect = row.getBoundingClientRect();
        if (rect.width > 0 && rect.height > 0) available.set(id, row);
      }
      rows = [...wanted].flatMap(id => {
        const row = available.get(id);
        if (!row) return [];
        const entry = previous.get(row) ?? { row, attribute: row.getAttribute(flag), original: variables.map(key => [key, row.style.getPropertyValue(key), row.style.getPropertyPriority(key)]) };
        previous.delete(row);
        return [entry];
      });
      previous.forEach(restore);
      if (!parent) host.remove();
      else if (!positioned()) parent.insertBefore(host, inside ? parent.firstChild : anchor);
      if (count.textContent !== String(rows.length)) count.textContent = String(rows.length);
      const targets = new Set(root ? [root, ...(parent ? [viewport, ...rows.map(entry => entry.row)] : [])] : []);
      if (resize) {
        for (const node of observed) if (!targets.has(node)) { resize.unobserve(node); observed.delete(node); }
        for (const node of targets) if (!observed.has(node)) { resize.observe(node); observed.add(node); }
      }
    };
    const measure = () => {
      if (!parent || !root?.isConnected) return;
      const rootRect = root.getBoundingClientRect(), hostZoom = zoomOf(host);
      const visible = rows.length > 0 && rootRect.width / hostZoom >= 160;
      if (host.hidden !== !visible) host.hidden = !visible;
      if (!visible) { rows.forEach(entry => write(entry.row.style, '--dgp-clip', 'inset(100% 0 0 0)')); return; }
      const maxHeight = inside ? 'none' : `${Math.min(240, rootRect.height / hostZoom * 0.4)}px`;
      if (host.style.maxHeight !== maxHeight) host.style.maxHeight = maxHeight;
      let total = 0;
      const metrics = rows.map(entry => {
        const style = environment.getComputedStyle(entry.row), zoom = zoomOf(entry.row), rect = entry.row.getBoundingClientRect();
        const margin = ['marginTop', 'marginRight', 'marginBottom', 'marginLeft'].map(key => number(style[key]) * zoom);
        const result = { entry, zoom, height: rect.height, margin, offset: total };
        total += margin[0] + rect.height + margin[2];
        return result;
      });
      const height = `${total / hostZoom}px`;
      if (spacer.style.height !== height) spacer.style.height = height;
      const view = box(viewport);
      const clip = intersection(inside ? box(scroller) : view, rootRect, { left: 0, top: 0, right: environment.innerWidth, bottom: environment.innerHeight });
      for (const { entry, zoom, height: rowHeight, margin, offset } of metrics) {
        const left = view.left + margin[3], top = view.top + offset + margin[0] - (inside ? 0 : viewport.scrollTop * hostZoom);
        const width = Math.max(0, view.right - view.left - margin[1] - margin[3]);
        const insets = [Math.max(0, clip.top - top), Math.max(0, left + width - clip.right), Math.max(0, top + rowHeight - clip.bottom), Math.max(0, clip.left - left)].map(value => `${value / zoom}px`).join(' ');
        write(entry.row.style, '--dgp-x', `${(left - margin[3]) / zoom}px`);
        write(entry.row.style, '--dgp-y', `${(top - margin[0]) / zoom}px`);
        write(entry.row.style, '--dgp-width', `${width / zoom}px`);
        write(entry.row.style, '--dgp-clip', `inset(${insets})`);
        if (!entry.row.hasAttribute(flag)) entry.row.setAttribute(flag, '');
      }
    };
    function schedule(rescan = false) {
      if (!live) return;
      scanNeeded ||= rescan;
      if (frame !== null) return;
      frame = environment.requestAnimationFrame(() => {
        frame = null;
        if (!live) return;
        if (scanNeeded) { scanNeeded = false; scan(); }
        measure();
      });
    }
    const hasRow = node => node.nodeType === 1 && (node.matches('[data-row-key^="session:"]') || node.querySelector('[data-row-key^="session:"]'));
    const mutations = new environment.MutationObserver(records => {
      if (!anchor?.isConnected || anchor.parentElement !== root || parent && !positioned()) { schedule(true); return; }
      if (records.some(record => {
        if (!anchor.contains(record.target) || host.contains(record.target)) return false;
        if (record.type === 'attributes') return true;
        if (record.target.closest?.('[data-row-key^="session:"]')) return false;
        return [...record.addedNodes, ...record.removedNodes].some(hasRow);
      })) schedule(true);
    });
    mutations.observe(doc.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['data-row-key'] });
    const scroll = event => { if (event.target === doc || event.target === viewport || event.target === scroller || event.target?.contains?.(host)) schedule(); };
    const resized = () => schedule(true);
    const wheel = event => {
      if (inside || event.ctrlKey || !rows.some(entry => entry.row === event.target.closest?.(`[${flag}]`))) return;
      const previous = viewport.scrollTop;
      const step = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? viewport.clientHeight : 1 / zoomOf(viewport);
      viewport.scrollTop += event.deltaY * step;
      if (viewport.scrollTop !== previous) { event.preventDefault(); schedule(); }
    };
    doc.addEventListener('scroll', scroll, true);
    doc.addEventListener('wheel', wheel, { capture: true, passive: false });
    environment.addEventListener('resize', resized);
    schedule(true);
    return () => {
      live = false;
      if (frame !== null) environment.cancelAnimationFrame(frame);
      mutations.disconnect(); resize?.disconnect(); rows.forEach(restore);
      doc.removeEventListener('scroll', scroll, true);
      doc.removeEventListener('wheel', wheel, true);
      environment.removeEventListener('resize', resized);
      host.remove();
    };
  }

  function Preferences({ form, t }) {
    const snapshot = useSyncExternalStore(form.subscribe, form.getSnapshot);
    const accepted = { placement: placementOf(snapshot) };
    const [draft, setDraft] = useState({}), [saving, setSaving] = useState(false), [result, setResult] = useState('');
    const busy = useRef(false), alive = useRef(false);
    useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
    const writable = snapshot.status === 'ready' && snapshot.writable;
    const dirty = Object.entries(draft).some(([field, value]) => value !== accepted[field]);
    const save = async event => {
      event.preventDefault();
      const latest = form.getSnapshot();
      if (busy.current || latest.status !== 'ready' || !latest.writable) return;
      const changes = Object.entries(draft).filter(([field, value]) => value !== placementOf(latest));
      if (!changes.length) return;
      busy.current = true; setSaving(true); setResult('');
      try {
        for (const [field, value] of changes) {
          const current = form.getSnapshot();
          if (current.status !== 'ready' || !current.writable || !await form.set(field, value)) throw new Error('Settings write refused');
          if (alive.current) setDraft({});
        }
        if (alive.current) setResult('saved');
      } catch {
        if (alive.current) setResult('saveError');
      } finally {
        busy.current = false;
        if (alive.current) setSaving(false);
      }
    };
    return h('form', { className: 'dgp-settings', onSubmit: save }, h('style', null, settingsCss),
      snapshot.status !== 'ready' && h('p', { className: 'dgp-settings-notice', role: 'status' }, t(snapshot.status === 'loading' ? 'loading' : 'unavailable')),
      snapshot.status === 'ready' && !snapshot.writable && h('p', { className: 'dgp-settings-notice', role: 'status' }, t('readOnly')),
      h('fieldset', { disabled: !writable || saving }, h('div', { className: 'dgp-setting' },
        h('label', { htmlFor: 'dgp-placement' }, t('placement')),
        h('select', { id: 'dgp-placement', value: draft.placement ?? accepted.placement, 'aria-describedby': 'dgp-placement-hint', onChange: event => {
          const value = event.target.value;
          if (!writable || busy.current || !['above', 'inside'].includes(value)) return;
          setDraft({ placement: value }); setResult('');
        } }, ...['above', 'inside'].map(value => h('option', { key: value, value }, t(value === 'inside' ? 'placementInside' : 'placementAbove')))),
        h('p', { id: 'dgp-placement-hint' }, t('placementHint')))),
      h('div', { className: 'dgp-settings-actions' }, h(Button, { type: 'submit', size: 'sm', disabled: !writable || saving || !dirty }, t(saving ? 'saving' : 'save')),
        result === 'saved' && h('span', { className: 'dgp-settings-notice', role: 'status' }, t('saved'))),
      result === 'saveError' && h('p', { className: 'dgp-settings-error', role: 'alert' }, t('saveError')));
  }

  function GlobalPins({ useWorkspaces, form, t }) {
    const pinned = useWorkspaces(state => state.pinnedSessionIds), archived = useWorkspaces(state => state.archivedSessionIds);
    const snapshot = useSyncExternalStore(form.subscribe, form.getSnapshot), placement = placementOf(snapshot);
    const title = t('title'), regionLabel = t('regionLabel');
    useEffect(() => {
      if (!pinned.length) return;
      return elevateNativeRows(document, window, { pinned, archived, placement, title, regionLabel });
    }, [pinned, archived, placement, title, regionLabel]);
    return h('style', null, nativeCss);
  }

  return { inject: ['slots', 'locale', 'configForms'], apply(ctx) {
    for (const [language, dictionary] of Object.entries(dictionaries)) ctx.effect(() => ctx.locale.register(namespace, language, dictionary));
    const source = ctx.configForms.get('global-pins');
    const form = {
      subscribe: listener => source.subscribe(listener),
      getSnapshot: () => source.getSnapshot(),
      set: (field, value) => source.set(field, value),
    };
    ctx.slots.inject('shell.overlay', () => ctx.slots.register({ name: 'shell.overlay', id: 'delthin.globalPins', locale: namespace }, props => h(GlobalPins, { ...props, form })));
    ctx.slots.inject('plugins.bundle.config', () => ctx.slots.register({ name: 'plugins.bundle.config', key: '@delthin/dsh-global-pins', locale: namespace }, props => h(Preferences, { ...props, form })));
  } };
} });
