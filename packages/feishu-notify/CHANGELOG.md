# Changelog / 更新日志

## 1.1.2

### Patch Changes

- Remove obsolete automatic-summary model calls while retaining active approval alerts and explicit task summaries. Store delivery identity and receipts without retaining private prompt content.

本文件记录 `@delthin/dsh-feishu-notify` 的版本变更。 / This file documents notable changes to `@delthin/dsh-feishu-notify`.

说明文档 / Documentation: [简体中文 README](./README.md) | [English README](./README.en.md)

## [1.1.1]

### Security / 安全

- **禁止 HTTP 重定向 / Redirects Disabled**：飞书请求显式设置 `redirect: 'error'`，携带 `app_secret`（获取 `tenant_access_token`）与 `Bearer` 令牌（发送消息）的请求不会跟随 3xx 跳转到其他源地址；新增单元测试固定该选项与请求域名。
  Every Feishu request now sets `redirect: 'error'`, so requests carrying `app_secret` (token acquisition) or a `Bearer` token (message delivery) never follow a 3xx redirect to another origin; a unit test pins the option and the request origin.

### Changed / 变更

- **工作区与作用域包名迁移 / Scoped Package & Workspace Migration**：将包名迁移为 `@delthin/dsh-feishu-notify`，纳入 `Delthin/dsh-plugins` 仓库 `packages/feishu-notify` 子目录管理，配置公共包发布元数据（`publishConfig.access: "public"`）；内部服务标识、设置页 ID 与 profile 配置文件名 `feishu-notify.json` 保持不变。
  Migrated package name to `@delthin/dsh-feishu-notify` under `packages/feishu-notify` in `Delthin/dsh-plugins` with public package metadata (`publishConfig.access: "public"`), while preserving internal service IDs, settings page IDs, and the `feishu-notify.json` profile configuration filename.
- **许可证声明 / License Declaration**：统一采用 `Apache-2.0` 开源许可证（参见 [`LICENSE`](../../LICENSE)，允许商业使用、修改与分发，需保留版权与许可声明并标明修改，专利与完整条款以许可证原文为准）。
  Licensed under the `Apache-2.0` open-source license (see [`LICENSE`](../../LICENSE); permits commercial use, modification, and distribution subject to retaining copyright/license notices, stating file modifications, and the patent terms in the license).
- **运行基线声明 / Runtime Baseline Declaration**：明确运行要求为 Node.js `>= 22` 与 DSH `>= 0.2.1-rc.5`（当前验证基准 `0.2.2-rc.1`），并通过 `core.test.js` 与 `summary.test.js` 共 35 项单元测试。
  Declared runtime requirements as Node.js `>= 22` and DSH `>= 0.2.1-rc.5` (verified on `0.2.2-rc.1`), validated by 35 unit tests across `core.test.js` and `summary.test.js`.

## [1.1.0]

### Features / 现有功能

- **长任务收尾通知（`notify_user`） / Long-Task Completion Notification (`notify_user`)**：注入独立提示词，在整体任务持续至少 3 分钟且完成或收尾时由模型调用一次 `notify_user` 发送精简摘要（含 `✅`、`❌`、`👉` 分类，每项最多 32 个 Unicode 字符）；支持同回合并发与成功后重复调用拦截、会话投影回执记录，遵守 `enabled`、`quietHours` 与子代理过滤。
  Injects a dedicated prompt for the model to call `notify_user` once with a concise summary (`✅`, `❌`, `👉` items up to 32 Unicode characters each) when an overall task lasting at least 3 minutes completes or wraps up; includes same-turn deduplication, session projection receipts, and filtering for `enabled`, `quietHours`, and subagents.
- **宿主事件自动提醒 / Automated Host Event Alerts**：支持审批请求、用户提问与计划确认通知，忽略子代理，具备 60 秒同事件去重与重试 UUID 复用。
  Sends automated alerts for approval requests, user questions, and plan confirmations while ignoring subagents, with 60-second event deduplication and retry UUID reuse.
- **状态、非密钥配置与测试消息（`feishu_notify`） / Status, Non-Secret Configuration & Test Message (`feishu_notify`)**：支持查询状态、保存非密钥字段，以及绕过总开关和免打扰时段发送固定测试消息；`App Secret` 仅限设置 UI 写入，当前 profile 下 `feishu-notify.json` 采用同目录临时文件原子写入（权限 `0600`）。
  Supports status inspection, non-secret configuration updates, and fixed test message delivery bypassing `enabled` and `quietHours`; isolates `App Secret` to the Settings UI and atomically writes `feishu-notify.json` with `0600` permissions.
- **飞书通信与免打扰控制 / Feishu Transport & Quiet Hours**：内置 `fetch` 5 秒超时、网络错误与 HTTP 5xx 最多重试 3 次、`tenant_access_token` 缓存与提前刷新；支持 `ou_`（`open_id`）与 `oc_`（`chat_id`）接收方及 IANA 时区免打扰（含跨午夜与 `start == end` 全天免打扰）。
  Uses built-in `fetch` with a 5-second timeout, up to 3 retries on network/5xx errors, and cached `tenant_access_token` refresh; supports `ou_` (`open_id`) and `oc_` (`chat_id`) recipients plus IANA time zone quiet hours (including overnight ranges and `start == end` all-day mode).
