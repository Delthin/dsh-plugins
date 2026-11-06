window.__ModuleLoader__.load({ id: '@delthin/dsh-global-pins', factory: (require) => {
  const React = require('react');
  const { createPortal } = require('react-dom');
  const { createElement: h, useEffect, useRef, useState } = React;
  const namespace = 'delthin.globalPins';
  const dictionaries = {
    zh: { title: '置顶对话', untitled: '未命名对话', ungrouped: '未分组', unpin: '取消置顶', unpinError: '取消置顶失败，请重试。', openError: '打开对话失败，请重试。', dismiss: '关闭提示', regionLabel: '置顶对话' },
    en: { title: 'Pinned conversations', untitled: 'Untitled conversation', ungrouped: 'Ungrouped', unpin: 'Unpin', unpinError: 'Could not unpin. Please try again.', openError: 'Could not open this conversation. Please try again.', dismiss: 'Dismiss message', regionLabel: 'Pinned conversations' },
  };
  const css = `
.dgp-region{display:flex;flex-direction:column;min-height:0;max-height:inherit;padding:4px 0 8px;color:var(--dsw-alias-label-primary);font-family:inherit;font-size:13px;line-height:1.4;box-sizing:border-box;pointer-events:auto}
.dgp-region *{box-sizing:border-box}.dgp-header{display:flex;align-items:center;gap:6px;flex:none;min-height:28px;padding:2px var(--dsh-sidebar-row-padding,12px);color:var(--dsw-alias-label-secondary);font-size:12px;font-weight:500}.dgp-header h2{margin:0;font:inherit}.dgp-count{margin-left:auto;font-size:11px;font-variant-numeric:tabular-nums}.dgp-icon{width:14px;height:14px;flex:none}
.dgp-list{list-style:none;margin:0;padding:0;min-height:0;overflow-y:auto;overscroll-behavior:contain}.dgp-row{position:relative;display:flex;align-items:center;min-height:46px;border-radius:var(--dsw-radius-md,8px);margin:1px var(--dsh-sidebar-paint-inset,3px)}.dgp-row:hover,.dgp-row:focus-within{background:var(--dsw-alias-interactive-bg-hover,var(--dsw-alias-bg-layer-2))}.dgp-row[data-active=true]{background:var(--dsw-alias-interactive-bg-hover,var(--dsw-alias-bg-layer-2));color:var(--dsw-alias-label-primary)}
.dgp-region button{font:inherit;color:inherit;border:0;background:transparent;cursor:pointer}.dgp-region button:disabled{cursor:default;opacity:.55}.dgp-open{min-width:0;flex:1;text-align:left;padding:6px 36px 6px calc(var(--dsh-sidebar-row-padding,12px) - var(--dsh-sidebar-paint-inset,3px));border-radius:var(--dsw-radius-md,8px);line-height:1.4!important}.dgp-title,.dgp-workspace{display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.dgp-title{font-size:13px}.dgp-workspace{margin-top:2px;font-size:11px;color:var(--dsw-alias-label-secondary)}
.dgp-unpin{position:absolute;right:5px;top:9px;display:flex;align-items:center;justify-content:center;width:28px;height:28px;padding:6px;border-radius:var(--dsw-radius-md,6px);opacity:0;pointer-events:none}.dgp-row:hover .dgp-unpin,.dgp-row:focus-within .dgp-unpin{opacity:1;pointer-events:auto}.dgp-unpin:hover{background:var(--dsw-alias-interactive-bg-hover,var(--dsw-alias-bg-layer-3,var(--dsw-alias-bg-base)))}.dgp-region button:focus-visible{outline:var(--dsw-focus-ring-width,2px) solid var(--dsw-focus-ring-color,var(--dsw-alias-state-business-primary));outline-offset:-2px}.dgp-error{flex:none;display:flex;align-items:start;gap:4px;padding:4px 10px;font-size:12px;color:var(--dsw-alias-state-error-primary)}.dgp-error button{flex:none;min-width:24px;min-height:24px;font-size:16px}.dgp-error span{flex:1}
@media(hover:none),(pointer:coarse){.dgp-unpin{opacity:1;pointer-events:auto}}
`;
  const Pin = () => h('svg', { className: 'dgp-icon', viewBox: '0 0 20 20', fill: 'none', stroke: 'currentColor', strokeWidth: 1.4, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true }, h('path', { d: 'm7 3 7 0-1 5 3 3H4l3-3V3Zm3 8v6' }));

  // An additive portal is necessary until the host exposes an insertion seat.
  // Only the plugin-owned sibling is changed; the native browser stays mounted.
  function attachHost(doc, environment, publish) {
    const host = doc.createElement('div');
    host.className = 'dgp-mount';
    Object.assign(host.style, { flex: '0 0 auto', minHeight: '0', overflow: 'hidden' });
    let anchor = null, parent = null, published = null, live = true;
    const expose = value => { if (published !== value) { published = value; publish(value); } };
    const measure = () => {
      if (!parent) return;
      const bounds = parent.getBoundingClientRect();
      const display = bounds.width >= 160 ? '' : 'none';
      const maxHeight = `${Math.min(240, Math.max(0, Math.floor(bounds.height * 0.4)))}px`;
      if (host.style.display !== display) host.style.display = display;
      if (host.style.maxHeight !== maxHeight) host.style.maxHeight = maxHeight;
    };
    const resize = environment.ResizeObserver ? new environment.ResizeObserver(measure) : null;
    const reconcile = () => {
      if (!live) return;
      const next = doc.querySelector('[data-slot="sidebar.workspaces"]');
      const nextParent = next?.parentElement ?? null;
      if (nextParent !== parent) {
        resize?.disconnect();
        parent = nextParent;
        if (parent) resize?.observe(parent);
      }
      anchor = next;
      if (!parent) {
        if (host.parentNode) host.remove();
        expose(null);
        return;
      }
      // Check first: unconditional insertBefore would trigger our own observer forever.
      if (host.parentNode !== parent || host.nextSibling !== anchor) parent.insertBefore(host, anchor);
      measure();
      expose(host);
    };
    const mutations = new environment.MutationObserver(() => {
      // Streaming content elsewhere must not trigger a document query or sync layout.
      // Geometry changes are handled independently by ResizeObserver/window resize.
      if (anchor?.isConnected && anchor.parentElement === parent && host.parentNode === parent && host.nextSibling === anchor) return;
      reconcile();
    });
    mutations.observe(doc.body, { childList: true, subtree: true });
    environment.addEventListener('resize', measure);
    reconcile();
    return () => {
      live = false;
      mutations.disconnect();
      resize?.disconnect();
      environment.removeEventListener('resize', measure);
      host.remove();
    };
  }

  function PinRow({ session, workspace, active, useSessionAccess, uiWorkspace, onError, t }) {
    const allowed = useSessionAccess(session.id, 'workspace/unpinSession');
    const [pending, setPending] = useState(false);
    const busy = useRef(false), alive = useRef(false);
    useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
    const act = async kind => {
      if (busy.current) return;
      busy.current = true;
      setPending(true);
      try {
        await uiWorkspace[kind === 'unpin' ? 'unpinSession' : 'openSession'](session.id);
      } catch {
        if (alive.current) onError(kind === 'unpin' ? 'unpinError' : 'openError');
      } finally {
        busy.current = false;
        if (alive.current) setPending(false);
      }
    };
    const title = session.displayTitle?.trim() || t('untitled');
    return h('li', { className: 'dgp-row', 'data-active': active },
      h('button', { type: 'button', className: 'dgp-open', disabled: pending, 'aria-current': active ? 'page' : undefined, title: `${title}\n${workspace}`, onClick: () => act('open') },
        h('span', { className: 'dgp-title' }, title), h('span', { className: 'dgp-workspace' }, workspace)),
      allowed && h('button', { type: 'button', className: 'dgp-unpin', disabled: pending, title: t('unpin'), 'aria-label': `${t('unpin')}: ${title}`, onClick: () => act('unpin') }, h(Pin)));
  }

  function GlobalPins({ useWorkspaces, useSessions, usePanelInfo, useSessionAccess, t, uiWorkspace }) {
    const pinned = useWorkspaces(state => state.pinnedSessionIds);
    const archived = useWorkspaces(state => state.archivedSessionIds);
    const workspaces = useWorkspaces(state => state.items);
    const byId = useSessions(state => state.byId);
    const panelActive = usePanelInfo(info => info.activePanelId !== null);
    const [host, setHost] = useState(null), [error, setError] = useState('');
    useEffect(() => attachHost(document, window, setHost), []);
    const excluded = new Set(archived), seen = new Set();
    const sessions = pinned.filter(id => {
      if (seen.has(id) || excluded.has(id) || !byId[id]) return false;
      seen.add(id);
      return true;
    }).map(id => byId[id]);
    const current = panelActive ? undefined : Object.values(byId).find(session => (session.retainedBy.mainView ?? 0) > 0)?.id;
    if (!host || !sessions.length) return null;
    return createPortal(h(React.Fragment, null, h('style', null, css),
      h('section', { className: 'dgp-region', 'aria-label': t('regionLabel') },
        h('header', { className: 'dgp-header' }, h(Pin), h('h2', null, t('title')), h('span', { className: 'dgp-count' }, sessions.length)),
        error && h('div', { className: 'dgp-error', role: 'alert' }, h('span', null, t(error)), h('button', { type: 'button', 'aria-label': t('dismiss'), onClick: () => setError('') }, h('svg', { className: 'dgp-icon', viewBox: '0 0 20 20', fill: 'none', stroke: 'currentColor', strokeWidth: 1.4, strokeLinecap: 'round', 'aria-hidden': true }, h('path', { d: 'm5 5 10 10M15 5 5 15' })))),
        h('ul', { className: 'dgp-list' }, ...sessions.map(session => {
          const workspace = workspaces.find(item => item.sessionIds.includes(session.id));
          const label = workspace?.title?.trim() || t('ungrouped');
          return h(PinRow, { key: session.id, session, workspace: label, active: session.id === current, useSessionAccess, uiWorkspace, onError: setError, t });
        })))), host);
  }

  return { inject: ['slots', 'locale', 'uiWorkspace'], apply(ctx) {
    for (const [language, dictionary] of Object.entries(dictionaries)) ctx.effect(() => ctx.locale.register(namespace, language, dictionary));
    ctx.slots.inject('shell.overlay', () => ctx.slots.register({ name: 'shell.overlay', id: 'delthin.globalPins', locale: namespace }, props => h(GlobalPins, { ...props, uiWorkspace: ctx.uiWorkspace })));
  } };
} });
