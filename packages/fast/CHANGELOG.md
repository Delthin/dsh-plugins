# Changelog / 变更日志

See also: [中文说明](<./README.md>) | [English README](<./README.en.md>)

## [0.1.4] - 2026-11-06

### Bug Fixes / 缺陷修复

- **中文**：
  - 修复推理等级滑块在宿主或皮肤于 `pointerdown` 阶段把焦点移回输入框时无法拖动的问题。拖动期间滑块仍持有 pointer capture，此时失焦不再取消拖动；只有捕获确实丢失（元素被移除或指针被取消）才回退，避免其他插件抢焦点打断鼠标拖动，例如 claude-style 的「重绘对话框」。键盘操作路径不变。
- **English**:
  - Fixed the reasoning-effort slider becoming undraggable when the host or a skin moves focus back to the input box during `pointerdown`. While the drag is active and the slider still holds pointer capture, losing focus no longer cancels it; the drag is only cancelled once capture is actually lost (element removed or pointer cancelled), so plugins that take focus on `pointerdown` — such as the claude-style composer redraw — no longer break mouse dragging. Keyboard operation is unchanged.

## [0.1.3] - 2026-11-05

### Migration & Packaging / 包名迁移与配置调整

- **中文**：
  - 合并 npm 已发布 `0.1.2`（MIT）的修复并推进版本至 `0.1.3`，避免相对已发布版本降级；移除子包 `private: true` 并配置 `publishConfig.access: "public"`。
  - 包名定为 `@delthin/dsh-fast`（源码位于 `packages/fast`），保持插件内部 ID `fast`、客户端模块 ID `@delthin/dsh-fast` 与多语言标识 `dsh-fast`、接口路径 `/api/fast`、存储域 `dsh_fast`（版本 `1`，`sessions` 表）及既有配置键名不变。
  - 移除个人环境默认值：`provider`、`sourceURL`、`targetURL` 默认均为空字符串。旧版若依赖默认配置，升级前需先备份配置并显式补齐三项字段；本次升级不包含自动数据迁移，请勿将新旧插件实例同时启用。
  - 自 `0.1.3` 起许可证改为 `Apache-2.0`（[LICENSE](./LICENSE)、根仓库 [LICENSE](../../LICENSE)）；`<= 0.1.2` 历史版本的 MIT 授权不撤回，通知保留在 [LICENSE-MIT-legacy](./LICENSE-MIT-legacy)。
- **English**:
  - Merged fixes from the published npm `0.1.2` (MIT) release and bumped version to `0.1.3` to avoid downgrading relative to published history; removed subpackage `private: true` and set `publishConfig.access: "public"`.
  - Scoped package name as `@delthin/dsh-fast` (under `packages/fast`), preserving internal plugin ID `fast`, client module ID `@delthin/dsh-fast` and locale ID `dsh-fast`, HTTP route `/api/fast`, storage domain `dsh_fast` (version `1`, `sessions` table), and existing config keys.
  - Removed personal environment defaults: `provider`, `sourceURL`, and `targetURL` now default to empty. Back up your configuration before upgrading, explicitly supply all three fields if previously relying on defaults, and do not run old and new plugin instances concurrently (no automatic data migration is performed).
  - Changed license to `Apache-2.0` ([LICENSE](./LICENSE), root [LICENSE](../../LICENSE)) starting with `0.1.3`; prior MIT grants for `<= 0.1.2` are not revoked and remain in [LICENSE-MIT-legacy](./LICENSE-MIT-legacy).

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
