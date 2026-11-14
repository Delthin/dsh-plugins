window.__ModuleLoader__.load({id:'@delthin/dsh-tool-wrap',
  factory(require) {
    const React = require('react');
    const h = React.createElement;
    const dictionaries = {
      zh: {
        systemPrompts: '系统提示词', userContext: '用户上下文', userFixed: '用户（固定）', userState: '用户（状态）', moveToFixed: '移到用户（固定）', moveToState: '移到用户（状态）', resetGrouping: '恢复默认分区', emptyRole: '拖入提示词以改变归属。', promptDetails: '查看提示词', morePrompt: '更多', moveToSystem: '移到系统提示词', moveToUser: '移到用户上下文', resetRole: '恢复默认角色', invalidRole: '角色待恢复', roleMoveDraft: '角色与顺序已调整，保存后生效。',
        intro: "按插件查看提示词与工具，拖动把手调整顺序。", enabled: "工具按需发现", discoveryHint: "先提供插件索引，调用时再加载工具定义。", compositionHint: "系统、用户固定与用户状态分别排序；状态更新追加到对话末尾。", groupHint: "固定内容保留原位，变化状态追加到对话末尾；跨区拖动调整归属，工具包独立管理。", compositionScope: "组设置作用于组内提示词；单段可覆盖，暂未出现的来源保留设置。", search: "搜索插件、工具或提示词", noResults: "没有匹配的插件、工具或提示词。", sourceDetails: "查看提示词与工具", dragHint: "拖动排序；也可按 Alt + ↑ / ↓", orderUnavailable: "当前来源暂不支持排序", orderDraft: "顺序已调整，保存后生效。", wholePackage: "整包按需加载（含今后新增工具）", toolCheck: "选择工具包", prompts: "提示词分段", toolsTitle: "工具", noTools: "此来源没有可执行工具。", promptDefault: "整组设置", adjustPrompt: "调整此段", promptHint: "各段按此顺序排列；系统与用户消息分别排序。", descriptionSection: "插件简介 · 用于按需发现索引", dynamicPreview: "随会话动态生成。", unavailablePreview: "正文暂无预览，宿主仅提供来源信息。", emptyPreview: "此段当前注册的文本为空。", staticPreview: "注册文本", showFull: "展开全文", collapseFull: "收起全文", injection: "注入", injectionOn: "启用", injectionOff: "停用", inheritInjection: "继承组设置", noPromptPreview: "仅工具", detailsLabel: "来源详情", defaultOption: "默认", onDemandPacks: "按需工具包", packCount: "插件 {count}", toolSelectionCount: "工具 {selected}/{total}", promptsTab: "提示词",
        collapseZone: '收起', expandZone: '展开', directoryPreview: '按当前会话可见工具与按需配置生成，实际目录在请求组装时填入。',
        injectedTab: '注入', sectionSettings: '逐段设置', editGroup: '调整', collapseGroup: '收起', archive: '不注入', archivePrompt: '移到不注入', restorePrompt: '恢复', emptyArchive: '暂无不注入的提示词。', addPack: '移入按需工具包', removePack: '移出按需工具包', moveIn: '移入', moveOut: '移出', addPackHint: '移入按需工具包，整包工具改为按需加载（含今后新增工具）。', removePackHint: '移出按需工具包，清除此包的按需工具选择，恢复直接提供工具定义。', emptyPacks: '在来源旁点击“移入”添加工具包。', resetInjection: '重置停用设置', archivedOnly: '请在“不注入”中恢复提示词。',
        compositionEnable: '启用提示词编排', compositionDefault: '恢复提示词默认', compositionDefaultDraft: '提示词默认值已恢复为草稿，保存后生效。', compositionMissing: '宿主尚未提供提示词来源，工具设置仍可使用。',  compositionOrderHint: '系统消息与用户消息分别排序；“随工具包”在解包时加载。', compositionInactive: '尚未启用编排，角色、加载、顺序和不注入设置暂不生效。', globalInstructions: '全局 AGENTS', projectInstructions: '项目 AGENTS', unattributedSources: '其他注入来源', noToolGeneration: '当前没有可用于生成简介的工具，可直接编辑简介。', unattributedPack: '尚未确认所属插件，可调整角色与顺序，暂不随工具包加载。', role: '消息角色', delivery: '加载方式', order: '顺序', inherit: '继承', inheritGroup: '继承组设置', system: '系统', user: '用户', developer: '开发者', always: '始终加载', pack: '随工具包', moveUp: '上移', moveDown: '下移', sources: '来源', sourceCount: '提示词 {count}', sourceTools: '{count} 个工具',  hideDetails: '收起来源与工具', noPrompt: '此来源只有工具，没有可编排的提示词。', childOnly: '请展开后逐项设置。', savedUnavailable: '已存设置当前不可用', partialSaved: '部分设置已保存，失败部分仍保留草稿。', toolsSettings: '工具设置', promptSettings: '提示词设置', hostRequired: '宿主未启用编排适配；角色与加载暂不可调整。', sourceRequired: '来源未确认，暂不可调整。', entryAlways: '入口目录需保持常驻。', personaAlways: '完整身份提示词需保持常驻。', sourceUnavailable: '来源当前未找到，保留已存设置。',
        useDefaults: '使用默认值', followGroup: '跟随组设置', originalRole: '原始角色', originalRoles: '各段原始角色', originalSourceRole: '来源原始角色', automatic: '自动', automaticDelivery: '自动：按会话工具包可用性决定', packConditional: '随工具包（需会话支持）', defaultEnabled: '默认启用', configuredHere: '此段设置', configuredGroup: '本组设置', followSource: '沿用「{source}」', settingsDraftHint: '下方显示配置值；修改后需保存，后续请求采用新设置。', injectionFixed: '此来源不支持更改注入开关。', roleShort: '角色', deliveryShort: '加载', alwaysShort: '常驻',
        panel: '工具与提示词', title: '工具与提示词',
         scope: '保存后，使用当前配置的各会话会在后续请求采用新设置；正在运行的请求不会回溯修改。',
        groups: '插件',    selectedTools: '已选 / 工具数', collapse: '收起工具', help: '工作原理与占用统计', catalogSummary: '来源目录 {plugins} · 工具 {tools}', catalogScope: '汇总全局注册与各会话观察，不代表当前请求全部注入。', registeredSource: '全局注册', observedSource: '会话中观察', hiddenHint: '没有工具或提示词的条目不展示，原有选择保留。',
        selected: '已选 {selected} / {total}', expand: '查看工具', emptyCatalog: '当前没有可选的全局工具。',
        otherTools: '未识别来源的工具', otherToolsHint: '这些全局工具尚无插件来源记录，只能逐项选择。',
        coverage: '来源已识别：{known} 个工具；未识别：{unknown} 个工具。', warnings: '目录提示',
        save: '保存设置', saving: '保存中…', cancel: '取消更改', saved: '设置已保存。', cancelled: '已取消未保存的更改。',
        dirty: '有未保存的更改', loading: '正在读取设置…', refreshing: '刷新中…', refresh: '刷新', retry: '重新读取',
        observations: '占用统计', estimate: '工具说明大小（已保存设置 · 全局工具）', before: '精简前', after: '精简后', savedChars: '已节省', addedChars: '净增加', estimateDraft: '工具设置有未保存的更改；下方仍为已保存设置的统计，保存后更新。', netIncrease: '当前索引开销大于省下的工具说明，可减少按需加载范围或缩短插件简介。', tokensAddedLabel: '预计增加 token', hidden: '已收起工具',
        chars: '{value} 字符', tokens: '约 {value} token（字符数 ÷ 4）', tokenHint: '按字符数比较工具说明，不含会话单独提供的工具、提示词编排及解包返回。',
        observationHint: 'token 按字符数 ÷ 4 粗略估算，不代表实际计费或缓存命中。文本指纹用于核对工具说明是否变化。',
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
        systemPrompts: 'System prompts', userContext: 'User context', userFixed: 'User (fixed)', userState: 'User (state)', moveToFixed: 'Move to user (fixed)', moveToState: 'Move to user (state)', resetGrouping: 'Reset default group', emptyRole: 'Drop a prompt here to change its role.', promptDetails: 'View prompt', morePrompt: 'More', moveToSystem: 'Move to system prompts', moveToUser: 'Move to user context', resetRole: 'Reset default role', invalidRole: 'Role needs recovery', roleMoveDraft: 'Role and order updated. Save to apply.',
        intro: "Inspect prompts and tools by plugin. Drag handles to reorder.", enabled: "On-demand tools", discoveryHint: "Show a plugin index first; load tool definitions when needed.", compositionHint: "Order system, fixed user and state prompts separately. Changed state goes at the history tail.", groupHint: "Unchanged fixed prompts stay in place; changed state follows dialogue history. Drag to change groups; tool packs remain separate.", compositionScope: "Group rules apply to their prompts; individual sections can override them. Absent sources retain saved settings.", search: "Search plugins, tools or prompts", noResults: "No matching plugins, tools or prompts.", sourceDetails: "View prompts and tools", dragHint: "Drag to reorder, or press Alt + ↑ / ↓", orderUnavailable: "Ordering is unavailable for this source", orderDraft: "Order updated. Save to apply.", wholePackage: "Defer the whole pack (including future tools)", toolCheck: "Select tool pack", prompts: "Prompt sections", toolsTitle: "Tools", noTools: "This source has no executable tools.", promptDefault: "Group settings", adjustPrompt: "Adjust this section", promptHint: "Sections follow this order; system and user messages are ordered separately.", descriptionSection: "Plugin description · on-demand index", dynamicPreview: "Generated per conversation.", unavailablePreview: "No body preview; the host provides source metadata only.", emptyPreview: "The registered text is currently empty.", staticPreview: "Registered text", showFull: "Expand full text", collapseFull: "Collapse text", injection: "Injection", injectionOn: "Enabled", injectionOff: "Disabled", inheritInjection: "Inherit group", noPromptPreview: "Tools only", detailsLabel: "Source details", defaultOption: "Default", onDemandPacks: "On-demand packs", packCount: "Packs {count}", toolSelectionCount: "Tools {selected}/{total}", promptsTab: "Prompts",
        collapseZone: 'Collapse', expandZone: 'Expand', directoryPreview: 'Generated from the tools visible to the current conversation and on-demand settings when assembling a request.',
        injectedTab: 'Injected', sectionSettings: 'Per-prompt settings', editGroup: 'Edit', collapseGroup: 'Close', archive: 'Excluded', archivePrompt: 'Exclude prompt', restorePrompt: 'Restore', emptyArchive: 'No excluded prompts.', addPack: 'Move into on-demand packs', removePack: 'Move out of on-demand packs', moveIn: 'Move in', moveOut: 'Move out', addPackHint: 'Defer the whole pack, including future tools.', removePackHint: 'Clear this pack’s on-demand tool selections and provide its tool definitions directly.', emptyPacks: 'Use Move in beside a source to add a tool pack.', resetInjection: 'Reset exclusion', archivedOnly: 'Restore prompts from the Excluded tab.',
        compositionEnable: 'Enable prompt composition', compositionDefault: 'Reset prompt defaults', compositionDefaultDraft: 'Prompt defaults restored as a draft. Save to apply.', compositionMissing: 'The host has not provided prompt sources. Tool settings remain available.', compositionOrderHint: 'System and user messages are ordered separately. With tool pack loads the text when unwrapped.', compositionInactive: 'Composition is off. Role, loading, ordering and exclusion settings are not applied yet.', globalInstructions: 'Global AGENTS', projectInstructions: 'Project AGENTS', unattributedSources: 'Other injected sources', noToolGeneration: 'No tool descriptions are currently available for generation. You can edit the description directly.', unattributedPack: 'Plugin ownership is unconfirmed. Role and ordering remain editable, but pack delivery is unavailable.', role: 'Message role', delivery: 'Loading', order: 'Order', inherit: 'Inherit', inheritGroup: 'Inherit group', system: 'System', user: 'User', developer: 'Developer', always: 'Always', pack: 'With tool pack', moveUp: 'Move up', moveDown: 'Move down', sources: 'Sources', sourceCount: 'Prompts {count}', sourceTools: '{count} tools', hideDetails: 'Collapse sources and tools', noPrompt: 'This source has tools only, with no prompt to compose.', childOnly: 'Expand to configure individual sources.', savedUnavailable: 'Saved setting currently unavailable', partialSaved: 'Some settings were saved. Failed changes remain as a draft.', toolsSettings: 'Tool settings', promptSettings: 'Prompt settings', hostRequired: 'Host composition support is not enabled; roles and loading cannot be changed.', sourceRequired: 'Source is unconfirmed and cannot be changed.', entryAlways: 'The entrypoint directory must remain always loaded.', personaAlways: 'Complete persona instructions must remain always loaded.', sourceUnavailable: 'Source not currently found. Saved settings are retained.',
        useDefaults: 'Use defaults', followGroup: 'Follow group', originalRole: 'Original role', originalRoles: 'Original roles per section', originalSourceRole: 'Original source role', automatic: 'Automatic', automaticDelivery: 'Automatic: determined by tool-pack availability in each conversation', packConditional: 'With tool pack (requires conversation support)', defaultEnabled: 'Enabled by default', configuredHere: 'Section setting', configuredGroup: 'Group setting', followSource: 'From “{source}”', settingsDraftHint: 'These are configured values. Save changes to apply them to subsequent requests.', injectionFixed: 'Injection cannot be changed for this source.', roleShort: 'Role', deliveryShort: 'Loading', alwaysShort: 'Always',
        panel: 'Tools and prompts', title: 'Tools and prompts',
        scope: 'Saved settings apply to subsequent requests in conversations using this configuration. In-flight requests are not changed retroactively.',
        groups: 'Plugins', selectedTools: 'Selected / tools', collapse: 'Hide tools', help: 'How it works and context size', catalogSummary: 'Source catalog {plugins} · Tools {tools}', catalogScope: 'Global registrations and observations across conversations, not a list of everything injected into this request.', registeredSource: 'Global registration', observedSource: 'Observed in a conversation', hiddenHint: 'Entries without tools or prompts are hidden. Existing selections are preserved.',
        selected: '{selected} / {total} selected', expand: 'View tools', emptyCatalog: 'No global tools are currently available to select.',
        otherTools: 'Tools with unidentified sources', otherToolsHint: 'These global tools have no recorded plugin source and can only be selected individually.',
        coverage: 'Identified sources: {known} tools; unidentified: {unknown} tools.', warnings: 'Catalog notices',
        save: 'Save settings', saving: 'Saving…', cancel: 'Cancel changes', saved: 'Settings saved.', cancelled: 'Unsaved changes cancelled.',
        dirty: 'Unsaved changes', loading: 'Loading settings…', refreshing: 'Refreshing…', refresh: 'Refresh', retry: 'Reload settings',
        observations: 'Context size', estimate: 'Tool description size (saved settings · global tools)', before: 'Before', after: 'After', savedChars: 'Saved', addedChars: 'Net increase', estimateDraft: 'Tool settings have unsaved changes. Figures below still reflect saved settings and update after saving.', netIncrease: 'The index costs more than the deferred definitions save. Reduce the deferred scope or shorten plugin descriptions.', tokensAddedLabel: 'Estimated tokens added', hidden: 'Tools deferred',
        chars: '{value} characters', tokens: 'About {value} tokens (characters ÷ 4)', tokenHint: 'Compares tool description characters, excluding conversation-only tools, prompt composition and unwrap responses.',
        observationHint: 'Characters ÷ 4 is a rough token estimate, not billing or cache-hit data. The text checksum helps check whether tool descriptions have changed.',
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
      .td-settings{container-type:inline-size;box-sizing:border-box;display:flex;flex-direction:column;max-width:1240px;height:var(--td-settings-height,auto);min-height:0;margin:0 auto;padding:16px 20px;color:var(--dsw-alias-label-primary);font:13px/1.45 system-ui,sans-serif;overflow-wrap:anywhere}
      .td-settings>form{display:flex;flex-direction:column;flex:1;min-height:0}
      .td-settings>form>:not(.td-workspace),.td-settings>.td-topbar,.td-settings>.td-help{flex-shrink:0}
      .td-settings *{box-sizing:border-box}
      .td-settings h2{font-size:18px;line-height:1.4;font-weight:600;margin:0}
      .td-settings h3{font-family:inherit;font-size:14px;font-weight:600;margin:0}
      .td-settings h4{font-size:13px;margin:16px 0 6px}
      .td-settings p{margin:0 0 8px}
      .td-settings .td-muted{color:var(--dsw-alias-label-secondary);font-size:12px}
      .td-settings button,.td-settings select,.td-settings input,.td-settings textarea{font:inherit;color:inherit}
      .td-settings button{min-height:28px;border:1px solid var(--dsw-alias-border-l2);border-radius:5px;background:var(--dsw-alias-bg-base);padding:4px 9px;cursor:pointer}
      .td-settings button:hover:not(:disabled){background:var(--dsw-alias-bg-layer-2)}
      .td-settings button:active:not(:disabled){background:var(--dsw-alias-bg-layer-1)}
      .td-settings button.td-primary{border-color:var(--dsw-alias-brand-primary);color:var(--dsw-alias-brand-primary);font-weight:600}
      .td-settings :disabled{opacity:.5;cursor:not-allowed}
      .td-settings :is(input,button,summary,textarea,select,pre):focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:2px}
      .td-settings ::selection{background:var(--dsw-alias-brand-primary);color:var(--dsw-alias-bg-base)}
      .td-settings :is(input,textarea){caret-color:var(--dsw-alias-brand-primary)}
      .td-settings :is(input,textarea)::placeholder{color:var(--dsw-alias-label-secondary);opacity:1}
      .td-settings :is(.td-master-list,.td-detail,.td-prompt-body){scrollbar-width:thin;scrollbar-color:var(--dsw-alias-border-l2) transparent}
      .td-settings .td-topbar{display:flex;align-items:baseline;gap:12px;margin-bottom:12px}
      .td-settings .td-topbar p{margin:0}
      .td-settings .td-switches{display:flex;flex-wrap:wrap;gap:8px 24px;margin-bottom:16px;padding-bottom:12px;border-bottom:1px solid var(--dsw-alias-border-l1)}
      .td-settings .td-switch-card{display:inline-flex;align-items:center;gap:10px;min-height:32px;cursor:pointer;min-width:0}
      .td-settings .td-switch-title{font-weight:500}
      .td-settings input[type=checkbox]{width:15px;height:15px;accent-color:var(--dsw-alias-brand-primary);margin:0;flex-shrink:0;cursor:pointer}
      .td-settings input.td-switch{appearance:none;position:relative;width:34px;height:20px;border:1px solid var(--dsw-alias-border-l2);border-radius:12px;background:var(--dsw-alias-bg-layer-2);flex-shrink:0}
      .td-settings input.td-switch:checked{background:var(--dsw-alias-brand-primary);border-color:var(--dsw-alias-brand-primary)}
      .td-settings input.td-switch:before{content:'';display:block;width:14px;height:14px;position:absolute;top:2px;left:2px;border-radius:50%;background:var(--dsw-alias-label-secondary)}
      .td-settings input.td-switch:checked:before{left:16px;background:var(--dsw-alias-bg-base)}
      .td-settings .td-master-list.td-role-master-list{display:flex;flex-direction:column;padding:0;overflow:hidden}
      .td-settings .td-role-zone{position:relative;flex:1;min-height:72px;overflow:auto;overscroll-behavior:contain;scrollbar-width:thin;scrollbar-color:var(--dsw-alias-border-l2) transparent}
      .td-settings .td-role-zone+.td-role-zone{border-top:1px solid var(--dsw-alias-border-l2)}
      .td-settings .td-role-zone-heading{position:sticky;top:0;z-index:2;display:flex;align-items:center;gap:8px;padding:0;background:var(--dsw-alias-bg-layer-1)}
      .td-settings .td-role-zone-heading h3{font-size:13px;flex:1;min-width:0}
      .td-settings .td-role-zone.is-collapsed{flex:0 0 auto;min-height:0;overflow:hidden}
      .td-settings .td-zone-toggle{display:flex;align-items:center;gap:8px;width:100%;min-height:38px;padding:8px 10px;text-align:left;border:0;border-radius:0;background:transparent;font-size:13px;font-weight:600}
      .td-settings .td-zone-toggle-label{margin-left:auto;font-size:11px;font-weight:400;color:var(--dsw-alias-label-secondary)}
      .td-settings .td-role-list[hidden]{display:none}
      .td-settings .td-role-list{list-style:none;margin:0;padding:2px 4px 8px;min-height:44px}
      .td-settings .td-role-empty{padding:8px 10px;min-height:44px}
      .td-settings .td-prompt-row .td-source-line2{font-size:11px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
      .td-settings .td-prompt-options{margin:12px 0;padding-top:8px;border-top:1px solid var(--dsw-alias-border-l1)}
      .td-settings .td-prompt-options>summary{list-style:none;width:max-content;cursor:pointer;min-height:28px;padding:4px 0;color:var(--dsw-alias-label-secondary)}
      .td-settings .td-prompt-options>summary::-webkit-details-marker{display:none}
      .td-settings .td-prompt-options[open]>summary{color:var(--dsw-alias-label-primary)}
      .td-settings .td-prompt-actions{display:flex;flex-wrap:wrap;gap:6px;margin:6px 0}
      .td-settings .td-workspace{display:grid;grid-template-columns:300px minmax(0,1fr);gap:12px;flex:1;min-height:240px;min-width:0}
      .td-settings .td-master{display:flex;flex-direction:column;min-height:0;border:1px solid var(--dsw-alias-border-l1);border-radius:6px;background:var(--dsw-alias-bg-layer-1);overflow:hidden}
      .td-settings .td-master-tabs{display:flex;gap:16px;padding:0 10px;border-bottom:1px solid var(--dsw-alias-border-l1);background:var(--dsw-alias-bg-base)}
      .td-settings .td-master-tabs button{display:flex;align-items:center;gap:6px;min-height:38px;padding:8px 2px;border:0;border-bottom:2px solid transparent;border-radius:0;background:transparent}
      .td-settings .td-master-tabs button[aria-selected=true]{color:var(--dsw-alias-brand-primary);border-bottom-color:var(--dsw-alias-brand-primary);font-weight:600}
      .td-settings .td-master-panel{display:flex;flex:1;flex-direction:column;min-height:0;overflow:hidden}
      .td-settings .td-master-panel[hidden]{display:none}
      .td-settings .td-master-header{padding:9px 10px 7px;border-bottom:1px solid var(--dsw-alias-border-l1)}
      .td-settings input[type=search]{width:100%;min-width:0;height:30px;border:1px solid var(--dsw-alias-border-l2);border-radius:4px;background:var(--dsw-alias-bg-base);padding:4px 8px;font-size:12px}
      .td-settings .td-master-summary{display:flex;align-items:center;justify-content:space-between;gap:6px;margin-top:6px;font-size:11px;color:var(--dsw-alias-label-secondary);font-variant-numeric:tabular-nums}
      .td-settings .td-master-summary button{font-size:11px;min-height:24px;padding:2px 6px}
      .td-settings .td-master-list{overflow:auto;overscroll-behavior:contain;flex:1;min-height:0;list-style:none;margin:0;padding:4px}
      .td-settings .td-group{display:grid;grid-template-columns:20px minmax(0,1fr) auto;gap:4px;align-items:center;min-height:48px;padding:2px 4px 2px 0;position:relative;border:1px solid transparent;border-radius:4px}
      .td-settings .td-group:hover{background:var(--dsw-alias-bg-layer-2)}
      .td-settings .td-group.is-selected{background:var(--dsw-alias-bg-base);border-color:var(--dsw-alias-border-l2)}
      .td-settings .is-dragging{opacity:.45}
      .td-settings .is-drop-before:before,.td-settings .is-drop-after:after{content:'';position:absolute;left:0;right:0;height:2px;background:var(--dsw-alias-brand-primary);z-index:1}
      .td-settings .is-drop-before:before{top:0}
      .td-settings .is-drop-after:after{bottom:0}
      .td-settings .td-drag-handle{display:grid;place-items:center;width:20px;height:28px;min-height:28px;padding:0;border-color:transparent;background:transparent;color:var(--dsw-alias-label-secondary);cursor:grab;touch-action:none}
      .td-settings .td-drag-handle:active{cursor:grabbing}
      .td-settings button.td-source-main{display:flex;flex-direction:column;align-items:stretch;justify-content:center;gap:2px;min-width:0;width:100%;min-height:22px;height:auto;text-align:left;padding:0 2px;border:0;background:transparent;border-radius:3px}
      .td-settings .td-source-line1{display:flex;align-items:center;gap:5px;min-width:0}
      .td-settings .td-source-name{font-size:13px;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;flex:1}
      .td-settings .td-source-line2{display:flex;align-items:center;gap:6px;font-size:12px;color:var(--dsw-alias-label-secondary);min-width:0}
      .td-settings .td-count{flex-shrink:0;white-space:nowrap;font-size:11px;font-variant-numeric:tabular-nums}
      .td-settings .td-source-line2 .td-count{font-size:inherit}
      .td-settings .td-dirty-dot{width:5px;height:5px;background:var(--dsw-alias-brand-primary);border-radius:50%;flex-shrink:0}
      .td-settings .td-detail{min-width:0;overflow:auto;overscroll-behavior:contain;padding:12px 14px;border:1px solid var(--dsw-alias-border-l1);border-radius:6px;background:var(--dsw-alias-bg-base)}
      .td-settings .td-detail-header{margin-bottom:12px}
      .td-settings .td-detail-title-row h3{font-size:16px}
      .td-settings .td-detail-title-row{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:3px}
      .td-settings .td-source-reason{font-size:12px;color:var(--dsw-alias-label-secondary);margin:0 0 8px}
      .td-settings .td-composition-controls{display:flex;flex-wrap:wrap;align-items:center;gap:8px 20px;padding:8px 0}
      .td-settings .td-choice-row{display:grid;grid-template-columns:32px minmax(0,1fr);align-items:center;gap:8px;min-width:0;width:max-content;max-width:100%}
      .td-settings .td-choice-label{font-size:12px;color:var(--dsw-alias-label-secondary)}
      .td-settings .td-choice-options{display:flex;align-items:center;flex-wrap:wrap;gap:4px;min-width:0}
      .td-settings .td-segments{display:inline-flex;flex-wrap:wrap;max-width:100%;min-width:0;border:1px solid var(--dsw-alias-border-l2);border-radius:5px;background:var(--dsw-alias-bg-layer-1);padding:2px;gap:2px}
      .td-settings .td-segment{flex:0 1 auto;min-width:0;min-height:28px;padding:4px 8px;border:1px solid transparent;background:transparent;font-size:12px;line-height:1.35;border-radius:3px;overflow-wrap:anywhere}
      .td-settings .td-segment[aria-checked=true]{background:var(--dsw-alias-bg-base);border-color:var(--dsw-alias-border-l2);color:var(--dsw-alias-brand-primary);font-weight:600}
      .td-settings .td-segment:focus-visible{outline-offset:0;position:relative;z-index:1}
      .td-settings .td-sr-only{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip-path:inset(50%);white-space:nowrap;border:0}
      .td-settings .td-unavailable{font-size:12px;color:var(--dsw-alias-state-error-primary)}
      .td-settings .td-readonly{font-size:12px;padding:6px 0}
      .td-settings .td-row-order{display:flex;gap:4px;margin-left:auto}
      .td-settings .td-row-order button{display:grid;place-items:center;width:28px;min-height:28px;padding:3px}
      .td-settings .td-pack-list[hidden]{display:none}
      .td-settings .td-source-content{min-width:0}
      .td-settings .td-outer-action-slot{display:flex;align-items:center;gap:2px}
      .td-settings .td-list-action{display:inline-flex;align-items:center;justify-content:center;min-width:26px;min-height:28px;padding:3px 4px;border-color:transparent;background:transparent;font-size:12px;white-space:nowrap}
      .td-settings .td-pack-action{color:var(--dsw-alias-label-primary)}
      .td-settings .td-fixed-source{display:grid;place-items:center;width:26px;color:var(--dsw-alias-label-secondary)}
      .td-settings .td-archive-list li{display:flex;align-items:center;gap:4px;min-height:34px;min-width:0}
      .td-settings .td-archive-list{flex:1;list-style:none;overflow:auto;overscroll-behavior:contain;margin:0;padding:4px 6px;min-height:0;scrollbar-width:thin;scrollbar-color:var(--dsw-alias-border-l2) transparent}
      .td-settings .td-archive-source{display:flex;flex:1;flex-direction:column;min-width:0;text-align:left;gap:1px;border:0;background:transparent;padding:5px 4px}
      .td-settings .td-archive-source>span{max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:12px}
      .td-settings .td-archive-source small{font-size:11px;color:var(--dsw-alias-label-secondary)}
      .td-settings .td-archive-empty,.td-settings .td-pack-empty{padding:8px;font-size:12px}
      .td-settings .td-tool-policy{margin-bottom:12px}
      .td-settings .td-pack-group{list-style:none}
      .td-settings .td-pack-list{list-style:none;margin:2px 0 6px 20px;padding:0 0 0 4px;border-left:1px solid var(--dsw-alias-border-l2)}
      .td-settings .td-pack-heading{display:flex;align-items:center;gap:6px;min-height:40px;padding:4px}
      .td-settings .td-pack-heading strong{flex:1;font-size:12px}
      .td-settings .td-pack-toggle{display:grid;place-items:center;min-height:28px;width:24px;padding:0;border:0;background:transparent;color:var(--dsw-alias-label-secondary)}
      .td-settings .td-prompt-card{position:relative;padding-bottom:16px;margin-bottom:20px;border-bottom:1px solid var(--dsw-alias-border-l1)}
      .td-settings .td-prompt-card:last-child{border-bottom:0;margin-bottom:0}
      .td-settings .td-prompt-body{margin:4px 0 0;padding:10px 12px;white-space:pre-wrap;overflow-wrap:anywhere;font:13px/1.65 system-ui,sans-serif;max-height:152px;overflow:auto;background:var(--dsw-alias-bg-layer-1);border-radius:4px}
      .td-settings .td-prompt-body.is-expanded{max-height:none}
      .td-settings .td-prompt-foot{display:flex;align-items:center;justify-content:space-between;padding:4px 0;font-size:12px;color:var(--dsw-alias-label-secondary)}
      .td-settings .td-prompt-foot button{font-size:12px;min-height:28px;padding:2px 5px;border-color:transparent}
      .td-settings .td-preview-notice{padding:10px 0;font-size:12px;color:var(--dsw-alias-label-secondary);line-height:1.6}
      .td-settings .td-check{display:flex;align-items:center;gap:8px;min-width:0;cursor:pointer}
      .td-settings .td-tool-policy{padding:8px 0;font-size:12px}
      .td-settings .td-tool-list{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:0 14px;list-style:none;padding:0;margin:0}
      .td-settings .td-tool-list li{min-width:0;border-bottom:1px solid var(--dsw-alias-border-l1)}
      .td-settings .td-tool{padding:7px 0;align-items:flex-start}
      .td-settings .td-tool input{margin-top:3px}
      .td-settings .td-tool-text{min-width:0;display:flex;flex-direction:column;gap:2px}
      .td-settings .td-tool code{font:12px ui-monospace,SFMono-Regular,Menlo,monospace;overflow-wrap:anywhere}
      .td-settings .td-tool-description{font-size:11px;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
      .td-settings .td-description{padding:8px 0}
      .td-settings .td-description label{display:block;font-weight:600;margin-bottom:5px}
      .td-settings .td-description textarea{display:block;width:100%;min-height:68px;resize:vertical;padding:7px 8px;line-height:1.5;border:1px solid var(--dsw-alias-border-l2);border-radius:5px;background:var(--dsw-alias-bg-base)}
      .td-settings .td-description p{margin:6px 0}
      .td-settings .td-description-actions{display:flex;align-items:center;gap:7px;flex-wrap:wrap;margin:8px 0}
      .td-settings .td-description select{min-width:0;flex:1;max-width:100%;min-height:28px;border:1px solid var(--dsw-alias-border-l2);border-radius:4px;background:var(--dsw-alias-bg-base);padding:4px}
      .td-settings .td-actions{position:relative;flex-shrink:0;display:flex;align-items:center;gap:8px;flex-wrap:wrap;padding:10px 0;background:var(--dsw-alias-bg-base);border-bottom:1px solid var(--dsw-alias-border-l1)}
      .td-settings .td-feedback{flex:1;min-width:120px;margin:0;font-size:12px}
      .td-settings .td-error{color:var(--dsw-alias-state-error-primary)}
      .td-settings .td-success{color:var(--dsw-alias-state-success-primary)}
      .td-settings .td-empty{padding:16px 8px}
      .td-settings details{margin-top:10px;font-size:12px}
      .td-settings summary{padding:6px 0;color:var(--dsw-alias-label-secondary);cursor:pointer}
      .td-settings .td-heading{margin:14px 0 7px}
      .td-settings dl{margin:6px 0 10px;font-size:12px;font-variant-numeric:tabular-nums}
      .td-settings .td-stat{display:grid;grid-template-columns:1fr 1.5fr;gap:12px;padding:5px 0;border-bottom:1px solid var(--dsw-alias-border-l1)}
      .td-settings dt{color:var(--dsw-alias-label-secondary)}
      .td-settings dd{margin:0;text-align:right;overflow-wrap:anywhere}
      @container(max-width:820px){.td-settings .td-workspace{grid-template-columns:minmax(184px,38%) minmax(0,1fr);gap:10px}
      .td-settings .td-detail{padding:10px}
      .td-settings .td-tool-list{grid-template-columns:1fr}
      .td-settings .td-topbar{display:block}
      .td-settings .td-topbar p{margin-top:3px}
      }
      @container(max-width:460px){.td-settings .td-switches{gap:6px 16px}
      .td-settings .td-workspace{grid-template-columns:1fr;height:auto;flex:none;min-height:0}
      .td-settings .td-master-list{max-height:220px}
      .td-settings .td-detail{max-height:65dvh}
      .td-settings .td-actions{gap:6px}
      .td-settings .td-feedback{flex-basis:100%}}
      @media(max-width:540px){.td-settings{padding:12px}}
    `;
    const copyConfig = config => ({ version: 3, enabled: config.enabled, groups: [...config.groups], tools: [...config.tools], exclude: [...config.exclude], descriptions: { ...config.descriptions } });
    const configKey = config => JSON.stringify({ ...copyConfig(config), groups: [...config.groups].sort(), tools: [...config.tools].sort(), exclude: [...config.exclude].sort(), descriptions: Object.entries(config.descriptions).sort(([a], [b]) => a.localeCompare(b)) });
    const validDescriptions = value => value && typeof value === 'object' && !Array.isArray(value) && Object.values(value).every(description => typeof description === 'string' && description.length <= 2000);
    const toggle = (items, value, checked) => checked ? [...new Set([...items, value])] : items.filter(item => item !== value);
    const isSelected = (config, group, name) => (Boolean(group && config.groups.includes(group.id)) || config.tools.includes(name)) && !config.exclude.includes(name);
    const validTools = tools => Array.isArray(tools) && tools.every(tool => tool && typeof tool.name === 'string');
    const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
    const strings = value => Array.isArray(value) && value.every(item => typeof item === 'string');
    const copyComposition = config => ({ version: 1, enabled: config.enabled, order: [...config.order], rules: Object.fromEntries(Object.entries(config.rules).map(([id, rule]) => [id, { ...rule }])), ...(config.sourceOrder ? { sourceOrder: [...config.sourceOrder] } : {}) });
    const compositionKey = config => JSON.stringify({ ...copyComposition(config), rules: Object.entries(config.rules).sort(([a], [b]) => a.localeCompare(b)).map(([id, rule]) => [id, rule.role, rule.delivery, rule.enabled, rule.placement]) });
    const validComposition = data => data?.config?.version === 1 && typeof data.config.enabled === 'boolean' && strings(data.config.order) && (data.config.sourceOrder === undefined || strings(data.config.sourceOrder)) && object(data.config.rules) &&
      Object.values(data.config.rules).every(rule => object(rule) && ['inherit', 'system', 'developer', 'user'].includes(rule.role) && ['inherit', 'always', 'pack'].includes(rule.delivery) && (rule.enabled === undefined || typeof rule.enabled === 'boolean') && (rule.placement === undefined || ['inherit', 'fixed', 'state'].includes(rule.placement))) &&
      typeof data.capabilities?.admission === 'boolean' && strings(data.capabilities.roles) &&
      Array.isArray(data.sources) && data.sources.every(source => source && ['id', 'label', 'kind'].every(key => typeof source[key] === 'string') && strings(source.roles) && strings(source.deliveryModes) && (source.owner == null || typeof source.owner === 'string'));
    const ordered = (items, key, order) => {
      const ranks = new Map(order.map((id, index) => [id, index]));
      return [...items].sort((a, b) => (ranks.get(key(a)) ?? Infinity) - (ranks.get(key(b)) ?? Infinity));
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
        ctx.inject?.(['uiConversation'], scope => {
          const events = scope.uiConversation.events;
          if (!events?.entries || !events.subscribe || !events.register) return;
          const hidden = message => message && (message.content.length === 0 && message.source.kind !== 'user'
            && (['prompt-composition', 'prompt-composition-cleared', 'prompt-composition-state'].includes(message.source.kind) || message.source.compositionAuthority === true)
            || message.source.kind === 'prompt-composition' && message.source.placement === 'state' && message.source.operation === 'remove' && message.source.contributionId === '');
          const label = source => {
            if (typeof source.contributionId !== 'string') return null;
            const [kind, owner, name] = source.contributionId.split(':');
            try {
              const value = kind === 'instructions' || kind === 'message' ? owner : kind === 'context' || kind === 'section' ? name : '';
              return value ? decodeURIComponent(value).trim() || null : null;
            } catch { return null; }
          };
          let current, dispose;
          const update = () => {
            const native = events.entries().find(definition => definition.kind === 'input-message' && definition.target === 'chat');
            if (native === current) return;
            current = native;
            dispose?.(); dispose = undefined;
            if (!native) return;
            dispose = events.register({
              ...native, kind: 'tool-wrap/context-message',
              match(event) {
                if (event.type !== 'user/message' || event.data.source.kind !== 'prompt-composition' && !hidden(event.data)) return null;
                const match = native.match(event);
                return match ? { ...match, exclusive: true } : null;
              },
              start(context, match, reader) {
                const state = native.start(context, match, reader), name = label(match.event.data.source);
                return state?.producer && name ? { ...state, producer: { ...state.producer, label: name } } : state;
              },
              buildViewNode(context) {
                return hidden(context.start?.event.data) ? null : native.buildViewNode(context);
              },
            });
          };
          scope.effect(() => {
            const unsubscribe = events.subscribe(update);
            update();
            return () => { unsubscribe(); dispose?.(); };
          });
        });
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
          const [selectedId, setSelectedId] = React.useState('');
          const [packsOpen, setPacksOpen] = React.useState(true);
          const [listView, setListView] = React.useState('injected');
          const [expandedPrompts, setExpandedPrompts] = React.useState({});
          const [collapsedZones, setCollapsedZones] = React.useState({});
          const [dragging, setDragging] = React.useState(null);
          const [dropTarget, setDropTarget] = React.useState(null);
          const [orderNotice, setOrderNotice] = React.useState('');
          const drag = React.useRef(null);
          const dragScroll = React.useRef(null);
          const [models, setModels] = React.useState({});
          const [generating, setGenerating] = React.useState('');
          const generation = React.useRef(null);
          const mounted = React.useRef(true);
          const controllers = React.useRef(new Set());
          const operation = React.useRef(0);
          const settingsElement = React.useRef(null);
          const refreshLayout = React.useRef(null);
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
            return () => { mounted.current = false; operation.current++; stopDragScroll(); drag.current = null; for (const controller of controllers.current) controller.abort(); };
          }, []);
          React.useEffect(() => {
            const root = settingsElement.current;
            const view = root?.ownerDocument?.defaultView;
            if (!root || !view?.requestAnimationFrame) return;
            let frame = 0;
            const measure = () => {
              frame = 0;
              const rect = root.getBoundingClientRect();
              if (!root.offsetWidth || !rect.width) return;
              // DOM rects include host CSS zoom; layout dimensions and CSS properties do not.
              const scale = rect.width / root.offsetWidth;
              const rootStyle = view.getComputedStyle(root);
              const pixels = value => Number.parseFloat(value) || 0;
              const width = root.clientWidth - pixels(rootStyle.paddingLeft) - pixels(rootStyle.paddingRight);
              if (width <= 460) { root.style.removeProperty('--td-settings-height'); return; }
              let bottom = Math.min(view.innerHeight, view.visualViewport ? view.visualViewport.offsetTop + view.visualViewport.height : Infinity);
              let scrollOffset = 0;
              for (let parent = root.parentElement; parent; parent = parent.parentElement) {
                const style = view.getComputedStyle(parent), bounds = parent.getBoundingClientRect();
                if (style.display === 'contents' || !parent.offsetWidth || !bounds.height) continue;
                const parentScale = bounds.width / parent.offsetWidth;
                scrollOffset += parent.scrollTop * parentScale;
                if (/(auto|scroll|hidden|clip)/.test(style.overflowY)) {
                  const contentBottom = bounds.top + (parent.clientTop + parent.clientHeight - pixels(style.paddingBottom)) * parentScale;
                  bottom = Math.min(bottom, contentBottom);
                }
              }
              const workspace = root.querySelector('.td-workspace');
              const actions = root.querySelector('.td-actions');
              const help = root.querySelector('.td-help');
              // Keep a usable workspace in short windows; the host can scroll the complete form.
              const minimum = workspace ? (workspace.getBoundingClientRect().top - rect.top + (actions?.getBoundingClientRect().height || 0) + (help?.getBoundingClientRect().height || 0)) / scale
                + pixels(rootStyle.paddingBottom) + (help ? pixels(view.getComputedStyle(help).marginTop) : 0) + 240 : 0;
              const height = Math.max(Math.ceil(minimum), Math.floor((bottom - rect.top - scrollOffset) / scale));
              if (Number.isFinite(height) && height > 0 && root.style.getPropertyValue('--td-settings-height') !== height + 'px') root.style.setProperty('--td-settings-height', height + 'px');
            };
            const schedule = () => { if (!frame) frame = view.requestAnimationFrame(measure); };
            refreshLayout.current = schedule;
            // Observe the host bounds, never this height-controlled section or its scroll contents.
            const observer = view.ResizeObserver ? new view.ResizeObserver(schedule) : null;
            for (let parent = root.parentElement; parent; parent = parent.parentElement) {
              const style = view.getComputedStyle(parent);
              if (style.display !== 'contents' && /(auto|scroll|hidden|clip)/.test(style.overflowY)) observer?.observe(parent);
            }
            view.addEventListener('resize', schedule);
            view.visualViewport?.addEventListener('resize', schedule);
            schedule();
            return () => {
              refreshLayout.current = null;
              if (frame) view.cancelAnimationFrame(frame);
              observer?.disconnect();
              view.removeEventListener('resize', schedule);
              view.visualViewport?.removeEventListener('resize', schedule);
            };
          }, []);
          React.useEffect(() => { refreshLayout.current?.(); });
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
              if (value === undefined) delete next[field];
              if (next.role === 'inherit' && next.delivery === 'inherit' && next.enabled === undefined && (!next.placement || next.placement === 'inherit')) delete rules[id];
              else Object.defineProperty(rules, id, { value: next, enumerable: true, configurable: true, writable: true });
              return { ...current, rules };
            });
          }
          function moveSource(ids, index, direction) {
            if (index < 0 || index + direction < 0 || index + direction >= ids.length) return;
            if (ids === groupOrder || ids === packOrder) setSelectedId(rows.find(row => row.orderId === ids[index])?.id || selectedId);
            const siblings = [...ids];
            [siblings[index], siblings[index + direction]] = [siblings[index + direction], siblings[index]];
            saveSiblingOrder(ids, siblings);
          }
          function cancelChanges() {
            cancelGeneration(); setForm(copyConfig(baseline));
            if (compositionBaseline) setCompositionForm(copyComposition(compositionBaseline));
            setError(''); setNotice('cancelled'); setOrderNotice('');
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
            if (checked) setPacksOpen(true);
            const names = new Set(group.tools.map(tool => tool.name));
            change(current => ({ ...current, groups: toggle(current.groups, group.id, checked),
              tools: current.tools.filter(name => !names.has(name)), exclude: current.exclude.filter(name => !names.has(name)) }));
          }
          function selectTool(group, name, checked) {
            if (checked) setPacksOpen(true);
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
            h('label', { className: 'td-check td-tool' }, h('input', { type: 'checkbox', checked: isSelected(form, group, tool.name), disabled: Boolean(busy || generating), onChange: event => selectTool(group, tool.name, event.target.checked) }),
              h('span', { className: 'td-tool-text' }, h('code', null, tool.name), tool.description && h('span', { className: 'td-muted td-tool-description', title: packageText(tool.description) }, packageText(tool.description)))))));
          const capabilities = snapshot?.promptComposition?.capabilities;
          const compositionOrder = compositionForm?.order || [];
          const rows = ordered(sourceRows(snapshot), row => row.orderId || row.id, compositionOrder);
          const otherTools = snapshot?.otherTools || [];
          if (otherTools.length) rows.push({ id: 'unattributed-tools', label: t('otherTools'), owner: null, sources: [], policy: null, orderId: null, tools: otherTools });
          const promptItems = row => row.sources.length ? row.sources : row.policy && !(row.toolGroup && row.policy.kind === 'group') ? [row.policy] : [];
          const isArchived = source => source.canToggleInjection === true && resolveSetting(source, 'enabled').value === false;
          const archivedPrompts = rows.flatMap(row => promptItems(row).filter(isArchived).map(source => ({ row, source })));
          const packRows = form ? rows.filter(row => row.owner !== '@delthin/dsh-tool-wrap' && (row.toolGroup?.tools || row.tools || []).some(tool => isSelected(form, row.toolGroup, tool.name))) : [];
          const packIds = new Set(packRows.map(row => row.id));
          const packAnchor = rows.find(row => row.owner === '@delthin/dsh-tool-wrap');
          const toolRows = rows.filter(row => (row.toolGroup?.tools || row.tools || []).length);
          const outerRows = toolRows.filter(row => !packIds.has(row.id));
          const groupOrder = outerRows.filter(row => row.orderId).map(row => row.orderId);
          const packOrder = packRows.filter(row => row.orderId).map(row => row.orderId);
          const rowOrder = row => packIds.has(row.id) ? packOrder : groupOrder;
          const rowScope = row => packIds.has(row.id) ? 'packs' : 'groups';
          function setPackMembership(row, checked) {
            const tools = row.toolGroup?.tools || row.tools || [];
            if (busy || generating || !tools.length) return;
            setSelectedId(row.id);
            if (row.toolGroup) selectGroup(row.toolGroup, checked);
            else {
              const names = new Set(tools.map(tool => tool.name));
              change(current => ({ ...current, tools: [...current.tools.filter(name => !names.has(name)), ...(checked ? names : [])], exclude: current.exclude.filter(name => !names.has(name)) }));
              if (checked) setPacksOpen(true);
            }
          }
          function archivePrompt(source) {
            if (!canSort || !source.canToggleInjection) return;
            editRule(source.id, 'enabled', false);
          }
          function restorePrompt(source, row) {
            if (!canSort || !source.canToggleInjection) return;
            editRule(source.id, 'enabled', resolveSetting(source, 'enabled', false).value ? undefined : true);
            setSelectedId(source.id);
            setListView('injected');
            setCollapsedZones(current => ({ ...current, [zoneOf(source)]: false }));
          }
          const currentView = compositionForm ? listView : 'tools';
          const allPromptEntries = rows.flatMap(row => promptItems(row).map(source => ({ row, source })));
          const legacyGroups = new Map();
          for (const entry of allPromptEntries) {
            const id = entry.source.groupId ?? entry.source.parent ?? 'owner:' + encodeURIComponent(entry.source.owner);
            if (!legacyGroups.has(id)) legacyGroups.set(id, []);
            legacyGroups.get(id).push(entry);
          }
          const legacyEntries = ordered([...legacyGroups], entry => entry[0], compositionOrder)
            .flatMap(([, entries]) => ordered(entries, entry => entry.source.id, compositionOrder));
          const promptEntries = compositionForm?.sourceOrder ? ordered(legacyEntries, entry => entry.source.id, compositionForm.sourceOrder) : legacyEntries;
          const roleOf = source => resolveSetting(source, 'role').value;
          const placementsSupported = Array.isArray(capabilities?.placements);
          const placementOf = source => resolveSetting(source, 'placement').value;
          const zones = placementsSupported ? ['system', 'user-fixed', 'user-state'] : ['system', 'user'];
          const zoneRole = zone => zone.startsWith('user') ? 'user' : zone;
          const zonePlacement = zone => zone === 'user-fixed' ? 'fixed' : zone === 'user-state' ? 'state' : null;
          const zoneTitle = zone => t(zone === 'system' ? 'systemPrompts' : zone === 'user-fixed' ? 'userFixed' : zone === 'user-state' ? 'userState' : zone === 'user' ? 'userContext' : 'invalidRole');
          const zoneAction = zone => t(zone === 'system' ? 'moveToSystem' : zone === 'user-fixed' ? 'moveToFixed' : zone === 'user-state' ? 'moveToState' : 'moveToUser');
          const zoneOf = source => roleOf(source) === 'user' && placementsSupported ? ['fixed', 'state'].includes(placementOf(source)) ? 'user-' + placementOf(source) : 'invalid' : ['system', 'user'].includes(roleOf(source)) ? roleOf(source) : 'invalid';
          const roleOrders = Object.fromEntries([...zones, 'invalid'].map(zone => [zone, promptEntries.filter(({ source }) => !isArchived(source) && zoneOf(source) === zone).map(({ source }) => source.id)]));
          const promptOrderBase = current => current.sourceOrder ?? [...promptEntries.map(({ source }) => source.id), ...current.order.filter(id => compositionSources.get(id)?.kind === 'unavailable')];
          const saveSiblingOrder = (ids, siblings) => changeComposition(current => Object.values(roleOrders).includes(ids)
            ? { ...current, sourceOrder: mergeOrder(promptOrderBase(current), siblings) }
            : { ...current, order: mergeOrder(current.order, siblings) });
          const canMoveZone = (source, zone) => canSort && (roleOf(source) === zoneRole(zone) || source.roles.includes(zoneRole(zone)) && capabilities.roles.includes(zoneRole(zone)))
            && (!zonePlacement(zone) || placementOf(source) === zonePlacement(zone) || source.placements?.includes(zonePlacement(zone)) && capabilities.placements.includes(zonePlacement(zone)));
          function movePromptZone(source, zone, targetId = null, after = true) {
            if (!canMoveZone(source, zone) || source.id === targetId) return;
            const ids = promptEntries.map(entry => entry.source.id).filter(id => id !== source.id);
            const target = targetId ?? roleOrders[zone].filter(id => id !== source.id).at(-1);
            ids.splice(target ? ids.indexOf(target) + Number(after) : ids.length, 0, source.id);
            changeComposition(current => {
              const rule = current.rules[source.id] ?? { role: 'inherit', delivery: 'inherit' };
              const role = zoneRole(zone), placement = zonePlacement(zone);
              const next = { ...rule, ...(roleOf(source) !== role ? { role } : {}), ...(placement && placementOf(source) !== placement ? { placement } : {}) };
              return { ...current, sourceOrder: mergeOrder(promptOrderBase(current), ids),
                rules: roleOf(source) === role && (!placement || placementOf(source) === placement) ? current.rules : { ...current.rules, [source.id]: next } };
            });
            setCollapsedZones(current => ({ ...current, [zone]: false }));
            setSelectedId(source.id); setOrderNotice(t('roleMoveDraft'));
          }
          const promptDropProps = (zone, id = null) => ({
            onDragOver: event => {
              const from = drag.current?.scope === 'prompts' && promptEntries.find(entry => entry.source.id === drag.current.id)?.source;
              if (!from || !canMoveZone(from, zone) || from.id === id) return;
              event.preventDefault(); event.stopPropagation?.(); trackDragScroll(event);
              if (event.dataTransfer) event.dataTransfer.dropEffect = 'move';
              const rect = event.currentTarget.getBoundingClientRect();
              setDropTarget({ id: id ?? 'role:' + zone, after: id ? event.clientY > rect.top + rect.height / 2 : true });
            },
            onDrop: event => {
              const from = drag.current?.scope === 'prompts' && promptEntries.find(entry => entry.source.id === drag.current.id)?.source;
              if (!from || !canMoveZone(from, zone)) return;
              event.preventDefault(); event.stopPropagation?.();
              const rect = event.currentTarget.getBoundingClientRect();
              movePromptZone(from, zone, id, id ? event.clientY > rect.top + rect.height / 2 : true); finishDrag();
            },
          });
          const term = query.trim().toLocaleLowerCase();
          const matches = value => String(value || '').toLocaleLowerCase().includes(term);
          const matchesRow = row => matches(row.id) || matches(row.owner) || matches(packageText(row.label)) || matches(packageText(row.toolGroup?.description));
          const matchesTool = tool => matches(tool.name) || matches(packageText(tool.description));
          const matchesSource = source => matches(source.id) || matches(source.label) || matches(source.preview?.text);
          const visibleRows = rows.filter(row => !term || matchesRow(row) || (row.toolGroup?.tools || row.tools || []).some(matchesTool) || row.sources.some(matchesSource));
          const reasonText = reason => {
            const key = { 'host-adapter-required': 'hostRequired', 'explicit-source-adapter-required': 'sourceRequired', 'entrypoint-always': 'entryAlways', 'complete-persona-always': 'personaAlways', 'source-unavailable': 'sourceUnavailable', 'owner-unattributed-pack-unavailable': 'unattributedPack' }[reason];
            return key ? t(key) : reason || '';
          };
          const canSort = Boolean(compositionForm?.enabled && capabilities?.admission && !busy && !generating);
          function reorderSource(ids, from, to, after = false) {
            if (!canSort || from === to || !ids.includes(from) || !ids.includes(to)) return;
            if (ids === groupOrder || ids === packOrder) setSelectedId(rows.find(row => row.orderId === from)?.id || selectedId);
            const siblings = ids.filter(id => id !== from);
            siblings.splice(siblings.indexOf(to) + Number(after), 0, from);
            saveSiblingOrder(ids, siblings);
            setOrderNotice(t('orderDraft'));
          }
          function stopDragScroll() {
            const current = dragScroll.current;
            if (current?.frame) current.view.cancelAnimationFrame(current.frame);
            dragScroll.current = null;
          }
          function trackDragScroll(event) {
            if (!canSort || !drag.current) return;
            const view = event.currentTarget.ownerDocument?.defaultView;
            if (!view?.requestAnimationFrame || !Number.isFinite(event.clientY)) return;
            let element = event.currentTarget;
            while (element && element !== settingsElement.current?.parentElement) {
              if (element.scrollHeight > element.clientHeight && /^(auto|scroll)$/.test(view.getComputedStyle(element).overflowY)) break;
              element = element.parentElement;
            }
            if (!element || element === settingsElement.current?.parentElement) { stopDragScroll(); return; }
            event.preventDefault();
            if (dragScroll.current?.element === element) { dragScroll.current.y = event.clientY; return; }
            stopDragScroll();
            const current = { element, view, y: event.clientY, frame: 0, time: null };
            dragScroll.current = current;
            const tick = time => {
              current.frame = 0;
              if (!mounted.current || !drag.current || dragScroll.current !== current || !element.isConnected) { stopDragScroll(); return; }
              const bounds = element.getBoundingClientRect(), edge = Math.min(48, bounds.height / 3);
              const speed = current.y < bounds.top || current.y > bounds.bottom ? 0
                : current.y < bounds.top + edge ? -Math.min(1, (bounds.top + edge - current.y) / edge)
                : current.y > bounds.bottom - edge ? Math.min(1, (current.y - bounds.bottom + edge) / edge) : 0;
              if (!speed) { stopDragScroll(); return; }
              const before = element.scrollTop;
              element.scrollTop = Math.max(0, Math.min(element.scrollHeight - element.clientHeight,
                before + speed * 720 * Math.min(32, current.time === null ? 16 : time - current.time) / 1000));
              current.time = time;
              if (element.scrollTop === before) { stopDragScroll(); return; }
              current.frame = view.requestAnimationFrame(tick);
            };
            current.frame = view.requestAnimationFrame(tick);
          }
          const scrollDragProps = {
            onDragOver: trackDragScroll,
            onDragLeave: event => {
              const bounds = event.currentTarget.getBoundingClientRect();
              if (event.clientX < bounds.left || event.clientX >= bounds.right || event.clientY < bounds.top || event.clientY >= bounds.bottom) stopDragScroll();
            },
            onDrop: () => finishDrag(),
          };
          function finishDrag() { stopDragScroll(); drag.current = null; setDragging(null); setDropTarget(null); }
          const dropProps = (id, ids, scope) => ({
            onDragOver: event => {
              if (!canSort || !ids.includes(id) || drag.current?.scope !== scope || !ids.includes(drag.current.id) || drag.current.id === id) return;
              event.preventDefault(); event.dataTransfer.dropEffect = 'move';
              const rect = event.currentTarget.getBoundingClientRect();
              setDropTarget({ id, after: event.clientY > rect.top + rect.height / 2 });
            },
            onDrop: event => {
              if (!canSort || !ids.includes(id) || drag.current?.scope !== scope) return;
              event.preventDefault(); event.stopPropagation?.();
              const rect = event.currentTarget.getBoundingClientRect();
              reorderSource(ids, drag.current.id, id, event.clientY > rect.top + rect.height / 2);
              finishDrag();
            },
          });
          const dragClass = id => (id && dragging === id ? ' is-dragging' : '') + (dropTarget?.id === id ? dropTarget.after ? ' is-drop-after' : ' is-drop-before' : '');
          const sortKey = (event, ids, id) => {
            if (!canSort || !ids.includes(id) || !event.altKey || !['ArrowUp', 'ArrowDown'].includes(event.key)) return;
            event.preventDefault(); moveSource(ids, ids.indexOf(id), event.key === 'ArrowUp' ? -1 : 1); setOrderNotice(t('orderDraft'));
          };
          const arrowIcon = up => h('svg', { width: 14, height: 14, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.7, 'aria-hidden': true }, h('path', { d: up ? 'm6 14 6-6 6 6' : 'm6 10 6 6 6-6', strokeLinecap: 'round', strokeLinejoin: 'round' }));
          const dragHandle = (ids, id, label, scope) => h('button', {
            type: 'button', className: 'td-drag-handle', draggable: canSort && ids.includes(id), disabled: !canSort || !ids.includes(id),
            'aria-label': t('dragHint') + ' · ' + label, title: t(canSort && ids.includes(id) ? 'dragHint' : 'orderUnavailable'),
            onKeyDown: event => sortKey(event, ids, id),
            onDragStart: event => {
              if (!canSort || !ids.includes(id)) { event.preventDefault(); return; }
              drag.current = { id, scope }; setDragging(id); setDropTarget(null);
              event.dataTransfer.effectAllowed = 'move'; event.dataTransfer.setData('text/plain', id);
              const row = event.currentTarget.closest('[data-sort-id]');
              if (row && event.dataTransfer.setDragImage) { const rect = row.getBoundingClientRect(); event.dataTransfer.setDragImage(row, event.clientX - rect.left, event.clientY - rect.top); }
            }, onDragEnd: finishDrag,
          }, h('svg', { width: 12, height: 16, viewBox: '0 0 12 16', fill: 'currentColor', 'aria-hidden': true }, [4, 8, 12].flatMap(y => [4, 8].map(x => h('circle', { key: x + '-' + y, cx: x, cy: y, r: 1 })))));
          const orderButtons = (ids, id, label) => {
            const index = ids.indexOf(id);
            return h('span', { className: 'td-row-order' }, [-1, 1].map(direction => h('button', {
              key: direction, type: 'button', disabled: !canSort || index < 0 || index + direction < 0 || index + direction >= ids.length,
              'aria-label': t(direction < 0 ? 'moveUp' : 'moveDown') + ' · ' + label, title: t(direction < 0 ? 'moveUp' : 'moveDown'),
              onClick: () => { moveSource(ids, index, direction); setOrderNotice(t('orderDraft')); },
            }, arrowIcon(direction < 0))));
          };
          const compositionSources = new Map((snapshot?.promptComposition?.sources || []).map(source => [source.id, source]));
          function resolveSetting(source, field, includeOwn = true) {
            let value = field === 'enabled' ? true : 'inherit', origin = null;
            for (const id of ['owner:' + encodeURIComponent(source.owner), source.parent ?? source.groupId, source.id]) {
              if (!includeOwn && id === source.id) continue;
              const candidate = compositionForm?.rules[id]?.[field];
              if (field === 'enabled' ? typeof candidate === 'boolean' : candidate && candidate !== 'inherit') { value = candidate; origin = id; }
            }
            if (field === 'role' && value === 'inherit') value = source.defaultRole || 'inherit';
            if (field === 'placement' && value === 'inherit') value = source.defaultPlacement || (source.preview?.kind === 'static' ? 'fixed' : 'state');
            return { value, origin };
          }
          const settingValueLabel = (field, value) => value === 'inherit' ? field === 'role' ? '' : t('automatic') : t(value === 'always' ? 'alwaysShort' : value);
          const compositionControls = (source, label) => {
            const value = compositionForm?.rules[source.id]?.delivery ?? 'inherit';
            const choices = ['inherit', 'always', 'pack'].filter(option => source.deliveryModes.includes(option));
            const summaryId = scopeId + '-setting-' + encodeURIComponent(source.id) + '-delivery';
            const inherited = resolveSetting(source, 'delivery', false);
            const defaultLabel = t('defaultOption') + '：' + settingValueLabel('delivery', inherited.value);
            const origin = compositionSources.get(inherited.origin);
            const originLabel = origin ? packageText(origin.label, origin.id) : inherited.origin;
            const defaultTitle = originLabel ? text('followSource', { source: originLabel }) : defaultLabel;
            const optionLabel = option => option === 'inherit' ? defaultLabel : t(option === 'always' ? 'alwaysShort' : option);
            const disabled = !canSort || source.kind === 'unavailable' || !choices.length || (choices.length === 1 && choices.includes(value));
            const choose = option => { if (!disabled) editRule(source.id, 'delivery', option); };
            const keyDown = event => {
              if (disabled || event.altKey || event.ctrlKey || event.metaKey || !['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End'].includes(event.key)) return;
              event.preventDefault();
              const index = choices.indexOf(value), backwards = event.key === 'ArrowLeft' || event.key === 'ArrowUp';
              const next = event.key === 'Home' ? 0 : event.key === 'End' ? choices.length - 1 : index < 0 ? (backwards ? choices.length - 1 : 0) : (index + (backwards ? -1 : 1) + choices.length) % choices.length;
              choose(choices[next]);
              event.currentTarget?.parentElement?.querySelectorAll('[role="radio"]')[next]?.focus();
            };
            const unavailable = !choices.includes(value);
            return h('div', { className: 'td-composition-controls' },
              h('div', { className: 'td-choice-row', 'data-field': 'delivery', 'data-source-id': source.id },
                h('span', { className: 'td-choice-label' }, t('deliveryShort')),
                h('div', { className: 'td-choice-options' },
                  unavailable && h('span', { className: 'td-unavailable', role: 'status' }, optionLabel(value) + ' · ' + t('savedUnavailable')),
                  choices.length ? h('div', { className: 'td-segments', role: 'radiogroup', 'aria-label': t('delivery') + ' · ' + label, 'aria-describedby': summaryId, 'aria-disabled': disabled, title: reasonText(source.reason) },
                    choices.map((option, index) => h('button', { key: option, type: 'button', className: 'td-segment', role: 'radio', value: option, title: option === 'inherit' ? defaultTitle : undefined, 'aria-checked': value === option, tabIndex: value === option || (unavailable && index === 0) ? 0 : -1, disabled, onClick: () => choose(option), onKeyDown: keyDown }, optionLabel(option))))
                    : h('span', { className: 'td-readonly' }, settingValueLabel('delivery', resolveSetting(source, 'delivery').value))),
                h('span', { className: 'td-sr-only', id: summaryId }, defaultTitle)));
          };
          const stat = (key, value) => h('div', { className: 'td-stat', key }, h('dt', null, t(key)), h('dd', null, value));
          const charValue = value => text('chars', { value: number(value) });
          const deltaStat = value => stat(value < 0 ? 'addedChars' : 'savedChars', charValue(typeof value === 'number' ? Math.abs(value) : value));
          const estimate = snapshot?.estimate;
          const assembly = snapshot?.lastAssembly;
          const totalTools = rows.reduce((sum, row) => sum + (row.toolGroup?.tools || row.tools || []).length, 0);
          const compositionReason = capabilities && !capabilities.admission ? reasonText(capabilities.reason || 'host-adapter-required') : '';
          const rowLabel = row => row.id === 'instructions:global' ? t('globalInstructions') : row.id === 'instructions:project' ? t('projectInstructions') : row.id === 'owner:' + encodeURIComponent('@host/unknown') ? t('unattributedSources') : packageText(row.label, row.id);
          const visibleArchive = archivedPrompts.filter(({ row, source }) => !term || matchesRow(row) || matchesSource(source));
          const visiblePromptEntries = promptEntries.filter(({ row, source }) => !term || matchesRow(row) || matchesSource(source));
          const selectedPrompts = visiblePromptEntries.filter(({ source }) => currentView === 'archive' ? isArchived(source) : !isArchived(source));
          const activePrompt = currentView !== 'tools' ? selectedPrompts.find(({ source }) => source.id === selectedId) || selectedPrompts[0] : null;
          const detailRows = visibleRows.filter(row => toolRows.includes(row) || !promptItems(row).length && row.toolGroup);
          const activeRow = currentView === 'tools' ? detailRows.find(row => row.id === selectedId) || detailRows[0] : activePrompt?.row;
          const detailId = scopeId + '-detail';
          const rowDirty = row => {
            const ids = [row.policy?.id, ...row.sources.map(source => source.id)].filter(Boolean);
            if (compositionForm && compositionBaseline && ids.some(id => JSON.stringify(compositionForm.rules[id]) !== JSON.stringify(compositionBaseline.rules[id]) || compositionForm.order.indexOf(id) !== compositionBaseline.order.indexOf(id))) return true;
            const group = row.toolGroup;
            return Boolean(group && form && baseline && (form.groups.includes(group.id) !== baseline.groups.includes(group.id) || form.descriptions[group.id] !== baseline.descriptions[group.id] || group.tools.some(tool => isSelected(form, group, tool.name) !== isSelected(baseline, group, tool.name))));
          };
          const displayName = row => {
            const label = rowLabel(row), shortName = label.startsWith('@') ? label.slice(label.indexOf('/') + 1) : label;
            return shortName.startsWith('dsh-') ? shortName.slice(4) : shortName;
          };
          const packListId = scopeId + '-packs';
          const disclosureIcon = expanded => h('svg', { width: 14, height: 14, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.7, 'aria-hidden': true }, h('path', { d: expanded ? 'M5 12h14' : 'M5 12h14M12 5v14', strokeLinecap: 'round' }));
          const actionIcon = action => h('svg', { width: 15, height: 15, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.7, 'aria-hidden': true }, h('path', { d: action === 'archive' ? 'M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M10 10v7M14 10v7' : action === 'lock' ? 'M7 10V7a5 5 0 0 1 10 0v3M5 10h14v11H5zM12 14v3' : 'M4 5h6l2 2h8v13H4zM8 13h8m-3-3 3 3-3 3', strokeLinecap: 'round', strokeLinejoin: 'round' }));
          const packDisclosure = () => h('button', { type: 'button', className: 'td-pack-toggle', 'aria-label': t('onDemandPacks'), 'aria-expanded': Boolean(term || packsOpen), 'aria-controls': packListId, onClick: () => setPacksOpen(current => !current) }, disclosureIcon(term || packsOpen));
          const packAction = (row, compact = false) => h('button', { type: 'button', className: compact ? 'td-list-action td-pack-action' : 'td-pack-move', disabled: Boolean(busy || generating),
            'aria-label': t(packIds.has(row.id) ? 'removePack' : 'addPack') + ' · ' + rowLabel(row), title: t(packIds.has(row.id) ? 'removePackHint' : 'addPackHint'), onClick: () => setPackMembership(row, !packIds.has(row.id)) }, compact ? t(packIds.has(row.id) ? 'moveOut' : 'moveIn') : t(packIds.has(row.id) ? 'removePack' : 'addPack'));
          const promptAction = source => {
            const invalid = !source.canToggleInjection && typeof compositionForm?.rules[source.id]?.enabled === 'boolean';
            if (invalid) return h('button', { type: 'button', className: 'td-list-action', 'aria-label': t('resetInjection') + ' · ' + source.label, title: t('savedUnavailable'), disabled: !canSort, onClick: () => editRule(source.id, 'enabled', undefined) }, t('resetInjection'));
            if (!source.canToggleInjection) return h('span', { className: 'td-fixed-source', title: reasonText(source.reason) || t('injectionFixed'), 'aria-label': t('injectionFixed') + ' · ' + source.label }, actionIcon('lock'));
            return h('button', { type: 'button', className: 'td-list-action td-archive-action', 'aria-label': t('archivePrompt') + ' · ' + source.label, title: t('archivePrompt'), disabled: !canSort, onClick: () => archivePrompt(source) }, actionIcon('archive'));
          };
          const renderRow = row => {
            const group = row.toolGroup, tools = group?.tools || row.tools || [], label = rowLabel(row), ids = rowOrder(row), scope = rowScope(row);
            const selected = tools.filter(tool => isSelected(form, group, tool.name)).length;
            return h('li', { key: row.id, className: 'td-group' + (activeRow?.id === row.id && currentView === 'tools' ? ' is-selected' : '') + dragClass(row.orderId), 'data-source-id': row.id, 'data-sort-id': row.orderId, ...dropProps(row.orderId, ids, scope) },
              dragHandle(ids, row.orderId, label, scope),
              h('div', { className: 'td-source-content' },
                h('button', { type: 'button', className: 'td-source-main', 'aria-label': t('sourceDetails') + ' · ' + label, 'aria-current': activeRow?.id === row.id && currentView === 'tools' ? 'true' : undefined, 'aria-controls': detailId, title: label,
                  onClick: () => { setListView('tools'); setSelectedId(row.id); }, onKeyDown: event => sortKey(event, ids, row.orderId) },
                  h('span', { className: 'td-source-line1' }, h('span', { className: 'td-source-name' }, displayName(row)), rowDirty(row) && h('span', { className: 'td-dirty-dot', title: t('dirty') }))),
                h('div', { className: 'td-source-line2' }, h('span', { className: 'td-count', 'aria-label': text('selected', { selected, total: tools.length }) }, text('toolSelectionCount', { selected, total: tools.length })))),
              h('div', { className: 'td-outer-action-slot' }, row === packAnchor ? h('span', { className: 'td-fixed-source', title: t('entryAlways') }, actionIcon('lock')) : packAction(row, true)));
          };
          const visiblePacks = visibleRows.filter(row => packIds.has(row.id));
          const showPacks = !term || visiblePacks.length > 0;
          const renderPacks = () => h('li', { key: 'packs', className: 'td-pack-group' },
            h('div', { className: 'td-pack-heading' }, packDisclosure(), h('strong', null, t('onDemandPacks')), h('span', { className: 'td-count' }, packRows.length)),
            h('ul', { className: 'td-pack-list', id: packListId, hidden: !term && !packsOpen, 'aria-label': t('onDemandPacks') }, visiblePacks.length ? visiblePacks.map(row => renderRow(row)) : h('li', { className: 'td-muted td-pack-empty' }, t('emptyPacks'))));
          const listPanelId = name => scopeId + '-source-' + name;
          const selectListView = name => { if (name !== currentView) { setListView(name); setSelectedId(''); finishDrag(); } };
          const listTabKey = event => {
            if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
            event.preventDefault();
            const names = compositionForm ? ['injected', 'archive', 'tools'] : ['tools'];
            const index = names.indexOf(currentView), next = names[event.key === 'Home' ? 0 : event.key === 'End' ? names.length - 1 : (index + (event.key === 'ArrowRight' ? 1 : names.length - 1)) % names.length];
            selectListView(next); event.currentTarget.parentElement.querySelector('[data-list-view="' + next + '"]')?.focus();
          };
          const sourceLocation = source => {
            if (source.kind === 'instructions' && source.id.startsWith('instructions:')) {
              try { return decodeURIComponent(source.id.slice('instructions:'.length)); } catch { /* Keep legacy labels readable. */ }
            }
            return packageText(source.label, source.id);
          };
          const promptLabel = source => {
            if (source.id === 'instructions:global') return t('globalInstructions');
            if (source.id === 'instructions:project') return t('projectInstructions');
            const peers = promptEntries.filter(entry => entry.source.kind === 'instructions' && entry.source.label === source.label);
            if (source.kind !== 'instructions' || peers.length < 2) return packageText(source.label, source.id);
            const parts = sourceLocation(source).split('/');
            for (let size = 2; size <= parts.length; size++) {
              const suffix = parts.slice(-size).join('/');
              if (peers.every(entry => entry.source.id === source.id || sourceLocation(entry.source).split('/').slice(-size).join('/') !== suffix)) return suffix;
            }
            return sourceLocation(source);
          };
          const sourceCaption = (row, source) => {
            const ambiguous = source.name && promptEntries.some(entry => entry.source.id !== source.id && entry.source.kind === source.kind && entry.source.name === source.name);
            const origin = source.catalogOrigin === 'registered' ? t('registeredSource') : source.catalogOrigin === 'observed' ? t('observedSource') : '';
            return displayName(row) + (ambiguous && origin ? ' · ' + origin : '');
          };
          const selectPrompt = source => setSelectedId(source.id);
          const renderPromptRow = ({ row, source }, role) => h('li', { key: source.id, className: 'td-group td-prompt-row' + (activePrompt?.source.id === source.id ? ' is-selected' : '') + dragClass(source.id), 'data-prompt-id': source.id, 'data-sort-id': source.id, ...(zones.includes(role) ? promptDropProps(role, source.id) : {}) },
            dragHandle(roleOrders[role], source.id, source.label, 'prompts'),
            h('button', { type: 'button', className: 'td-source-main', 'aria-label': t('promptDetails') + ' · ' + source.label, 'aria-current': activePrompt?.source.id === source.id ? 'true' : undefined, 'aria-controls': detailId, title: sourceLocation(source), onClick: () => selectPrompt(source), onKeyDown: event => sortKey(event, roleOrders[role], source.id) },
              h('span', { className: 'td-source-name' }, promptLabel(source)), h('span', { className: 'td-source-line2' }, sourceCaption(row, source))), promptAction(source));
          const renderRoleZone = role => {
            const entries = visiblePromptEntries.filter(({ source }) => !isArchived(source) && zoneOf(source) === role);
            if (role === 'invalid' && !entries.length) return null;
            const collapsed = Boolean(collapsedZones[role]), listId = scopeId + '-zone-' + role;
            const action = t(collapsed ? 'expandZone' : 'collapseZone');
            return h('section', { key: role, className: 'td-role-zone' + (collapsed ? ' is-collapsed' : '') + dragClass('role:' + role), 'data-role-zone': role, 'aria-label': zoneTitle(role), ...(zones.includes(role) ? promptDropProps(role) : {}) },
              h('div', { className: 'td-role-zone-heading' }, h('h3', null, h('button', { type: 'button', className: 'td-zone-toggle', 'aria-label': action + ' · ' + zoneTitle(role), 'aria-expanded': !collapsed, 'aria-controls': listId, onClick: () => { stopDragScroll(); setCollapsedZones(current => ({ ...current, [role]: !collapsed })); } },
                h('span', null, zoneTitle(role)), h('span', { className: 'td-count' }, entries.length), h('span', { className: 'td-zone-toggle-label', 'aria-hidden': true }, action)))),
              h('ul', { className: 'td-role-list', id: listId, hidden: collapsed }, entries.length ? entries.map(entry => renderPromptRow(entry, role)) : h('li', { className: 'td-muted td-role-empty' }, t(term ? 'noResults' : 'emptyRole'))));
          };
          const renderArchive = () => h('ul', { className: 'td-archive-list' }, visibleArchive.length ? visibleArchive.map(({ row, source }) => h('li', { key: source.id, 'data-archived-id': source.id },
            h('button', { type: 'button', className: 'td-archive-source', title: source.label + ' · ' + rowLabel(row), 'aria-label': t('promptDetails') + ' · ' + source.label, 'aria-current': activePrompt?.source.id === source.id && currentView === 'archive' ? 'true' : undefined, 'aria-controls': detailId, onClick: () => selectPrompt(source) }, h('span', null, promptLabel(source)), h('small', null, sourceCaption(row, source))),
            h('button', { type: 'button', className: 'td-list-action', disabled: !canSort, 'aria-label': t('restorePrompt') + ' · ' + source.label, onClick: () => restorePrompt(source, row) }, t('restorePrompt')))) : h('li', { className: 'td-muted td-archive-empty', role: 'status' }, t(term ? 'noResults' : 'emptyArchive')));
          const renderPrompt = source => {
            const preview = source.preview, body = preview?.kind === 'static' && typeof preview.text === 'string' ? preview.text : null;
            const expanded = Boolean(expandedPrompts[source.id]);
            const bodyId = scopeId + '-body-' + encodeURIComponent(source.id);
            return h('div', { className: 'td-prompt-card' },
              source.reason && h('p', { className: 'td-source-reason' }, reasonText(source.reason)),
              body !== null ? (body ? h('pre', { id: bodyId, className: 'td-prompt-body' + (expanded ? ' is-expanded' : ''), tabIndex: 0, 'aria-label': source.label }, body) : h('div', { className: 'td-preview-notice' }, t('emptyPreview')))
                : h('div', { className: 'td-preview-notice' }, t(preview?.reason === 'tool-directory-assembly-required' ? 'directoryPreview' : preview?.kind === 'dynamic' ? 'dynamicPreview' : 'unavailablePreview')),
              body !== null && h('div', { className: 'td-prompt-foot' }, h('span', { title: t('staticPreview') }, charValue(body.length)),
                body && h('button', { type: 'button', 'aria-expanded': expanded, 'aria-controls': bodyId, onClick: () => setExpandedPrompts(current => ({ ...current, [source.id]: !expanded })) }, t(expanded ? 'collapseFull' : 'showFull'))));
          };
          const renderDetail = row => {
            if (!row) return h('div', { className: 'td-detail', ...scrollDragProps, id: detailId }, h('p', { className: 'td-muted td-empty', role: 'status' }, t(term ? 'noResults' : currentView === 'archive' ? 'emptyArchive' : 'emptyCatalog')));
            const group = row.toolGroup, tools = group?.tools || row.tools || [], label = rowLabel(row);
            if (currentView === 'tools') return h('div', { className: 'td-detail', ...scrollDragProps, id: detailId, key: row.id, role: 'region', 'aria-label': t('detailsLabel') + ' · ' + label },
              h('div', { className: 'td-detail-title-row' }, h('h3', { title: row.owner || row.id }, displayName(row)), orderButtons(rowOrder(row), row.orderId, label)),
              tools.length > 0 && row !== packAnchor && h('div', { className: 'td-tool-policy' }, packAction(row)),
              tools.length ? toolList(tools, group, scopeId + '-tools') : h('p', { className: 'td-muted' }, t('noTools')),
              group && h('details', { key: row.id + '-description' }, h('summary', null, t('descriptionSection')), descriptionEditor(group, scopeId + '-description')));
            const source = activePrompt.source, zone = zoneOf(source), ids = roleOrders[zone] || roleOrders.invalid;
            const rule = compositionForm?.rules[source.id], inherited = resolveSetting(source, 'role', false).value;
            const resetLabel = t(placementsSupported ? 'resetGrouping' : 'resetRole');
            const inheritedZone = inherited === 'user' && placementsSupported ? 'user-' + resolveSetting(source, 'placement', false).value : inherited;
            const roleUnavailable = !source.roles.includes(rule?.role ?? 'inherit') || !capabilities?.roles?.includes(rule?.role ?? 'inherit') || placementsSupported && rule?.placement && !source.placements?.includes(rule.placement);
            return h('div', { className: 'td-detail', ...scrollDragProps, id: detailId, key: source.id, role: 'region', 'aria-label': t('promptDetails') + ' · ' + source.label },
              h('div', { className: 'td-detail-header' }, h('div', { className: 'td-detail-title-row' }, h('h3', { title: sourceLocation(source) }, promptLabel(source)), currentView === 'injected' && orderButtons(ids, source.id, source.label)),
                h('div', { className: 'td-source-line2' }, sourceCaption(row, source), h('span', { 'aria-hidden': true }, '·'), zoneTitle(zone))),
              roleUnavailable && h('p', { className: 'td-unavailable', role: 'status' }, t('savedUnavailable') + ' · ' + t('role')),
              renderPrompt(source),
              h('details', { className: 'td-prompt-options' }, h('summary', null, t('morePrompt')),
                h('div', { className: 'td-prompt-actions' }, zones.filter(target => target !== zone).map(target => h('button', { key: target, type: 'button', disabled: !canMoveZone(source, target), 'aria-label': zoneAction(target) + ' · ' + source.label, onClick: () => movePromptZone(source, target) }, zoneAction(target))),
                  h('button', { type: 'button', disabled: !canSort || !source.roles.includes('inherit') || !rule || rule.role === 'inherit' && (!rule.placement || rule.placement === 'inherit'), 'aria-label': resetLabel + ' · ' + source.label, title: t('defaultOption') + '：' + (placementsSupported ? zoneTitle(inheritedZone) : settingValueLabel('role', inherited)), onClick: () => { editRule(source.id, 'role', 'inherit'); if (placementsSupported) editRule(source.id, 'placement', undefined); setCollapsedZones(current => ({ ...current, [inheritedZone]: false })); } }, resetLabel)),
                compositionControls(source, source.label)),
              group && !tools.length && h('details', { key: row.id + '-description' }, h('summary', null, t('descriptionSection')), descriptionEditor(group, scopeId + '-description')));
          };
          return h('section', { ref: settingsElement, className: 'td-settings', 'aria-label': t('title'), 'aria-busy': Boolean(busy) },
            h('style', null, styles), h('div', { className: 'td-topbar' }, h('h2', null, t('title'))),
            error && h('p', { className: 'td-error', role: 'alert' }, error),
            !form ? (busy ? h('p', { role: 'status' }, t('loading')) : h('button', { onClick: () => load(true) }, t('retry'))) :
            h(React.Fragment, null,
              h('form', { onSubmit: save },
                h('div', { className: 'td-switches' },
                  h('label', { className: 'td-switch-card', title: t('discoveryHint') }, h('span', { className: 'td-switch-title' }, t('enabled')),
                    h('input', { type: 'checkbox', role: 'switch', className: 'td-switch', checked: form.enabled, disabled: Boolean(busy || generating), 'aria-label': t('enabled'),
                      onChange: event => { const checked = event.target.checked; change(current => ({ ...current, enabled: checked })); } })),
                  compositionForm && h('label', { className: 'td-switch-card', title: t('compositionHint') }, h('span', { className: 'td-switch-title' }, t('compositionEnable')),
                    h('input', { type: 'checkbox', role: 'switch', className: 'td-switch', checked: compositionForm.enabled, disabled: Boolean(busy || generating) || (!capabilities?.admission && !compositionForm.enabled), 'aria-label': t('compositionEnable'),
                      onChange: event => { const enabled = event.target.checked; changeComposition(current => ({ ...current, enabled })); } }))),
                compositionReason && h('p', { className: 'td-muted', role: 'status' }, compositionReason),
                compositionForm && !compositionForm.enabled && capabilities?.admission && h('p', { className: 'td-muted' }, t('compositionInactive')),
                !compositionForm && h('p', { className: 'td-muted' }, t('compositionMissing')),
                h('div', { className: 'td-workspace' },
                  h('aside', { className: 'td-master', 'aria-label': t('sources') },
                    h('div', { className: 'td-master-tabs', role: 'tablist', 'aria-label': t('promptSettings') }, (compositionForm ? ['injected', 'archive', 'tools'] : ['tools']).map(name => h('button', { key: name, type: 'button', role: 'tab', id: listPanelId(name) + '-tab', 'data-list-view': name, 'aria-selected': currentView === name, 'aria-controls': listPanelId(name), tabIndex: currentView === name ? 0 : -1, onClick: () => selectListView(name), onKeyDown: listTabKey }, t(name === 'injected' ? 'injectedTab' : name === 'tools' ? 'toolsTitle' : 'archive'), h('span', { className: 'td-count' }, name === 'archive' ? archivedPrompts.length : name === 'tools' ? toolRows.length : promptEntries.filter(({ source }) => !isArchived(source)).length)))),
                    h('div', { className: 'td-master-header' },
                      h('input', { type: 'search', value: query, placeholder: t('search'), 'aria-label': t('search'), onChange: event => { setQuery(event.target.value); if (event.target.value.trim()) setCollapsedZones({}); } }),
                      h('div', { className: 'td-master-summary' }, h('span', { title: t('catalogScope') }, text('catalogSummary', { plugins: rows.length, tools: totalTools })),
                        h('button', { type: 'button', disabled: Boolean(busy || generating), onClick: () => load(false) }, t(busy === 'loading' ? 'refreshing' : 'refresh')))),
                    h('div', { className: 'td-master-panel', id: listPanelId('injected'), role: 'tabpanel', 'aria-labelledby': listPanelId('injected') + '-tab', hidden: currentView !== 'injected' },
                      h('div', { className: 'td-master-list td-role-master-list', ...scrollDragProps }, [...zones, 'invalid'].map(renderRoleZone))),
                    h('div', { className: 'td-master-panel', id: listPanelId('archive'), role: 'tabpanel', 'aria-labelledby': listPanelId('archive') + '-tab', hidden: currentView !== 'archive' }, renderArchive()),
                    h('div', { className: 'td-master-panel', id: listPanelId('tools'), role: 'tabpanel', 'aria-labelledby': listPanelId('tools') + '-tab', hidden: currentView !== 'tools' },
                      h('ul', { className: 'td-master-list td-tools-master-list', ...scrollDragProps }, outerRows.filter(row => visibleRows.includes(row)).map(row => renderRow(row)), showPacks && renderPacks()))),
                  renderDetail(activeRow)),
                h('div', { className: 'td-actions' },
                  h('p', { className: 'td-feedback' + (notice && notice !== 'partialSaved' ? ' td-success' : ' td-muted'), role: 'status' }, notice ? t(notice) : dirty ? (orderNotice || t('dirty')) : ''),
                  compositionForm && h('button', { type: 'button', disabled: Boolean(busy || generating), onClick: () => { changeComposition(() => ({ version: 1, enabled: false, order: [], rules: {} })); setNotice('compositionDefaultDraft'); } }, t('compositionDefault')),
                  h('button', { type: 'button', disabled: Boolean(busy) || (!dirty && !generating), onClick: cancelChanges }, t('cancel')),
                  h('button', { type: 'submit', className: 'td-primary', disabled: Boolean(busy || generating) || !dirty }, t(busy === 'save' ? 'saving' : 'save')))),
              h('details', { className: 'td-help', onToggle: () => refreshLayout.current?.() }, h('summary', null, t('help')),
                h('p', { className: 'td-muted' }, t('scope')), h('p', { className: 'td-muted' }, t('hiddenHint')),
                h('p', { className: 'td-muted' }, t('groupHint')),
                compositionForm && h('p', { className: 'td-muted' }, t('compositionScope')),
                snapshot.warnings.length > 0 && h('div', { role: 'status', 'aria-label': t('warnings') }, snapshot.warnings.map((warning, index) => h('p', { className: 'td-muted', key: index }, warning))),
                h('div', { className: 'td-heading' }, h('h3', null, t('observations'))),
                h('h4', null, t('estimate')),
                toolsDirty && h('p', { className: 'td-muted', role: 'status' }, t('estimateDraft')),
                estimate?.savedChars < 0 && h('p', { className: 'td-muted' }, t('netIncrease')),
                h('dl', null, stat('before', charValue(estimate?.beforeChars)), stat('after', charValue(estimate?.afterChars)),
                  deltaStat(estimate?.savedChars),
                  stat('hidden', number(estimate?.hiddenCount))),
                h('p', { className: 'td-muted' }, t('tokenHint')),
                h('h4', null, t('lastAssembly')),
                h('p', { className: 'td-muted' }, t('recordScope')),
                h('div', { className: 'td-last-record' }, assembly?.status === 'projected'
                  ? h('dl', null, stat('before', charValue(assembly.beforeChars)), stat('after', charValue(assembly.afterChars)),
                    deltaStat(assembly.savedChars), stat('hidden', number(assembly.hiddenCount)))
                  : h('p', { className: 'td-muted' }, t(!assembly ? 'noAssembly' : assembly.status === 'native-unchanged' ? 'nativeUnchanged' : assembly.status === 'disabled' ? 'discoveryDisabled' : 'notApplied'))),
                h('details', null, h('summary', null, t('diagnostics')),
                  h('p', { className: 'td-muted' }, t('discoveryFlow')), h('p', { className: 'td-muted' }, t('summaryRule')),
                  h('p', { className: 'td-muted' }, t('observationHint')),
                  h('dl', null, stat(estimate?.savedChars < 0 ? 'tokensAddedLabel' : 'tokensLabel', text('tokens', { value: number(typeof estimate?.savedChars === 'number' ? Math.round(Math.abs(estimate.savedChars) / 4) : undefined) })),
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
