window.__ModuleLoader__.load({
  id: 'dsh-feishu-notify',
  factory(require) {
    const React = require('react');
    const h = React.createElement;
    const dictionaries = {
      zh: {
        title: '飞书提醒', intro: '由宿主发送提醒。关闭浏览器后，仍可收到需要你处理、回复完成、出错和中断的通知。',
        enabled: '启用飞书提醒', credentials: '自建应用', appId: 'App ID', appSecret: 'App Secret', receiveId: '接收 ID',
        secretHint: '已保存的密钥只显示 ***；保持不变即保留原密钥。', receiveHint: 'ou_ 开头按 open_id 发送；oc_ 开头按 chat_id 发送到已有私聊。',
        quiet: '安静时段', quietEnabled: '在指定时间内暂停自动提醒', start: '开始', end: '结束', zone: '时区', quietHint: '支持跨午夜。测试消息不受总开关和安静时段限制。',
        save: '保存设置', saving: '保存中…', test: '发送测试消息', testing: '发送中…', refresh: '刷新记录', loading: '正在读取设置…',
        saved: '设置已保存。', tested: '飞书已接受测试消息，请查看私聊。', dirty: '有未保存的修改；请先保存，再发送测试。',
        results: '最近发送结果', empty: '还没有发送记录。保存应用信息后，可发送一条测试消息。', success: '发送成功', failure: '发送失败', skipped: '已跳过',
        profile: '配置所属 profile', testKind: '测试', requestKind: '需要你', completedKind: '回复完成', errorKind: '出错', interruptedKind: '被中断',
        requestFailed: '请求失败，请重试。', invalidJson: '宿主返回了无效响应。', retry: '重新读取',
      },
      en: {
        title: 'Feishu notifications', intro: 'Sent by the host, even when the browser is closed. Get requests for input, completed replies, errors and interruptions.',
        enabled: 'Enable Feishu notifications', credentials: 'Custom application', appId: 'App ID', appSecret: 'App Secret', receiveId: 'Recipient ID',
        secretHint: 'Saved secrets appear as ***. Leave this unchanged to keep the current secret.', receiveHint: 'ou_ uses open_id; oc_ uses chat_id to send to the existing private conversation.',
        quiet: 'Quiet hours', quietEnabled: 'Pause automatic notifications during these hours', start: 'From', end: 'Until', zone: 'Time zone', quietHint: 'Overnight ranges are supported. Tests bypass the main switch and quiet hours.',
        save: 'Save settings', saving: 'Saving…', test: 'Send test message', testing: 'Sending…', refresh: 'Refresh results', loading: 'Loading settings…',
        saved: 'Settings saved.', tested: 'Feishu accepted the test message. Check your conversation.', dirty: 'Unsaved changes. Save before sending a test.',
        results: 'Recent deliveries', empty: 'No deliveries yet. Save your application details, then send a test message.', success: 'Sent', failure: 'Failed', skipped: 'Skipped',
        profile: 'Configuration profile', testKind: 'Test', requestKind: 'Input needed', completedKind: 'Reply completed', errorKind: 'Error', interruptedKind: 'Interrupted',
        requestFailed: 'Request failed. Please try again.', invalidJson: 'The host returned an invalid response.', retry: 'Reload settings',
      },
    };
    const styles = `
      .feishu-settings{color:var(--dsw-alias-label-primary);font:inherit;max-width:680px;margin:auto;padding:24px;box-sizing:border-box}
      .feishu-settings h2{font-size:20px;line-height:1.4;margin:0 0 8px;font-weight:600}
      .feishu-settings p{line-height:1.6;margin:0 0 16px}
      .feishu-settings .fs-muted{color:var(--dsw-alias-label-secondary);font-size:13px}
      .feishu-settings fieldset{border:0;border-top:1px solid var(--dsw-alias-border-l1);margin:24px 0 0;padding:20px 0 0;min-width:0}
      .feishu-settings legend{padding:0 8px 0 0;font-size:15px;font-weight:600}
      .feishu-settings label.fs-field{display:grid;gap:6px;margin-bottom:16px;font-size:14px}
      .feishu-settings input:not([type=checkbox]){box-sizing:border-box;width:100%;min-width:0;border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-base);color:inherit;border-radius:6px;padding:9px 10px;font:inherit;caret-color:var(--dsw-alias-brand-primary)}
      .feishu-settings input[type=checkbox]{width:17px;height:17px;accent-color:var(--dsw-alias-brand-primary);flex-shrink:0}
      .feishu-settings .fs-check{display:flex;gap:10px;align-items:center;min-height:40px;font-size:14px}
      .feishu-settings .fs-times{display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-top:12px}
      .feishu-settings .fs-actions{display:flex;gap:10px;flex-wrap:wrap;margin:24px 0 12px}
      .feishu-settings button{border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-1);color:inherit;border-radius:6px;padding:9px 14px;font:inherit;font-size:13px;cursor:pointer;min-height:36px}
      .feishu-settings button:hover:not(:disabled){background:var(--dsw-alias-bg-layer-2)}
      .feishu-settings button.fs-primary{border-color:var(--dsw-alias-brand-primary);font-weight:600}
      .feishu-settings :is(input,button):focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:3px}
      .feishu-settings :disabled{opacity:.55;cursor:not-allowed}
      .feishu-settings .fs-error{color:var(--dsw-alias-state-error-primary);overflow-wrap:anywhere}
      .feishu-settings .fs-success{color:var(--dsw-alias-state-success-primary)}
      .feishu-settings .fs-results-heading{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-top:28px}
      .feishu-settings h3{font-size:15px;font-weight:600;margin:0}
      .feishu-settings ul{list-style:none;padding:0;margin:12px 0}
      .feishu-settings li{padding:12px 0;border-top:1px solid var(--dsw-alias-border-l1);font-size:13px;overflow-wrap:anywhere}
      .feishu-settings .fs-result-top{display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap;margin-bottom:4px}
      .feishu-settings time{font-variant-numeric:tabular-nums;color:var(--dsw-alias-label-secondary)}
      @media(max-width:540px){.feishu-settings{padding:16px}.feishu-settings .fs-times{gap:10px}.feishu-settings .fs-actions button{flex:1}}
    `;
    return {
      inject: ['slots', 'locale'],
      apply(ctx) {
        const locale = ctx.locale;
        for (const [lang, dict] of Object.entries(dictionaries)) {
          ctx.effect(() => locale.register('dsh-feishu-notify', lang, dict));
        }
        const t = locale.bind('dsh-feishu-notify');
        function Settings() {
          React.useSyncExternalStore(cb => locale.subscribe(cb), () => locale.getSnapshot());
          const [snapshot, setSnapshot] = React.useState(null);
          const [form, setForm] = React.useState(null);
          const [baseline, setBaseline] = React.useState(null);
          const [busy, setBusy] = React.useState('loading');
          const [error, setError] = React.useState('');
          const [notice, setNotice] = React.useState('');
          const mounted = React.useRef(true);
          const controllers = React.useRef(new Set());
          const dirty = form && baseline && JSON.stringify(form) !== JSON.stringify(baseline);
          async function request(path = '', method = 'GET', body) {
            const controller = new AbortController();
            controllers.current.add(controller);
            const timer = setTimeout(() => controller.abort(), 60000);
            try {
              const response = await fetch('/api/feishu-notify' + path, {
                method, credentials: 'same-origin', signal: controller.signal,
                headers: { 'Content-Type': 'application/json' },
                ...(body === undefined ? {} : { body: JSON.stringify(body) }),
              });
              const data = await response.json().catch(() => { throw new Error(t('invalidJson')); });
              if (!response.ok || data.error) {
                const detail = data.error;
                throw new Error(detail && typeof detail === 'object'
                  ? [detail.code !== undefined ? '[' + detail.code + ']' : '', detail.message].filter(Boolean).join(' ')
                  : detail || t('requestFailed'));
              }
              return data;
            } finally { clearTimeout(timer); controllers.current.delete(controller); }
          }
          async function load(initial = false) {
            setBusy('loading'); setError('');
            try {
              const data = await request();
              if (mounted.current) {
                setSnapshot(data);
                if (initial || !dirty) { setForm(data.config); setBaseline(data.config); }
              }
            } catch (err) { if (mounted.current) setError(err.message); }
            finally { if (mounted.current) setBusy(''); }
          }
          React.useEffect(() => {
            mounted.current = true; void load(true);
            return () => { mounted.current = false; for (const c of controllers.current) c.abort(); };
          }, []);
          async function save(event) {
            event.preventDefault(); setBusy('save'); setError(''); setNotice('');
            try {
              const patch = {};
              for (const key of ['appId', 'appSecret', 'receive_id', 'enabled']) {
                if (form[key] !== baseline[key]) patch[key] = form[key];
              }
              const quietPatch = {};
              for (const key of ['enabled', 'start', 'end', 'timeZone']) {
                if (form.quietHours[key] !== baseline.quietHours[key]) quietPatch[key] = form.quietHours[key];
              }
              if (Object.keys(quietPatch).length) patch.quietHours = quietPatch;
              const data = await request('', 'PUT', patch);
              if (mounted.current) { setSnapshot(data); setForm(data.config); setBaseline(data.config); setNotice('saved'); }
            } catch (err) { if (mounted.current) setError(err.message); }
            finally { if (mounted.current) setBusy(''); }
          }
          async function test() {
            setBusy('test'); setError(''); setNotice('');
            try { await request('/test', 'POST', {}); if (mounted.current) setNotice('tested'); }
            catch (err) { if (mounted.current) setError(err.message); }
            finally {
              try { const data = await request(); if (mounted.current) { setSnapshot(data); setForm(data.config); setBaseline(data.config); } } catch { /* Keep the original delivery error. */ }
              if (mounted.current) setBusy('');
            }
          }
          const change = (name, value) => { setForm(f => ({ ...f, [name]: value })); setNotice(''); };
          const quietChange = (name, value) => setForm(f => ({ ...f, quietHours: { ...f.quietHours, [name]: value } }));
          const field = (name, label, type = 'text', hint) => h('label', { className: 'fs-field', key: name },
            t(label), h('input', { name, type: name === 'appSecret' && form[name] === '***' ? 'text' : type, value: form[name], disabled: Boolean(busy), autoComplete: 'off', spellCheck: false,
              required: true, onChange: e => change(name, e.target.value), 'aria-describedby': hint ? 'fs-' + hint : undefined }),
            hint && h('span', { className: 'fs-muted', id: 'fs-' + hint }, t(hint)));
          const resultLabel = kind => ({ test: 'testKind', approval: 'requestKind', question: 'requestKind', plan: 'requestKind', request: 'requestKind', completed: 'completedKind', error: 'errorKind', interrupted: 'interruptedKind' }[kind] || 'requestKind');
          return h('section', { className: 'feishu-settings', 'aria-label': t('title') },
            h('style', null, styles), h('h2', null, t('title')), h('p', { className: 'fs-muted' }, t('intro')),
            error && h('p', { className: 'fs-error', role: 'alert' }, error),
            !form ? h('div', null, busy ? h('p', { role: 'status' }, t('loading')) : h('button', { onClick: () => load(true) }, t('retry'))) :
            h(React.Fragment, null,
              h('form', { onSubmit: save },
                h('label', { className: 'fs-check' }, h('input', { type: 'checkbox', checked: form.enabled, disabled: Boolean(busy), onChange: e => change('enabled', e.target.checked) }), t('enabled')),
                h('fieldset', null, h('legend', null, t('credentials')),
                  field('appId', 'appId'), field('appSecret', 'appSecret', 'password', 'secretHint'), field('receive_id', 'receiveId', 'text', 'receiveHint')),
                h('fieldset', null, h('legend', null, t('quiet')),
                  h('label', { className: 'fs-check' }, h('input', { type: 'checkbox', checked: form.quietHours.enabled, disabled: Boolean(busy), onChange: e => quietChange('enabled', e.target.checked) }), t('quietEnabled')),
                  h('div', { className: 'fs-times' }, ...['start', 'end'].map(name => h('label', { className: 'fs-field', key: name }, t(name),
                    h('input', { type: 'time', value: form.quietHours[name], required: form.quietHours.enabled, disabled: Boolean(busy) || !form.quietHours.enabled, onChange: e => quietChange(name, e.target.value) })))),
                  h('label', { className: 'fs-field' }, t('zone'), h('input', { value: form.quietHours.timeZone, disabled: Boolean(busy) || !form.quietHours.enabled, required: form.quietHours.enabled, placeholder: 'Asia/Shanghai', onChange: e => quietChange('timeZone', e.target.value) })),
                  h('p', { className: 'fs-muted' }, t('quietHint'))),
                h('div', { className: 'fs-actions' }, h('button', { className: 'fs-primary', type: 'submit', disabled: Boolean(busy) || !dirty }, t(busy === 'save' ? 'saving' : 'save')),
                  h('button', { type: 'button', disabled: Boolean(busy) || Boolean(dirty) || !form.appId || !form.appSecret || !form.receive_id, onClick: test }, t(busy === 'test' ? 'testing' : 'test'))),
                dirty && h('p', { className: 'fs-muted' }, t('dirty')),
                notice && h('p', { className: 'fs-success', role: 'status' }, t(notice))),
              h('div', { className: 'fs-results-heading' }, h('h3', null, t('results')), h('button', { disabled: Boolean(busy), onClick: () => load(false) }, t('refresh'))),
              !snapshot.results?.length ? h('p', { className: 'fs-muted' }, t('empty')) : h('ul', null, snapshot.results.map((result, index) => {
                const ok = result.ok ?? result.status === 'success';
                const skipped = result.status === 'skipped';
                const statusClass = skipped ? 'fs-muted' : ok ? 'fs-success' : 'fs-error';
                const date = new Date(result.time ?? result.at);
                return h('li', { key: result.id || index }, h('div', { className: 'fs-result-top' },
                  h('span', { className: statusClass }, t(skipped ? 'skipped' : ok ? 'success' : 'failure') + ' · ' + t(resultLabel(result.kind || result.type))),
                  h('time', { dateTime: Number.isNaN(date.getTime()) ? undefined : date.toISOString() }, Number.isNaN(date.getTime()) ? '' : date.toLocaleString())),
                  !ok && h('div', { className: statusClass }, [result.code !== undefined ? '[' + result.code + ']' : '', result.error?.message || result.error || result.message].filter(Boolean).join(' ')));
              })),
              h('p', { className: 'fs-muted' }, t('profile') + ': ' + (snapshot.profile?.name || ''))));
        }
        ctx.slots.inject('settings.section', () => ctx.slots.register({
          name: 'settings.section', id: 'dsh-feishu-notify', order: 46, label: () => t('title'),
        }, Settings));
      },
    };
  },
});
