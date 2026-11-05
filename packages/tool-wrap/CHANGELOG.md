# Changelog / 变更日志

All notable verified changes to `@delthin/dsh-tool-wrap` are documented in this file.
本文件记录 `@delthin/dsh-tool-wrap` 已核实的主要变更。

## [1.2.0]

### Model Tool Rename / 模型工具更名
- **CN**: 正式模型入口改为 `unwrap`；新普通 PTC SDK、常驻概览及示例不展示旧名，registry 保留 `discover_tools` 供旧会话兼容调用。原始 SDK 仍逐字精确匹配后才投影；关闭与原生模式不准入两种名称。配置禁止在 `tools` / `exclude` 选择 `run_code`、`unwrap`、`discover_tools`。
- **EN**: Renamed the official model tool to `unwrap`, keeping `discover_tools` callable only for legacy sessions and hiding it from projected SDKs. Raw SDK exact-match guards, conditional admission, caller scope/toolSet and original execution permissions remain unchanged. Examples return a complete pack or print its full JSON serialization rather than a raw inspected object.
- **Validation / 验证**: `npm test` (macOS): 114 tests, 110 passed, 0 failed, 4 skipped (`sandbox_apply: Operation not permitted`); exit code 0.

### Package & Repository Migration / 包名与仓库迁移
- **CN**: 由原本地包 `dsh-tool-discovery` 迁移至 `Delthin/dsh-plugins` 工作区包 `@delthin/dsh-tool-wrap`（`1.2.0`，配置 `publishConfig.access: "public"`），许可证统一为 `PolyForm-Noncommercial-1.0.0`（参见 [`LICENSE`](../../LICENSE)，非商业源码可用，商业用途需另行联系 Delthin 授权）。
- **EN**: Migrated from legacy local package `dsh-tool-discovery` to `@delthin/dsh-tool-wrap` (`1.2.0`, configured with `publishConfig.access: "public"`) in the `Delthin/dsh-plugins` monorepo under the `PolyForm-Noncommercial-1.0.0` license (see [`LICENSE`](../../LICENSE); source-available noncommercial terms, commercial use requires separate authorization from Delthin).
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
