# Changelog / 变更日志

All notable verified changes to `@delthin/dsh-tool-wrap` are documented in this file.
本文件记录 `@delthin/dsh-tool-wrap` 已核实的主要变更。

## Unreleased / 未发布

- **CN**: 新增兼容的 `unwrap({ format: "schema" })` 精简结果，保留完整原始 Schema 并省略重复 SDK；独立工具目录按名称稳定排序。
- **EN**: Add opt-in schema-only unwrap results without losing original constraints; retain the legacy full result by default and sort standalone directory entries deterministically.
- **CN**: 失效的提示词设置可逐字段恢复；占用统计区分草稿与已保存设置，并明确显示净增加及粗估边界。补充权威实践来源。
- **EN**: Recover unsupported prompt settings per field; distinguish saved estimates from drafts, show net increases explicitly, and document primary-source design references.

- **CN**: 「注入」自动按实际角色上下分为系统提示词与用户上下文；逐段展示，跨区拖动改变角色，同区支持拖动和键盘排序。右侧正文优先，「更多」收纳移动、恢复默认及加载策略，保留独立滚动和草稿操作。
- **EN**: Automatically split Injected into upper System prompts and lower User context. Show individual prompts, change roles by cross-section dragging, reorder within sections by drag or keyboard, and place move/reset/delivery actions under More. Preserve independent scrolling and drafts.
- **CN**: 工具移至独立「工具」页签，已选插件归入可折叠「按需工具包」二级列表；保留外层与包间排序、明确移入/移出及单项选择，提示词角色变化不影响工具选择。
- **EN**: Manage tools in a separate Tools tab with nested on-demand packs, independent outer/pack ordering, explicit move-in/out and individual selection. Prompt role changes do not affect tools.
- **CN**: 「不注入」保留可恢复的逐段排除，恢复后选中该段并按角色归类。可选 `sourceOrder` 支持跨插件实际注入顺序，旧 `order`、组规则及缺失来源设置保持兼容，未知新增来源仍校验拒绝。
- **EN**: Preserve recoverable per-prompt exclusions and restore the selected prompt to its effective role. Optional sourceOrder supports real cross-plugin injection order while retaining legacy order, group rules and absent sources, with unknown new IDs still rejected.
- **CN**: 修复已识别纯工具插件无法排序；拖动靠近列表或详情边缘时持续滚动，离开、放下和卸载时停止。区分动态正文、暂无预览与来源未找到。
- **EN**: Make trusted tools-only plugins orderable, continuously scroll at list/detail drag edges with lifecycle cleanup, and distinguish dynamic bodies, missing previews and absent sources.
- **Preview safety / 预览边界**: Only global registration literals are exposed; variables remain unresolved and dynamic providers are never evaluated. Scoped and observed conversation bodies stay isolated.

## [1.2.0]

### Unified Prompt Composition / 统一提示词编排
- **CN**: 统一列出宿主基础/persona、全局与项目逐文件 AGENTS、插件 section/context、可信 ContextFormed pre-step 注入及 unwrap 目录；真实注册来源不按名称猜测。支持整组/逐源排序、字段级继承、system/user 角色与常驻/随工具包加载。默认关闭，普通用户对话与 relay/notice/recall 不参与角色提升。
- **EN**: Unified host/persona, per-file AGENTS, registered sections/contexts, trusted ContextFormed pre-step injections and unwrap directory sources. Added group/source order, field-level inheritance, system/user roles and resident/pack delivery without guessing plugin ownership or promoting ordinary conversation data.
- **Persistence / 持久化**: Independent `prompt-composition.json` and authenticated composition APIs migrate legacy v1 order without deleting it. Unknown existing settings survive plugin removal. Atomic 0600 writes and capability checks reject unsupported choices; developer roles remain unavailable.
- **Host support / 宿主支持**: Explicit, hash/version/shape-checked local adaptation runs after persona enforcement and final context refresh, before message persistence. Original producer messages remain auditable; logged surface replacements preserve replay and role demotion clears historical system copies. Apply/restore assets never execute through npm lifecycle hooks or restart services.
- **Packs / 工具包**: Unwrap returns full caller-visible schemas and same-step, same-scope plugin guidance. The directory is an independent always-resident contribution; native transport, guards, approvals and tool admission remain unchanged. Global source catalogs retain metadata only.
- **Startup / 启动**: `system-prompt` waits on `toolDiscoveryPromptOriginsReady`; custom inject overlays must retain existing dependencies. Initial origin capture and host-adapter activation require an authorized restart. No live deployment is performed by the assets themselves.

### Model Tool Rename / 模型工具更名
- **CN**: 正式模型入口改为 `unwrap`；新普通 PTC SDK、常驻概览及示例不展示旧名，registry 保留 `discover_tools` 供旧会话兼容调用。原始 SDK 仍逐字精确匹配后才投影；关闭与原生模式不准入两种名称。配置禁止在 `tools` / `exclude` 选择 `run_code`、`unwrap`、`discover_tools`。
- **EN**: Renamed the official model tool to `unwrap`, keeping `discover_tools` callable only for legacy sessions and hiding it from projected SDKs. Raw SDK exact-match guards, conditional admission, caller scope/toolSet and original execution permissions remain unchanged. Examples return a complete pack or print its full JSON serialization rather than a raw inspected object.
- **Validation / 验证**: `npm test` (macOS): 97 tests, 93 passed, 0 failed, 4 skipped (`sandbox_apply: Operation not permitted`); exit code 0.

