# Changelog / 变更日志

See also: [中文说明](<./README.md>) | [English README](<./README.en.md>)

## [Unreleased]

### Migration & Packaging / 包名迁移与配置调整

- **中文**：
  - 将包名从本地未加作用域的 `dsh-fast` 调整为 `@delthin/dsh-fast`（源码位于 `packages/fast`，当前为 `private: true`、`UNLICENSED`，尚未发布至 npm 或插件市场）。
  - 保持插件内部 ID `fast`、客户端与多语言标识 `dsh-fast`、接口路径 `/api/fast`、存储域 `dsh_fast`（版本 `1`，`sessions` 表）及既有配置键名不变。
  - 移除个人环境默认值：`provider`、`sourceURL`、`targetURL` 默认均为空字符串。旧版若依赖默认配置，升级前需先备份配置并显式补齐三项字段；本次升级不包含自动数据迁移，请勿将新旧插件实例同时启用。
- **English**:
  - Renamed package from unscoped `dsh-fast` to `@delthin/dsh-fast` (located at `packages/fast`, currently `private: true` and `UNLICENSED`, not yet published to npm or the marketplace).
  - Preserved internal plugin ID `fast`, client/locale ID `dsh-fast`, HTTP route `/api/fast`, storage domain `dsh_fast` (version `1`, `sessions` table), and existing config keys.
  - Removed personal environment defaults: `provider`, `sourceURL`, and `targetURL` now default to empty. Back up your configuration before upgrading, explicitly supply all three fields if previously relying on defaults, and do not run old and new plugin instances concurrently (no automatic data migration is performed).

## [0.1.0]

### Features & Safeguards / 当前能力与安全边界

- **中文**：
  - 支持当前会话 `Standard` / `Fast` 档位切换与 `/fast on|off|toggle|status` 命令，保留模型选择器与推理等级设置。
  - 支持从角色启动快照锁定子代理/角色会话档位，支持可选只读 `roleRunsPath`（相对服务进程 `cwd` 解析）。
  - 当 `provider`、`sourceURL`、`targetURL` 配置完整且合法时，通过本地回环代理（随机令牌认证、禁止上游重定向、保留原请求授权头）为匹配的 Responses 请求设置 `service_tier: "priority"` 并转发至 `targetURL`；在内存中保留最多 1000 个会话的转发回执。
  - 缺少任一转发配置时不创建代理，`Standard` 正常可用，`Fast` 请求在发往下游前拒绝并提示缺配置；包含非法 URL、内嵌凭据或 fragment 时拒绝初始化。
- **English**:
  - Added per-session `Standard` / `Fast` tier switching and `/fast on|off|toggle|status` commands while preserving model selector and reasoning effort settings.
  - Added startup-snapshot tier locking for role runs with optional read-only `roleRunsPath` support (resolved relative to the service process `cwd`).
  - Added loopback forwarding proxy (random token auth, upstream redirects disabled, original authorization headers preserved) that sets `service_tier: "priority"` and forwards matching Responses requests to `targetURL` when `provider`, `sourceURL`, and `targetURL` are fully configured; retains up to 1,000 session forwarding receipts in memory.
  - Disabled proxy creation when any of the three forwarding fields is empty (`Standard` remains functional, `Fast` requests are rejected pre-flight with a configuration prompt) and rejected initialization on invalid URLs, embedded credentials, or URL fragments.
