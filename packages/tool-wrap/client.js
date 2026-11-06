window.__ModuleLoader__.load({id:'@delthin/dsh-tool-wrap',
  factory(require) {
    const React = require('react');
    const h = React.createElement;
    const dictionaries = {
      zh: {
        compositionEnable: '启用提示词编排', compositionDefault: '恢复提示词默认', compositionDefaultDraft: '提示词默认值已恢复为草稿，保存后生效。', compositionMissing: '宿主尚未提供提示词来源，工具设置仍可使用。', compositionScope: '组设置作用于组内提示词，展开后可逐项覆盖；暂未出现的来源仍保留设置。', compositionOrderHint: '系统消息与用户消息分别排序；“随工具包”在解包时加载。', compositionInactive: '尚未启用编排，角色、加载和顺序设置暂不生效。', globalInstructions: '全局 AGENTS', projectInstructions: '项目 AGENTS', unattributedSources: '其他注入来源', noToolGeneration: '当前没有可用于生成简介的工具，可直接编辑简介。', unattributedPack: '尚未确认所属插件，可调整角色与顺序，暂不随工具包加载。', role: '消息角色', delivery: '加载方式', order: '顺序', inherit: '继承', inheritGroup: '继承组设置', system: '系统', user: '用户', developer: '开发者', always: '始终加载', pack: '随工具包', moveUp: '上移', moveDown: '下移', sources: '来源', sourceCount: '{count} 段提示词', sourceTools: '{count} 个工具', sourceDetails: '展开来源与工具', hideDetails: '收起来源与工具', noPrompt: '此来源只有工具，没有可编排的提示词。', childOnly: '请展开后逐项设置。', savedUnavailable: '已存设置当前不可用', partialSaved: '部分设置已保存，失败部分仍保留草稿。', toolsSettings: '工具设置', promptSettings: '提示词设置', hostRequired: '宿主未启用编排适配；角色与加载暂不可调整。', sourceRequired: '来源未确认，暂不可调整。', entryAlways: '入口目录需保持常驻。', personaAlways: '完整身份提示词需保持常驻。', sourceUnavailable: '来源当前不可用，已保存配置保留。',
        panel: '工具与提示词', title: '工具与提示词', intro: '在同一处管理工具选择、提示词角色、加载方式与顺序。',
        enabled: '启用按需发现', scope: '保存后，使用当前配置的各会话会在后续请求采用新设置；正在运行的请求不会回溯修改。',
        groups: '插件', groupHint: '勾选插件，包含其今后新增的工具；展开可调整单段提示词或排除工具。', search: '搜索来源或工具', noResults: '没有匹配的来源或工具。', selectedTools: '已选 / 工具数', collapse: '收起工具', help: '工作原理与占用统计', catalogSummary: '{plugins} 个来源 · {tools} 个工具', hiddenHint: '没有工具或提示词的条目不展示，原有选择保留。',
        selected: '已选 {selected} / {total}', expand: '查看工具', emptyCatalog: '当前没有可选的全局工具。',
        otherTools: '未识别来源的工具', otherToolsHint: '这些全局工具尚无插件来源记录，只能逐项选择。',
        coverage: '来源已识别：{known} 个工具；未识别：{unknown} 个工具。', warnings: '目录提示',
        save: '保存设置', saving: '保存中…', cancel: '取消更改', saved: '设置已保存。', cancelled: '已取消未保存的更改。',
        dirty: '有未保存的更改', loading: '正在读取设置…', refreshing: '刷新中…', refresh: '刷新', retry: '重新读取',
        observations: '占用统计', estimate: '工具说明大小（全局工具）', before: '精简前', after: '精简后', savedChars: '已节省', hidden: '已收起工具',
        chars: '{value} 字符', tokens: '约 {value} token（字符数 ÷ 4）', tokenHint: '按字符数比较工具说明，不含会话单独提供的工具。',
        observationHint: 'token 按字符数 ÷ 4 估算，仅供参考。文本指纹用于核对工具说明是否变化。',
        lastAssembly: '最近一次记录', noAssembly: '还没有记录。', mode: '调用模式', status: '内部状态', hash: '文本校验值', calls: '查找工具次数（本次服务运行）',
        recordScope: '记录来自最近处理的会话，不一定是当前会话；仅统计工具说明。', diagnostics: '原理与核查信息', tokensLabel: '预计节省 token',
        discoveryFlow: 'unwrap({plugin: 精确插件名}) 直接返回该插件在当前会话中的整包原始工具定义，再调用原工具。不做关键词检索。',
        summaryRule: '优先使用开发者说明；缺失时可生成简介草稿。简介可编辑，保存后生效。',
        description: '插件简介', developerSource: '开发者说明', customSource: '自定义简介', missingSource: '缺少简介', missingDescription: '开发者未提供说明，可自行填写或生成草稿。',
        restoreDescription: '恢复开发者说明', descriptionLimit: '最多 2000 字符；清空后删除自定义简介。',
        generationModel: '生成简介所用模型', chooseModel: '请选择模型', generate: '生成简介', generating: '生成中…', cancelGeneration: '取消生成',
        generationHint: '使用所选模型生成，会发送当前可见的工具名称和说明，可能产生调用费用。', noModels: '请先配置并连接模型，再生成简介。',
        generatedDraft: '简介草稿已生成，可继续编辑；保存后生效。', generationCancelled: '已取消生成，原草稿保留。',
        nativeUnchanged: '此次使用原生模式，工具说明保持完整。', discoveryDisabled: '此次未启用按需发现，工具说明保持完整。', notApplied: '此次工具说明保持完整，具体状态见下方核查信息。',
        ptc: 'PTC', native: '原生', requestFailed: '请求失败，请重试。', invalidJson: '宿主返回了无效响应，请重新读取。',
        networkError: '无法读取宿主响应，请检查连接后重试。', timeout: '请求超时，请重试。', restartRequired: '更新需重启服务：简介编辑需要配置版本 3，请重启 DSH 后重新读取。',
      },
      en: {
        compositionEnable: 'Enable prompt composition', compositionDefault: 'Reset prompt defaults', compositionDefaultDraft: 'Prompt defaults restored as a draft. Save to apply.', compositionMissing: 'The host has not provided prompt sources. Tool settings remain available.', compositionScope: 'Group rules apply to their prompt sources; expand to override individual sources. Settings for absent sources are retained.', compositionOrderHint: 'System and user messages are ordered separately. With tool pack loads the text when unwrapped.', compositionInactive: 'Composition is off. Role, loading and ordering changes are not applied yet.', globalInstructions: 'Global AGENTS', projectInstructions: 'Project AGENTS', unattributedSources: 'Other injected sources', noToolGeneration: 'No tool descriptions are currently available for generation. You can edit the description directly.', unattributedPack: 'Plugin ownership is unconfirmed. Role and ordering remain editable, but pack delivery is unavailable.', role: 'Message role', delivery: 'Loading', order: 'Order', inherit: 'Inherit', inheritGroup: 'Inherit group', system: 'System', user: 'User', developer: 'Developer', always: 'Always', pack: 'With tool pack', moveUp: 'Move up', moveDown: 'Move down', sources: 'Sources', sourceCount: '{count} prompt sections', sourceTools: '{count} tools', sourceDetails: 'Expand sources and tools', hideDetails: 'Collapse sources and tools', noPrompt: 'This source has tools only, with no prompt to compose.', childOnly: 'Expand to configure individual sources.', savedUnavailable: 'Saved setting currently unavailable', partialSaved: 'Some settings were saved. Failed changes remain as a draft.', toolsSettings: 'Tool settings', promptSettings: 'Prompt settings', hostRequired: 'Host composition support is not enabled; roles and loading cannot be changed.', sourceRequired: 'Source is unconfirmed and cannot be changed.', entryAlways: 'The entrypoint directory must remain always loaded.', personaAlways: 'Complete persona instructions must remain always loaded.', sourceUnavailable: 'Source is currently unavailable. Saved configuration is retained.',
        panel: 'Tools and prompts', title: 'Tools and prompts', intro: 'Manage tool selection, prompt roles, loading and order in one place.',
        enabled: 'Enable on-demand discovery (PTC only)', scope: 'Saved settings apply to subsequent requests in conversations using this configuration. In-flight requests are not changed retroactively.',
        groups: 'Plugins', groupHint: 'Selecting a plugin includes future tools. Expand to configure individual prompt sources or exclude tools.', search: 'Search sources or tools', noResults: 'No matching sources or tools.', selectedTools: 'Selected / tools', collapse: 'Hide tools', help: 'How it works and context size', catalogSummary: '{plugins} sources · {tools} tools', hiddenHint: 'Entries without tools or prompts are hidden. Existing selections are preserved.',
        selected: '{selected} / {total} selected', expand: 'View tools', emptyCatalog: 'No global tools are currently available to select.',
        otherTools: 'Tools with unidentified sources', otherToolsHint: 'These global tools have no recorded plugin source and can only be selected individually.',
        coverage: 'Identified sources: {known} tools; unidentified: {unknown} tools.', warnings: 'Catalog notices',
        save: 'Save settings', saving: 'Saving…', cancel: 'Cancel changes', saved: 'Settings saved.', cancelled: 'Unsaved changes cancelled.',
        dirty: 'Unsaved changes', loading: 'Loading settings…', refreshing: 'Refreshing…', refresh: 'Refresh', retry: 'Reload settings',
        observations: 'Context size', estimate: 'Tool description size (global tools)', before: 'Before', after: 'After', savedChars: 'Saved', hidden: 'Tools deferred',
        chars: '{value} characters', tokens: 'About {value} tokens (characters ÷ 4)', tokenHint: 'Compares tool description character counts, excluding tools provided separately by each conversation.',
        observationHint: 'Tokens are estimated as characters ÷ 4, for reference only. The text checksum helps check whether tool descriptions have changed.',
        lastAssembly: 'Latest record', noAssembly: 'No record yet.', mode: 'Tool mode', status: 'Internal status', hash: 'Text checksum', calls: 'Tool lookups (this service run)',
        recordScope: 'This record may come from another conversation. It measures tool descriptions only.', diagnostics: 'How it works and verification', tokensLabel: 'Estimated tokens saved',
        discoveryFlow: 'unwrap({plugin: exact plugin name}) returns the plugin’s complete original tool definitions for the current conversation, ready to call. No keyword search.',
        summaryRule: 'Use the developer description first. If missing, generate a draft. Descriptions can be edited and take effect after saving.',
        description: 'Plugin description', developerSource: 'Developer description', customSource: 'Custom description', missingSource: 'No description', missingDescription: 'The developer has not provided a description. Write one or generate a draft.',
        restoreDescription: 'Restore developer description', descriptionLimit: 'Up to 2000 characters. Clear to remove the custom description.',
        generationModel: 'Model for description generation', chooseModel: 'Choose a model', generate: 'Generate description', generating: 'Generating…', cancelGeneration: 'Cancel generation',
        generationHint: 'Uses the selected model and sends the currently visible tool names and descriptions. Usage charges may apply.', noModels: 'Configure and connect a model before generating a description.',
        generatedDraft: 'Description draft generated. Edit as needed, then save to apply.', generationCancelled: 'Generation cancelled. Your previous draft is unchanged.',
        nativeUnchanged: 'This conversation used native mode. Tool descriptions were kept in full.', discoveryDisabled: 'On-demand discovery was off. Tool descriptions were kept in full.', notApplied: 'Tool descriptions were kept in full. See the verification details below.',
        ptc: 'PTC', native: 'Native', requestFailed: 'Request failed. Please try again.', invalidJson: 'The host returned an invalid response. Reload settings.',
        networkError: 'Could not read the host response. Check your connection and try again.', timeout: 'Request timed out. Please try again.', restartRequired: 'The host is still running the previous version. This update requires a service restart: restart DSH for configuration version 3, then reload settings.',
      },
    };
    const styles = `
      .td-settings{container-type:inline-size;color:var(--dsw-alias-label-primary);font:inherit;max-width:1040px;margin:auto;padding:24px;box-sizing:border-box;overflow-wrap:anywhere}
      .td-settings h2{font-size:20px;line-height:1.4;margin:0 0 4px;font-weight:600}
      .td-settings p{line-height:1.5;margin:0 0 12px}
      .td-settings .td-muted{color:var(--dsw-alias-label-secondary);font-size:13px}
      .td-settings input[type=checkbox]{width:16px;height:16px;accent-color:var(--dsw-alias-brand-primary);flex-shrink:0;margin:0}
      .td-settings .td-check{display:flex;gap:10px;align-items:center;min-height:32px;font-size:13px;cursor:pointer;min-width:0}
      .td-settings .td-enable{padding:8px 0 12px;font-weight:600}
      .td-settings fieldset{border:0;margin:0;padding:0;min-width:0}
      .td-settings legend{position:absolute;width:1px;height:1px;overflow:hidden;clip-path:inset(50%)}
      .td-settings .td-toolbar{display:flex;align-items:center;gap:16px;margin:0 0 8px}
      .td-settings input[type=search]{min-width:0;flex:1;max-width:420px;height:36px;border:1px solid var(--dsw-alias-border-l2);border-radius:6px;background:var(--dsw-alias-bg-base);color:inherit;font:inherit;font-size:13px;padding:6px 10px;caret-color:var(--dsw-alias-brand-primary)}
      .td-settings input[type=search]::placeholder{color:var(--dsw-alias-label-secondary);opacity:1}
      .td-settings .td-summary{margin-left:auto;white-space:nowrap;font-variant-numeric:tabular-nums}
      .td-settings .td-list-head,.td-settings .td-group-top{display:grid;grid-template-columns:minmax(0,1fr) 88px minmax(260px,320px) 32px;gap:12px;align-items:center}
      .td-settings .td-list-head{border-bottom:1px solid var(--dsw-alias-border-l1);padding:8px 4px;font-size:12px;color:var(--dsw-alias-label-secondary)}
      .td-settings .td-group{border-bottom:1px solid var(--dsw-alias-border-l1)}
      .td-settings .td-group-top{min-height:44px;padding:0 4px}
      .td-settings .td-group-top:hover{background:var(--dsw-alias-bg-layer-1)}
      .td-settings .td-plugin-name{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
      .td-settings .td-count{text-align:right;font-size:13px;font-variant-numeric:tabular-nums;white-space:nowrap}
      .td-settings .td-expand{padding:0;min-width:32px;height:32px;display:grid;place-items:center;border-color:transparent;background:transparent}
      .td-settings .td-expand svg{transition:none}
      .td-settings .td-tool-list{list-style:none;margin:0;padding:4px 8px 8px 30px;background:var(--dsw-alias-bg-layer-1)}
      .td-settings .td-description{padding:12px 16px 8px 30px;background:var(--dsw-alias-bg-layer-1);font-size:13px;min-width:0}
      .td-settings .td-description label{display:block;font-weight:600;margin-bottom:6px}
      .td-settings .td-description textarea{display:block;box-sizing:border-box;width:100%;max-width:100%;min-height:88px;resize:vertical;border:1px solid var(--dsw-alias-border-l2);border-radius:6px;background:var(--dsw-alias-bg-base);color:inherit;font:inherit;line-height:1.5;padding:8px;caret-color:var(--dsw-alias-brand-primary)}
      .td-settings .td-description p{margin:6px 0}
      .td-settings .td-description-actions{display:flex;align-items:center;flex-wrap:wrap;gap:8px;margin:8px 0;min-width:0}
      .td-settings .td-description select{box-sizing:border-box;min-width:0;max-width:100%;flex:1 1 180px;border:1px solid var(--dsw-alias-border-l2);border-radius:6px;background:var(--dsw-alias-bg-base);color:inherit;font:inherit;padding:6px;min-height:32px}
      .td-settings .td-description button{white-space:normal;overflow-wrap:anywhere;max-width:100%}
      .td-settings .td-tool-list li+li{border-top:1px solid var(--dsw-alias-border-l1)}
      .td-settings .td-tool{padding:6px 0;align-items:flex-start;line-height:1.5}
      .td-settings .td-tool input{margin-top:2px}
      .td-settings .td-tool-text{display:grid;grid-template-columns:minmax(140px,1fr) minmax(0,2fr);gap:12px;min-width:0;width:100%}
      .td-settings .td-tool-description{display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
      .td-settings code{font:inherit;overflow-wrap:anywhere}
      .td-settings .td-actions{position:sticky;bottom:0;z-index:1;display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin:0;padding:12px 0;background:var(--dsw-alias-bg-base);border-bottom:1px solid var(--dsw-alias-border-l1)}
      .td-settings .td-feedback{flex:1;min-width:100px;margin:0;font-size:13px}
      .td-settings button{border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-1);color:inherit;border-radius:6px;padding:6px 12px;font:inherit;font-size:13px;cursor:pointer;min-height:32px}
      .td-settings button:hover:not(:disabled){background:var(--dsw-alias-bg-layer-2)}
      .td-settings button.td-primary{border-color:var(--dsw-alias-brand-primary);font-weight:600}
      .td-settings :is(input,button,summary,textarea,select):focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:2px}
      .td-settings ::selection{background:var(--dsw-alias-brand-primary);color:var(--dsw-alias-bg-base)}
      .td-settings :disabled{opacity:.55;cursor:not-allowed}
      .td-settings .td-error{color:var(--dsw-alias-state-error-primary)}
      .td-settings .td-success{color:var(--dsw-alias-state-success-primary)}
      .td-settings .td-empty{padding:20px 4px}
      .td-settings .td-other{margin:12px 0 4px;font-size:13px;font-weight:600}
      .td-settings details{font-size:13px;margin-top:12px}
      .td-settings summary{cursor:pointer;padding:8px 0;min-height:24px;color:var(--dsw-alias-label-secondary)}
      .td-settings .td-heading{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;margin:20px 0 12px}
      .td-settings h3{font-size:14px;font-weight:600;margin:0}
      .td-settings h4{font-size:13px;font-weight:600;margin:16px 0 8px}
      .td-settings dl{font-size:13px;margin:8px 0 12px;font-variant-numeric:tabular-nums}
      .td-settings .td-stat{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1.5fr);gap:12px;padding:6px 0;border-bottom:1px solid var(--dsw-alias-border-l1)}
      .td-settings dt{color:var(--dsw-alias-label-secondary)}
      .td-settings dd{margin:0;text-align:right;min-width:0;overflow-wrap:anywhere}
      .td-settings .td-switches{display:flex;align-items:center;gap:8px 24px;flex-wrap:wrap}
      .td-settings .td-group-identity{min-width:0;padding:6px 0}
      .td-settings .td-source-summary{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;margin-left:26px;font-size:12px;color:var(--dsw-alias-label-secondary)}
      .td-settings .td-group-identity:not(:has(input)) .td-source-summary{margin-left:0}
      .td-settings .td-composition-controls{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr) 60px;gap:6px;align-items:center;min-width:0}
      .td-settings .td-composition-controls select{width:100%;min-width:0;box-sizing:border-box;height:32px;border:1px solid var(--dsw-alias-border-l2);border-radius:6px;background:var(--dsw-alias-bg-base);color:inherit;font:inherit;font-size:13px;padding:4px}
      .td-settings .td-composition-controls .td-readonly{font-size:12px;color:var(--dsw-alias-label-secondary);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
      .td-settings .td-row-order{display:flex;gap:4px}
      .td-settings .td-row-order button{min-width:28px;min-height:32px;padding:4px}
      .td-settings .td-source-list{list-style:none;margin:0;padding:4px 8px 8px 30px;background:var(--dsw-alias-bg-layer-1)}
      .td-settings .td-source-row{display:flex;gap:12px;align-items:center;min-height:44px;padding:4px 0;border-bottom:1px solid var(--dsw-alias-border-l1)}
      .td-settings .td-source-name{flex:1;min-width:0;font-size:13px}
      .td-settings .td-source-row .td-composition-controls{flex:0 1 320px}
      .td-settings .td-source-reason{font-size:12px;color:var(--dsw-alias-label-secondary);margin:4px 0 0}
      @container(max-width:760px){.td-settings .td-toolbar{gap:8px;flex-wrap:wrap}.td-settings .td-summary{margin-left:0}.td-settings .td-list-head,.td-settings .td-group-top{grid-template-columns:minmax(0,1fr) 76px 32px;gap:8px}.td-settings .td-group-top>.td-composition-controls{grid-column:1/-1;grid-row:2;margin-bottom:8px}.td-settings .td-group-top>.td-expand{grid-column:3;grid-row:1}.td-settings .td-list-head>.td-composition-controls{display:none}.td-settings .td-tool-text{grid-template-columns:minmax(0,1fr);gap:2px}.td-settings .td-tool-list,.td-settings .td-source-list{padding-left:16px}.td-settings .td-description{padding-left:16px}.td-settings .td-source-row{flex-wrap:wrap}.td-settings .td-source-row .td-composition-controls{flex:1 1 100%}}
      @media(max-width:540px){.td-settings{padding:16px}}
    `;
    const copyConfig = config => ({ version: 3, enabled: config.enabled, groups: [...config.groups], tools: [...config.tools], exclude: [...config.exclude], descriptions: { ...config.descriptions } });
    const configKey = config => JSON.stringify({ ...copyConfig(config), groups: [...config.groups].sort(), tools: [...config.tools].sort(), exclude: [...config.exclude].sort(), descriptions: Object.entries(config.descriptions).sort(([a], [b]) => a.localeCompare(b)) });
    const validDescriptions = value => value && typeof value === 'object' && !Array.isArray(value) && Object.values(value).every(description => typeof description === 'string' && description.length <= 2000);
    const toggle = (items, value, checked) => checked ? [...new Set([...items, value])] : items.filter(item => item !== value);
    const isSelected = (config, group, name) => (Boolean(group && config.groups.includes(group.id)) || config.tools.includes(name)) && !config.exclude.includes(name);
    const validTools = tools => Array.isArray(tools) && tools.every(tool => tool && typeof tool.name === 'string');
    const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
    const strings = value => Array.isArray(value) && value.every(item => typeof item === 'string');
    const copyComposition = config => ({ version: 1, enabled: config.enabled, order: [...config.order], rules: Object.fromEntries(Object.entries(config.rules).map(([id, rule]) => [id, { ...rule }])) });
    const compositionKey = config => JSON.stringify({ ...copyComposition(config), rules: Object.entries(config.rules).sort(([a], [b]) => a.localeCompare(b)).map(([id, rule]) => [id, rule.role, rule.delivery]) });
    const validComposition = data => data?.config?.version === 1 && typeof data.config.enabled === 'boolean' && strings(data.config.order) && object(data.config.rules) &&
      Object.values(data.config.rules).every(rule => object(rule) && ['inherit', 'system', 'developer', 'user'].includes(rule.role) && ['inherit', 'always', 'pack'].includes(rule.delivery)) &&
      typeof data.capabilities?.admission === 'boolean' && strings(data.capabilities.roles) &&
      Array.isArray(data.sources) && data.sources.every(source => source && ['id', 'label', 'kind'].every(key => typeof source[key] === 'string') && strings(source.roles) && strings(source.deliveryModes) && (source.owner == null || typeof source.owner === 'string'));
    const ordered = (items, key, order) => {
      const ranks = new Map(order.map((id, index) => [id, index]));
      return items.map((item, index) => ({ item, index })).sort((a, b) => (ranks.get(key(a.item)) ?? Infinity) - (ranks.get(key(b.item)) ?? Infinity) || a.index - b.index).map(({ item }) => item);
    };
    // Replace only the moved sibling slots, preserving absent sources and other groups' order.
    const mergeOrder = (previous, siblings) => {
      const ids = new Set(siblings);
      const all = [...previous, ...siblings.filter(id => !previous.includes(id))];
      let index = 0;
      return all.map(id => ids.has(id) ? siblings[index++] : id);
    };
    function sourceRows(snapshot) {
      const sources = snapshot?.promptComposition?.sources || [];
      const rows = new Map();
      for (const source of sources) {
        if (source.kind === 'unavailable') continue;
        const id = source.kind === 'group' ? source.id : source.groupId || source.id;
        let row = rows.get(id);
        if (!row) rows.set(id, row = { id, label: source.groupLabel || source.label, owner: source.owner ?? null, sources: [], policy: null, toolGroup: null });
        if (source.kind === 'group') { row.policy = source; row.label = source.label; row.owner = source.owner ?? null; }
        else row.sources.push(source);
      }
      const all = [...rows.values()];
      for (const group of snapshot?.groups || []) {
        const matches = all.filter(row => row.owner === group.id);
        const row = matches.find(item => item.policy?.id === 'owner:' + encodeURIComponent(group.id)) || (matches.length === 1 ? matches[0] : null);
        if (row) row.toolGroup = group;
        else if (group.tools.length) all.push({ id: 'tools:' + encodeURIComponent(group.id), label: group.label || group.id, owner: group.id, sources: [], policy: null, toolGroup: group });
      }
      for (const row of all) {
        if (!row.policy && row.sources.length === 1) row.policy = row.sources[0];
        row.orderId = sources.some(source => source.id === row.id) ? row.id : null;
      }
      return all.filter(row => row.toolGroup?.tools.length || row.sources.length || row.id === 'instructions:global' || row.id === 'instructions:project');
    }
    return {
      inject: ['slots', 'locale'],
      apply(ctx) {
        const locale = ctx.locale;
        for (const [lang, dictionary] of Object.entries(dictionaries)) {
          ctx.effect(() => locale.register('dsh-tool-discovery', lang, dictionary));
        }
        const t = locale.bind('dsh-tool-discovery');
        function Settings() {
          React.useSyncExternalStore(cb => locale.subscribe(cb), () => locale.getSnapshot());
          const scopeId = React.useId();
          const [snapshot, setSnapshot] = React.useState(null);
          const [form, setForm] = React.useState(null);
          const [baseline, setBaseline] = React.useState(null);
          const [busy, setBusy] = React.useState('loading');
          const [compositionForm, setCompositionForm] = React.useState(null);
          const [compositionBaseline, setCompositionBaseline] = React.useState(null);
          const compositionDirty = Boolean(compositionForm && compositionBaseline && compositionKey(compositionForm) !== compositionKey(compositionBaseline));
          const [error, setError] = React.useState('');
          const [notice, setNotice] = React.useState('');
          const [query, setQuery] = React.useState('');
          const [expanded, setExpanded] = React.useState({});
          const [models, setModels] = React.useState({});
          const [generating, setGenerating] = React.useState('');
          const generation = React.useRef(null);
          const mounted = React.useRef(true);
          const controllers = React.useRef(new Set());
          const operation = React.useRef(0);
          const toolsDirty = Boolean(form && baseline && configKey(form) !== configKey(baseline));
          const dirty = toolsDirty || compositionDirty;
          const text = (key, values = {}) => Object.entries(values).reduce((value, [name, replacement]) => value.replace('{' + name + '}', String(replacement)), t(key));
          const number = value => typeof value === 'number' && Number.isFinite(value) ? value.toLocaleString() : '—';
          async function request(method = 'GET', body, options = {}) {
            const controller = options.controller || new AbortController();
            controllers.current.add(controller);
            const timer = setTimeout(() => controller.abort(), options.generate ? 120000 : 30000);
            try {
              const response = await fetch('/api/tool-discovery' + (options.generate ? '/generate' : options.composition ? '/prompt-composition' : ''), {
                method, credentials: 'same-origin', signal: controller.signal,
                headers: { 'Content-Type': 'application/json' },
                ...(body === undefined ? {} : { body: JSON.stringify(body) }),
              });
              const data = await response.json().catch(() => { throw new Error(t('invalidJson')); });
              if (!response.ok || data?.error) {
                const detail = data?.error;
                throw new Error(detail && typeof detail === 'object'
                  ? [detail.code !== undefined ? '[' + detail.code + ']' : '', detail.message || t('requestFailed')].filter(Boolean).join(' ')
                  : typeof detail === 'string' ? detail : t('requestFailed'));
              }
              if (options.generate) {
                if (typeof data?.description !== 'string' || !data.description.trim() || data.description.length > 2000) throw new Error(t('invalidJson'));
                return data;
              }
              if (options.composition) {
                if (!validComposition(data)) throw new Error(t('invalidJson'));
                return data;
              }
              if (data.promptComposition !== undefined && !validComposition(data.promptComposition)) throw new Error(t('invalidJson'));
              const config = data?.config;
              if (config && config.version !== 3) throw new Error(t('restartRequired'));
              if (!config || typeof config.enabled !== 'boolean' || !validDescriptions(config.descriptions) || !['groups', 'tools', 'exclude'].every(key => Array.isArray(config[key]) && config[key].every(item => typeof item === 'string')) ||
                  !Array.isArray(data.groups) || !data.groups.every(group => group && typeof group.id === 'string' && validTools(group.tools) && typeof group.description === 'string' && typeof group.developerDescription === 'string' && ['developer', 'custom', 'missing'].includes(group.descriptionSource)) ||
                  (data.generation !== undefined && (!Array.isArray(data.generation?.models) || !data.generation.models.every(model => model && ['provider', 'model', 'label'].every(key => typeof model[key] === 'string')))) ||
                  (data.otherTools !== undefined && !validTools(data.otherTools)) ||
                  (data.warnings !== undefined && (!Array.isArray(data.warnings) || !data.warnings.every(warning => typeof warning === 'string')))) {
                throw new Error(t('invalidJson'));
              }
              return { ...data, otherTools: data.otherTools || [], warnings: data.warnings || [] };
            } catch (err) {
              if (err.name === 'AbortError') throw new Error(t('timeout'));
              if (err instanceof TypeError) throw new Error(t('networkError'));
              throw err;
            } finally { clearTimeout(timer); controllers.current.delete(controller); }
          }
          function accept(data, initial) {
            setSnapshot(data);
            if (data.promptComposition && (initial || !compositionDirty)) { setCompositionForm(copyComposition(data.promptComposition.config)); setCompositionBaseline(copyComposition(data.promptComposition.config)); }
            if (initial || !toolsDirty) { setForm(copyConfig(data.config)); setBaseline(copyConfig(data.config)); }
          }
          async function load(initial = false) {
            if (generation.current) return;
            const id = ++operation.current;
            const active = () => mounted.current && operation.current === id;
            setBusy('loading'); setError(''); setNotice('');
            try {
              const data = await request();
              if (active()) accept(data, initial);
            } catch (err) { if (active()) setError(err.message); }
            finally { if (active()) setBusy(''); }
          }
          React.useEffect(() => {
            mounted.current = true; void load(true);
            return () => { mounted.current = false; operation.current++; for (const controller of controllers.current) controller.abort(); };
          }, []);
          async function save(event) {
            event.preventDefault();
            if (busy || generation.current || !dirty) return;
            const id = ++operation.current;
            const active = () => mounted.current && operation.current === id;
            setBusy('save'); setError(''); setNotice('');
            const failures = []; let saved = 0;
            if (toolsDirty) {
              try {
                const data = await request('PUT', copyConfig(form));
                if (!active()) return;
                setSnapshot(data); setForm(copyConfig(data.config)); setBaseline(copyConfig(data.config)); saved++;
              } catch (err) { failures.push(t('toolsSettings') + '：' + err.message); }
            }
            if (!active()) return;
            if (compositionDirty) {
              try {
                const data = await request('PUT', copyComposition(compositionForm), { composition: true });
                if (!active()) return;
                setSnapshot(current => ({ ...current, promptComposition: data }));
                setCompositionForm(copyComposition(data.config)); setCompositionBaseline(copyComposition(data.config)); saved++;
              } catch (err) { failures.push(t('promptSettings') + '：' + err.message); }
            }
            if (active()) {
              setError(failures.join(' / ')); setNotice(failures.length ? saved ? 'partialSaved' : '' : 'saved'); setBusy('');
            }
          }
          function changeComposition(update) { setCompositionForm(current => update(current)); setNotice(''); setError(''); }
          function editRule(id, field, value) {
            changeComposition(current => {
              const rules = { ...current.rules };
              const previous = Object.hasOwn(rules, id) ? rules[id] : { role: 'inherit', delivery: 'inherit' };
              const next = { ...previous, [field]: value };
              if (next.role === 'inherit' && next.delivery === 'inherit') delete rules[id];
              else Object.defineProperty(rules, id, { value: next, enumerable: true, configurable: true, writable: true });
              return { ...current, rules };
            });
          }
          function moveSource(ids, index, direction) {
            if (index + direction < 0 || index + direction >= ids.length) return;
            const siblings = [...ids];
            [siblings[index], siblings[index + direction]] = [siblings[index + direction], siblings[index]];
            changeComposition(current => ({ ...current, order: mergeOrder(current.order, siblings) }));
          }
          function cancelChanges() {
            cancelGeneration(); setForm(copyConfig(baseline));
            if (compositionBaseline) setCompositionForm(copyComposition(compositionBaseline));
            setError(''); setNotice('cancelled');
          }
          function change(update) { setForm(current => update(current)); setNotice(''); }
          function editDescription(id, value) {
            change(current => {
              const descriptions = { ...current.descriptions };
              if (value.trim()) Object.defineProperty(descriptions, id, { value, enumerable: true, configurable: true, writable: true });
              else delete descriptions[id];
              return { ...current, descriptions };
            });
          }
          function cancelGeneration() {
            const current = generation.current;
            generation.current = null;
            current?.abort();
            setGenerating('');
          }
          async function generateDescription(group) {
            const model = snapshot.generation?.models.find(item => JSON.stringify([item.provider, item.model]) === models[group.id]);
            if (busy || generation.current || !model || group.developerDescription || !group.tools.length) return;
            const controller = new AbortController();
            generation.current = controller;
            const active = () => mounted.current && generation.current === controller;
            setGenerating(group.id); setError(''); setNotice('');
            try {
              const data = await request('POST', { plugin: group.id, model: { provider: model.provider, model: model.model } }, { generate: true, controller });
              if (active()) { editDescription(group.id, data.description); setNotice('generatedDraft'); }
            } catch (err) { if (active()) setError(err.message); }
            finally { if (active()) { generation.current = null; setGenerating(''); } }
          }
          function selectGroup(group, checked) {
            const names = new Set(group.tools.map(tool => tool.name));
            change(current => ({ ...current, groups: toggle(current.groups, group.id, checked),
              tools: current.tools.filter(name => !names.has(name)), exclude: current.exclude.filter(name => !names.has(name)) }));
          }
          function selectTool(group, name, checked) {
            change(current => {
              const wholePlugin = Boolean(group && current.groups.includes(group.id));
              return { ...current,
                tools: wholePlugin ? current.tools.filter(item => item !== name) : toggle(current.tools, name, checked),
                exclude: toggle(current.exclude, name, wholePlugin && !checked),
              };
            });
          }
          const packageText = (value, fallback = '') => value ? locale.resolveText(value) || fallback : fallback;
          const descriptionEditor = (group, id) => {
            const custom = Object.hasOwn(form.descriptions, group.id);
            const value = custom ? form.descriptions[group.id] : group.developerDescription;
            const availableModels = snapshot.generation?.models || [];
            const modelChosen = availableModels.some(model => JSON.stringify([model.provider, model.model]) === models[group.id]);
            const hintId = id + '-hint';
            return h('div', { className: 'td-description' },
              h('label', { htmlFor: id }, t('description')),
              h('p', { className: 'td-muted' }, t(custom ? 'customSource' : group.developerDescription ? 'developerSource' : 'missingSource')),
              h('textarea', { id, value, maxLength: 2000, disabled: Boolean(busy || generating), 'aria-describedby': hintId, onChange: event => editDescription(group.id, event.target.value) }),
              h('p', { className: 'td-muted', id: hintId }, t('descriptionLimit')),
              !group.developerDescription && !value && h('p', { className: 'td-muted' }, t('missingDescription')),
              group.developerDescription ? h('div', { className: 'td-description-actions' },
                h('button', { type: 'button', disabled: Boolean(busy || generating) || !custom, onClick: () => editDescription(group.id, '') }, t('restoreDescription'))) :
                h(React.Fragment, null,
                  h('div', { className: 'td-description-actions' },
                    h('select', { value: modelChosen ? models[group.id] : '', disabled: Boolean(busy || generating) || !availableModels.length || !group.tools.length, 'aria-label': t('generationModel'), 'aria-describedby': id + '-generation-hint', onChange: event => { const value = event.target.value; setModels(current => ({ ...current, [group.id]: value })); } },
                      h('option', { value: '' }, t('chooseModel')),
                      availableModels.map(model => h('option', { key: JSON.stringify([model.provider, model.model]), value: JSON.stringify([model.provider, model.model]) }, model.label))),
                    h('button', { type: 'button', disabled: Boolean(busy || generating) || !modelChosen || !group.tools.length, onClick: () => generateDescription(group) }, t(generating === group.id ? 'generating' : 'generate')),
                    generating === group.id && h('button', { type: 'button', onClick: () => { cancelGeneration(); setNotice('generationCancelled'); } }, t('cancelGeneration'))),
                  h('p', { className: 'td-muted', id: id + '-generation-hint' }, t(!group.tools.length ? 'noToolGeneration' : availableModels.length ? 'generationHint' : 'noModels'))));
          };
          const toolList = (tools, group = null, id) => h('ul', { className: 'td-tool-list', id }, tools.map(tool => h('li', { key: tool.name },
            h('label', { className: 'td-check td-tool' }, h('input', { type: 'checkbox', checked: isSelected(form, group, tool.name), disabled: Boolean(busy), onChange: event => selectTool(group, tool.name, event.target.checked) }),
              h('span', { className: 'td-tool-text' }, h('code', null, tool.name), tool.description && h('span', { className: 'td-muted td-tool-description', title: packageText(tool.description) }, packageText(tool.description)))))));
          const capabilities = snapshot?.promptComposition?.capabilities;
          const allSources = snapshot?.promptComposition?.sources || [];
          const compositionOrder = compositionForm?.order || [];
          const rows = ordered(sourceRows(snapshot), row => row.orderId || row.id, compositionOrder);
          const otherTools = snapshot?.otherTools || [];
          if (otherTools.length) rows.push({ id: 'unattributed-tools', label: t('otherTools'), owner: null, sources: [], policy: null, orderId: null, tools: otherTools });
          const groupOrder = rows.filter(row => row.orderId).map(row => row.orderId);
          const term = query.trim().toLocaleLowerCase();
          const matches = value => String(value || '').toLocaleLowerCase().includes(term);
          const matchesRow = row => matches(row.id) || matches(row.owner) || matches(packageText(row.label));
          const matchesTool = tool => matches(tool.name) || matches(packageText(tool.description));
          const matchesSource = source => matches(source.id) || matches(source.label);
          const visibleRows = rows.filter(row => !term || matchesRow(row) || (row.toolGroup?.tools || row.tools || []).some(matchesTool) || row.sources.some(matchesSource));
          const reasonText = reason => {
            const key = { 'host-adapter-required': 'hostRequired', 'explicit-source-adapter-required': 'sourceRequired', 'entrypoint-always': 'entryAlways', 'complete-persona-always': 'personaAlways', 'source-unavailable': 'sourceUnavailable', 'owner-unattributed-pack-unavailable': 'unattributedPack' }[reason];
            return key ? t(key) : reason || '';
          };
          const orderButtons = (ids, id, label) => {
            const index = ids.indexOf(id);
            return h('span', { className: 'td-row-order' }, [-1, 1].map(direction => h('button', {
              key: direction, type: 'button', disabled: Boolean(busy || generating || !compositionForm || !capabilities?.admission) || index < 0 || index + direction < 0 || index + direction >= ids.length,
              'aria-label': t(direction < 0 ? 'moveUp' : 'moveDown') + ' · ' + label, title: t(direction < 0 ? 'moveUp' : 'moveDown'), onClick: () => moveSource(ids, index, direction),
            }, direction < 0 ? '↑' : '↓')));
          };
          const compositionControls = (source, ids, id, label, child = false) => {
            const rule = compositionForm && source && Object.hasOwn(compositionForm.rules, source.id) ? compositionForm.rules[source.id] : { role: 'inherit', delivery: 'inherit' };
            const control = field => {
              const choices = source ? [...new Set((field === 'role' ? source.roles : source.deliveryModes).filter(value => field === 'role'
                ? capabilities?.roles?.includes(value) && (value !== 'developer' || capabilities.developer === true)
                : ['inherit', 'always', 'pack'].includes(value)))] : [];
              const value = rule[field];
              if (!source || !choices.includes(value)) return h('span', { className: 'td-readonly', title: source ? t('savedUnavailable') : t('noPrompt') }, source ? t(value) + ' · ' + t('savedUnavailable') : '—');
              return h('select', { value, disabled: Boolean(busy || generating || !compositionForm || !capabilities?.admission) || choices.length < 2,
                'aria-label': t(field) + ' · ' + label, title: reasonText(source.reason), onChange: event => editRule(source.id, field, event.target.value) },
              choices.map(option => h('option', { key: option, value: option }, t(option === 'inherit' && child ? 'inheritGroup' : option))));
            };
            return h('div', { className: 'td-composition-controls' }, control('role'), control('delivery'), orderButtons(ids, id, label));
          };
          const stat = (key, value) => h('div', { className: 'td-stat', key }, h('dt', null, t(key)), h('dd', null, value));
          const charValue = value => text('chars', { value: number(value) });
          const estimate = snapshot?.estimate;
          const assembly = snapshot?.lastAssembly;
          const totalTools = rows.reduce((sum, row) => sum + (row.toolGroup?.tools || row.tools || []).length, 0);
          const compositionReason = capabilities && !capabilities.admission ? reasonText(capabilities.reason || 'host-adapter-required') : '';
          const renderRow = (row, index) => {
            const group = row.toolGroup;
            const tools = group?.tools || row.tools || [];
            const selected = tools.filter(tool => isSelected(form, group, tool.name)).length;
            const label = row.id === 'instructions:global' ? t('globalInstructions') : row.id === 'instructions:project' ? t('projectInstructions') : row.id === 'owner:' + encodeURIComponent('@host/unknown') ? t('unattributedSources') : packageText(row.label, row.id);
            const key = JSON.stringify([query, row.id]);
            const open = expanded[key] ?? Boolean(term && !matchesRow(row));
            const listId = scopeId + '-sources-' + index;
            const sourceItems = ordered(row.sources, source => source.id, compositionOrder);
            const sourceOrder = sourceItems.map(source => source.id);
            const visibleSources = term && !matchesRow(row) ? sourceItems.filter(matchesSource) : sourceItems;
            const visibleTools = term && !matchesRow(row) ? tools.filter(matchesTool) : tools;
            const hint = [row.sources.length ? text('sourceCount', { count: row.sources.length }) : '', group?.description ? packageText(group.description) : ''].filter(Boolean).join(' · ');
            return h('div', { className: 'td-group', key: row.id, 'data-source-id': row.id },
              h('div', { className: 'td-group-top' },
                h('div', { className: 'td-group-identity' },
                  group && tools.length ? h('label', { className: 'td-check', title: group.id }, h('input', { type: 'checkbox', checked: form.groups.includes(group.id),
                    ref: element => { if (element) element.indeterminate = form.groups.includes(group.id) ? selected < tools.length : selected > 0; },
                    disabled: Boolean(busy || generating), onChange: event => selectGroup(group, event.target.checked) }), h('span', { className: 'td-plugin-name' }, label)) :
                    h('span', { className: 'td-check td-plugin-name', title: row.owner || row.id }, label),
                  hint && h('span', { className: 'td-source-summary', title: hint }, hint)),
                h('span', { className: 'td-count', 'aria-label': tools.length ? text('selected', { selected, total: tools.length }) : text('sourceCount', { count: row.sources.length }) }, tools.length ? selected + ' / ' + tools.length : '—'),
                compositionControls(row.policy, groupOrder, row.orderId, label),
                h('button', { type: 'button', className: 'td-expand', 'aria-label': t(open ? 'hideDetails' : 'sourceDetails') + ' · ' + label, 'aria-expanded': open, 'aria-controls': listId,
                  onClick: () => setExpanded(current => ({ ...current, [key]: !open })) },
                  h('svg', { width: 16, height: 16, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, 'aria-hidden': true, style: { transform: open ? 'rotate(90deg)' : undefined } }, h('path', { d: 'm9 5 7 7-7 7', strokeLinecap: 'round', strokeLinejoin: 'round' })))),
              h('div', { id: listId, hidden: !open }, open && h(React.Fragment, null,
                h('ul', { className: 'td-source-list' },
                  h('li', { className: 'td-source-reason' }, reasonText(row.policy?.reason) || (!row.sources.length ? t('noPrompt') : !row.policy ? t('childOnly') : '')),
                  visibleSources.map(source => h('li', { className: 'td-source-row', key: source.id },
                    h('div', { className: 'td-source-name' }, source.label, source.reason && h('p', { className: 'td-source-reason' }, reasonText(source.reason))),
                    source.id !== row.policy?.id && compositionControls(source, sourceOrder, source.id, source.label, true)))),
                group && descriptionEditor(group, listId + '-description'), visibleTools.length > 0 && toolList(visibleTools, group, listId + '-tools'))));
          };
          return h('section', { className: 'td-settings', 'aria-label': t('title'), 'aria-busy': Boolean(busy) },
            h('style', null, styles), h('h2', null, t('title')), h('p', { className: 'td-muted' }, t('intro')),
            error && h('p', { className: 'td-error', role: 'alert' }, error),
            !form ? (busy ? h('p', { role: 'status' }, t('loading')) : h('button', { onClick: () => load(true) }, t('retry'))) :
            h(React.Fragment, null,
              h('form', { onSubmit: save },
                h('div', { className: 'td-switches' },
                  h('label', { className: 'td-check td-enable' }, h('input', { type: 'checkbox', checked: form.enabled, disabled: Boolean(busy || generating), onChange: event => { const checked = event.target.checked; change(current => ({ ...current, enabled: checked })); }, 'aria-describedby': scopeId }), t('enabled')),
                  compositionForm && h('label', { className: 'td-check td-enable' }, h('input', { type: 'checkbox', checked: compositionForm.enabled, disabled: Boolean(busy || generating) || (!capabilities?.admission && !compositionForm.enabled), onChange: event => { const enabled = event.target.checked; changeComposition(current => ({ ...current, enabled })); } }), t('compositionEnable'))),
                h('p', { className: 'td-muted', id: scopeId }, t('groupHint')),
                compositionReason && h('p', { className: 'td-muted', role: 'status' }, compositionReason),
                compositionForm && capabilities?.admission && h('p', { className: 'td-muted' }, t(compositionForm.enabled ? 'compositionOrderHint' : 'compositionInactive')),
                !compositionForm && h('p', { className: 'td-muted' }, t('compositionMissing')),
                h('fieldset', null, h('legend', null, t('sources')),
                  h('div', { className: 'td-toolbar' },
                    h('input', { type: 'search', value: query, placeholder: t('search'), 'aria-label': t('search'), onChange: event => setQuery(event.target.value) }),
                    h('span', { className: 'td-muted td-summary' }, text('catalogSummary', { plugins: rows.length, tools: totalTools })),
                    h('button', { type: 'button', disabled: Boolean(busy || generating), onClick: () => load(false) }, t(busy === 'loading' ? 'refreshing' : 'refresh'))),
                  h('div', { className: 'td-list-head', 'aria-hidden': true }, h('span', null, t('sources')), h('span', { style: { textAlign: 'right' } }, t('selectedTools')),
                    h('div', { className: 'td-composition-controls' }, h('span', null, t('role')), h('span', null, t('delivery')), h('span', null, t('order'))), h('span')),
                  !visibleRows.length && h('p', { className: 'td-muted td-empty', role: 'status' }, t(term ? 'noResults' : 'emptyCatalog')),
                  visibleRows.map(renderRow)),
                h('div', { className: 'td-actions' },
                  h('p', { className: 'td-feedback' + (notice && notice !== 'partialSaved' ? ' td-success' : ' td-muted'), role: 'status' }, notice ? t(notice) : dirty ? t('dirty') : ''),
                  compositionForm && h('button', { type: 'button', disabled: Boolean(busy || generating), onClick: () => { changeComposition(() => ({ version: 1, enabled: false, order: [], rules: {} })); setNotice('compositionDefaultDraft'); } }, t('compositionDefault')),
                  h('button', { type: 'button', disabled: Boolean(busy) || (!dirty && !generating), onClick: cancelChanges }, t('cancel')),
                  h('button', { type: 'submit', className: 'td-primary', disabled: Boolean(busy || generating) || !dirty }, t(busy === 'save' ? 'saving' : 'save')))),
              h('details', null, h('summary', null, t('help')),
                h('p', { className: 'td-muted' }, t('scope')), h('p', { className: 'td-muted' }, t('hiddenHint')),
                compositionForm && h('p', { className: 'td-muted' }, t('compositionScope')),
                snapshot.warnings.length > 0 && h('div', { role: 'status', 'aria-label': t('warnings') }, snapshot.warnings.map((warning, index) => h('p', { className: 'td-muted', key: index }, warning))),
                h('div', { className: 'td-heading' }, h('h3', null, t('observations'))),
                h('h4', null, t('estimate')),
                h('dl', null, stat('before', charValue(estimate?.beforeChars)), stat('after', charValue(estimate?.afterChars)),
                  stat('savedChars', charValue(estimate?.savedChars)),
                  stat('hidden', number(estimate?.hiddenCount))),
                h('p', { className: 'td-muted' }, t('tokenHint')),
                h('h4', null, t('lastAssembly')),
                h('p', { className: 'td-muted' }, t('recordScope')),
                h('div', { className: 'td-last-record' }, assembly?.status === 'projected'
                  ? h('dl', null, stat('before', charValue(assembly.beforeChars)), stat('after', charValue(assembly.afterChars)),
                    stat('savedChars', charValue(assembly.savedChars)), stat('hidden', number(assembly.hiddenCount)))
                  : h('p', { className: 'td-muted' }, t(!assembly ? 'noAssembly' : assembly.status === 'native-unchanged' ? 'nativeUnchanged' : assembly.status === 'disabled' ? 'discoveryDisabled' : 'notApplied'))),
                h('details', null, h('summary', null, t('diagnostics')),
                  h('p', { className: 'td-muted' }, t('discoveryFlow')), h('p', { className: 'td-muted' }, t('summaryRule')),
                  h('p', { className: 'td-muted' }, t('observationHint')),
                  h('dl', null, stat('tokensLabel', text('tokens', { value: number(typeof estimate?.savedChars === 'number' ? Math.round(estimate.savedChars / 4) : undefined) })),
                    assembly && stat('mode', ['ptc', 'native'].includes(String(assembly.mode).toLowerCase()) ? t(String(assembly.mode).toLowerCase()) : assembly.mode),
                    assembly && stat('status', assembly.status), assembly?.hash && stat('hash', h('code', null, assembly.hash)), stat('calls', number(snapshot.discoveryCalls)))))));
        }
        ctx.slots.inject('settings.section', () => ctx.slots.register({
          name: 'settings.section', id: 'dsh-tool-discovery', order: 47, label: () => t('title'),
        }, Settings));
        const Panel = () => h('div', { style: { height: '100%', minHeight: 0, overflow: 'auto', background: 'var(--dsw-alias-bg-base)' } }, h(Settings));
        const Icon = ({ size = 18 }) => h('svg', { width: size, height: size, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.65, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true },
          h('path', { d: 'M4 5h12M4 10h7M4 15h5' }), h('circle', { cx: 15, cy: 14, r: 5 }), h('path', { d: 'm19 18 3 3' }));
        ctx.slots.inject('main', () => ctx.slots.register({ name: 'main', key: 'tool-discovery' }, Panel));
        ctx.slots.inject('sidebar.panellist', () => ctx.slots.register({
          name: 'sidebar.panellist', id: 'tool-discovery', order: 5, label: () => t('panel'),
        }, Icon));
      },
    };
  },
});