### Package & Repository Migration / 包名与仓库迁移
- **CN**: 由原本地包 `dsh-tool-discovery` 迁移至 `Delthin/dsh-plugins` 工作区包 `@delthin/dsh-tool-wrap`（`1.2.0`，配置 `publishConfig.access: "public"`），许可证统一为 `Apache-2.0` 开源许可证（参见 [`LICENSE`](../../LICENSE)，允许商业使用、修改与分发，需保留版权与许可声明并标明修改，专利与完整条款以许可证原文为准）。
- **EN**: Migrated from legacy local package `dsh-tool-discovery` to `@delthin/dsh-tool-wrap` (`1.2.0`, configured with `publishConfig.access: "public"`) in the `Delthin/dsh-plugins` monorepo under the `Apache-2.0` open-source license (see [`LICENSE`](../../LICENSE); permits commercial use, modification, and distribution subject to retaining copyright/license notices, stating file modifications, and the patent terms in the license).
- **CN**: 保留旧工具名（`discover_tools`）兼容调用、服务标识、设置页路由 ID、启动门控服务名（`toolDiscoveryOriginsReady`）及 profile 配置文件名（`tool-discovery.json`）；客户端、图标与 locale 导出统一收敛为 `@delthin/dsh-tool-wrap` 作用域路径。升级时需先备份原配置并移除旧包，避免新旧实例同时启用。
- **EN**: Preserved legacy tool alias (`discover_tools`), service IDs, settings page route ID, startup readiness service (`toolDiscoveryOriginsReady`), and profile config filename (`tool-discovery.json`), while scoping client, icon, and locale exports under `@delthin/dsh-tool-wrap`. Users must back up existing configuration and disable the legacy package before enabling the new package.

### Host Contract & Runtime Compatibility / 宿主契约与运行兼容
- **CN**: 最低宿主版本要求更新为 `@deepseek-ai/dsh >= 0.2.2-rc.1`、`@deepseek-ai/dsh-tools >= 0.2.2-rc.1` 与 `@deepseek-ai/dsh-tool-executor-ptc >= 0.2.2-rc.1`（配合 `Node.js >= 22`、`@deepseek-ai/cordis >= 4.0.5`、`@deepseek-ai/dsh-scope >= 0.2.1-rc.5`、`@deepseek-ai/dsh-llm >= 0.2.1-rc.5`），适配 `renderToolsSdk` / `renderToolsSdkPy` 导出迁移与按步骤解析的条件工具集。
- **EN**: Updated minimum host requirements to `@deepseek-ai/dsh >= 0.2.2-rc.1`, `@deepseek-ai/dsh-tools >= 0.2.2-rc.1`, and `@deepseek-ai/dsh-tool-executor-ptc >= 0.2.2-rc.1` (with `Node.js >= 22`, `@deepseek-ai/cordis >= 4.0.5`, `@deepseek-ai/dsh-scope >= 0.2.1-rc.5`, and `@deepseek-ai/dsh-llm >= 0.2.1-rc.5`), aligning with relocated SDK renderers and step-resolved conditional toolsets.
- **CN**: 分离 `@delthin/dsh-tool-wrap/origin-bootstrap`（工具注册前来源门控）与 `@delthin/dsh-tool-wrap`（主插件）入口，调整门控或升级插件后需重启 DSH 服务。
- **EN**: Separated `@delthin/dsh-tool-wrap/origin-bootstrap` (pre-registration origin gate) from the main `@delthin/dsh-tool-wrap` plugin entrypoint; service restart is required after installing or modifying origin bootstrap wiring.

### Discovery, Configuration & Security / 按需发现、配置与安全
- **CN**: 支持 `version: 3` 配置结构（`groups`、`tools`、`exclude`、`descriptions` 上限各 512 项，简介 trim 后 `1–2000` 字符，禁止折叠 `run_code` / `discover_tools`），支持从 `v1` / `v2` 自动迁移、同目录原子 `rename`（权限 `0600`）及损坏配置报错保护。
- **EN**: Enforced `version: 3` configuration schema (`groups`, `tools`, `exclude`, and `descriptions` capped at 512 items each; trimmed descriptions `1–2000` chars; `run_code` and `discover_tools` excluded from folding) with automatic `v1` / `v2` migration, atomic `0600` file writes, and corruption refusal.
- **CN**: `discover_tools` 按精确插件 ID（及未识别来源工具的精确工具名）返回调用者作用域与条件 `toolSet` 交集内的原始定义，不提供关键词搜索，不执行目标工具，不扩张权限。
- **EN**: `discover_tools` returns caller-visible raw definitions by exact plugin ID (or exact tool name for unattributed tools) within the caller's scope and step-resolved `toolSet`, without keyword search, tool execution, or permission escalation.
- **CN**: 设置 API 强制宿主认证、同源校验与 `64 KiB` 请求体上限；默认模型简介生成仅发送插件全局工具名称与描述（120 秒超时、错误脱敏、生成未保存草稿）。
- **EN**: Protected settings APIs with host authentication, same-origin verification, and a `64 KiB` body limit; default-model description drafting sends only global tool names and descriptions with a 120s timeout, sanitized errors, and unsaved draft output.
