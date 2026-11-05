# Changelog / 变更日志

All notable verified changes to `@delthin/dsh-tool-wrap` are documented in this file.
本文件记录 `@delthin/dsh-tool-wrap` 已核实的主要变更。

## [1.2.0] - Unreleased (Private Repository Migration / 私有仓库迁移)

### Package & Repository Migration / 包名与仓库迁移
- **CN**: 由原本地包 `dsh-tool-discovery` 迁移至私有源码仓库 `Delthin/dsh-plugins` 工作区包 `@delthin/dsh-tool-wrap`（`1.2.0`，`private: true`，`UNLICENSED`，暂未发布至 npm 或插件市场）。
- **EN**: Migrated from legacy local package `dsh-tool-discovery` to `@delthin/dsh-tool-wrap` (`1.2.0`, `private: true`, `UNLICENSED`, not yet published to npm or marketplace) in the private `Delthin/dsh-plugins` monorepo.
- **CN**: 保留内部工具名（`discover_tools`）、服务标识、设置页路由 ID、启动门控服务名（`toolDiscoveryOriginsReady`）及 profile 配置文件名（`tool-discovery.json`）；客户端、图标与 locale 导出统一收敛为 `@delthin/dsh-tool-wrap` 作用域路径。升级时需先备份原配置并移除旧包，避免新旧实例同时启用。
- **EN**: Preserved internal tool name (`discover_tools`), service IDs, settings page route ID, startup readiness service (`toolDiscoveryOriginsReady`), and profile config filename (`tool-discovery.json`), while scoping client, icon, and locale exports under `@delthin/dsh-tool-wrap`. Users must back up existing configuration and disable the legacy package before enabling the new package.

### Host Contract & Runtime Compatibility / 宿主契约与运行兼容
- **CN**: 最低宿主版本要求更新为 `@deepseek-ai/dsh >= 0.2.2-rc.1`、`@deepseek-ai/dsh-tools >= 0.2.2-rc.1` 与 `@deepseek-ai/dsh-tool-executor-ptc >= 0.2.2-rc.1`（配合 `Node.js >= 22`、`cordis >= 4.0.5`、`@deepseek-ai/dsh-scope >= 0.2.1-rc.5`、`@deepseek-ai/dsh-llm >= 0.2.1-rc.5`），适配 `renderToolsSdk` / `renderToolsSdkPy` 导出迁移与按步骤解析的条件工具集。
- **EN**: Updated minimum host requirements to `@deepseek-ai/dsh >= 0.2.2-rc.1`, `@deepseek-ai/dsh-tools >= 0.2.2-rc.1`, and `@deepseek-ai/dsh-tool-executor-ptc >= 0.2.2-rc.1` (with `Node.js >= 22`, `cordis >= 4.0.5`, `@deepseek-ai/dsh-scope >= 0.2.1-rc.5`, and `@deepseek-ai/dsh-llm >= 0.2.1-rc.5`), aligning with relocated SDK renderers and step-resolved conditional toolsets.
- **CN**: 分离 `@delthin/dsh-tool-wrap/origin-bootstrap`（工具注册前来源门控）与 `@delthin/dsh-tool-wrap`（主插件）入口，调整门控或升级插件后需重启 DSH 服务。
- **EN**: Separated `@delthin/dsh-tool-wrap/origin-bootstrap` (pre-registration origin gate) from the main `@delthin/dsh-tool-wrap` plugin entrypoint; service restart is required after installing or modifying origin bootstrap wiring.

### Discovery, Configuration & Security / 按需发现、配置与安全
- **CN**: 支持 `version: 3` 配置结构（`groups`、`tools`、`exclude`、`descriptions` 上限各 512 项，简介 trim 后 `1–2000` 字符，禁止折叠 `run_code` / `discover_tools`），支持从 `v1` / `v2` 自动迁移、同目录原子 `rename`（权限 `0600`）及损坏配置报错保护。
- **EN**: Enforced `version: 3` configuration schema (`groups`, `tools`, `exclude`, and `descriptions` capped at 512 items each; trimmed descriptions `1–2000` chars; `run_code` and `discover_tools` excluded from folding) with automatic `v1` / `v2` migration, atomic `0600` file writes, and corruption refusal.
- **CN**: `discover_tools` 按精确插件 ID（及未识别来源工具的精确工具名）返回调用者作用域与条件 `toolSet` 交集内的原始定义，不提供关键词搜索，不执行目标工具，不扩张权限。
- **EN**: `discover_tools` returns caller-visible raw definitions by exact plugin ID (or exact tool name for unattributed tools) within the caller's scope and step-resolved `toolSet`, without keyword search, tool execution, or permission escalation.
- **CN**: 设置 API 强制宿主认证、同源校验与 `64 KiB` 请求体上限；默认模型简介生成仅发送插件全局工具名称与描述（120 秒超时、错误脱敏、生成未保存草稿）。
- **EN**: Protected settings APIs with host authentication, same-origin verification, and a `64 KiB` body limit; default-model description drafting sends only global tool names and descriptions with a 120s timeout, sanitized errors, and unsaved draft output.
