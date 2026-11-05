# 实施与验收交接记录 / Implementation & Acceptance Handoff

本文档记录 `Delthin/dsh-plugins` 四个工作区包迁入私有 monorepo 的实际改动、脱敏与边界加固、当前测试结果以及尚未验证的事项。中文在前，英文在后（English section follows below）。

关联文档：[根目录 README](../README.md) | [English README](../README.en.md) | [发布与市场收录指南](./releasing.md)

---

## 第一部分：中文实施与验收记录

### 1. 仓库建立与工作区迁入概况

私有 GitHub 仓库 `Delthin/dsh-plugins` 已建立，四个插件已迁入 `packages/*` 工作区，根 `package.json` 声明为 `UNLICENSED`（不覆盖 `packages/agent-roles` 的 `MIT` 许可证），全部子包均保持 `"private": true`，本轮未修改本机生产环境 `plugins/` 目录或运行中的 DSH profile。

| 工作区路径 | 包名与版本 | 许可证 | DSH 依赖范围 | 迁入来源与结构变更要点 |
| :--- | :--- | :--- | :--- | :--- |
| [`packages/feishu-notify`](../packages/feishu-notify/README.md) | `@delthin/dsh-feishu-notify` `1.1.0` | `UNLICENSED` | `>=0.2.1-rc.5 \|\| >=0.2.2-rc.1` | 迁入自维护飞书通知插件；补齐中英双语 README 与 CHANGELOG；保持独立导出、客户端 bundle、图标与 locale。 |
| [`packages/agent-roles`](../packages/agent-roles/README.md) | `@delthin/dsh-agent-roles` `0.4.0` | `MIT` | `>=0.2.1-rc.5 \|\| >=0.2.2-rc.1` | 通过 `git subtree` 完整迁入并保留原独立仓库的全部 Git 历史；原独立仓库未修改、未归档，历史 release 仍在原仓库保留。 |
| [`packages/fast`](../packages/fast/README.md) | `@delthin/dsh-fast` `0.1.0` | `UNLICENSED` | `>=0.2.1-rc.5 \|\| >=0.2.2-rc.1` | 迁入 Fast 路由插件；清理个人默认配置与本机绝对路径，改为显式三项配置启用机制。 |
| [`packages/tool-wrap`](../packages/tool-wrap/README.md) | `@delthin/dsh-tool-wrap` `1.2.0` | `UNLICENSED` | `>=0.2.2-rc.1` | 原本地目录名 `dsh-tool-discovery` 迁入为 `packages/tool-wrap`（包名 `@delthin/dsh-tool-wrap`），但对外工具名 `discover_tools`、服务标识、设置 ID 与配置文件名 `tool-discovery.json` 保持不变。 |

### 2. 各包关键行为与安全边界加固

1. **`@delthin/dsh-fast` (`0.1.0`)**：
   - 移除了代码中硬编码的个人默认 URL、默认 provider 与本机绝对路径。
   - 要求 `provider`、`sourceURL`、`targetURL` 三项配置必须显式完整填写后才启用 Fast 路由；任一未配置时，Standard 模式正常工作，而显式发起的 Fast 请求会直接返回配置错误。
   - `roleRunsPath` 设为可选只读路径，路径不存在或未配置时普通会话照常运行。
   - 文档明确披露：Fast 会将原始 `Authorization` 请求头转发至 `targetURL`，管理员必须信任目标端点；`priority` 服务档位可能产生更高费用且不保证加速。
2. **`@delthin/dsh-feishu-notify` (`1.1.0`)**：
   - `AppSecret` 仅允许通过 Web UI 录入，后端以 `0600` 权限原子写入私有存储，不通过仓库配置文件或日志暴露。
   - `notify_user` 工具遵循“用户请求的整体工作持续至少 3 分钟时，在完成或收尾时调用一次”的规则。
   - `feishu_notify` 工具的 `status` 动作仅查询状态不发送飞书消息；`test` 动作会发送真实测试消息，且设计为绕过总开关与免打扰时段以便排查连通性。
3. **`@delthin/dsh-tool-wrap` (`1.2.0`)**：
   - 保持工具名 `discover_tools`、服务名、设置 ID 及 `tool-discovery.json` 兼容。
   - 插件默认关闭（非宿主 PTC 模式关闭）；`origin-bootstrap` 确保先于 `tools` 注册；仅首次安装或升级涉及 `toolDiscoveryOriginsReady` 启动门控时需宿主重启生效，设置页启用开关与配置变更对后续 prompt 立即生效。
   - 不提升任何工具的执行权限；开启自动生成工具介绍时会调用默认模型，可能产生模型计费。
4. **`@delthin/dsh-agent-roles` (`0.4.0`)**：
   - 首次安装启动时默认为空角色列表（`roles: []`），不随包捆绑私有 `seed-roles`。
   - 升级或重启时保留宿主数据目录中已有的自定义角色与运行记录；所有运行态数据均排除在 Git 仓库之外。
5. **仓库文件卫生控制**：
   - 仓库仅保留源码、虚构测试 fixture、测试脚本、文档与静态资源。
   - `node_modules/`、运行 profile、`DSH_HOME`、`.env*`、`.npmrc`、`seed-roles`、`runs`/日志/缓存及 `.tgz` 均已排除且不入 Git。

### 3. 已完成的验证与当前测试数据

当前本地代码单元测试基准环境为：`Node.js 25.9.0`、`Cordis 4.1.0`、DSH 依赖基准 `0.2.2-rc.1`。

| 检查项 / 子包 | 通过 (Pass) | 跳过 (Skip) | 失败 (Fail) | 总计 (Total) | 说明 |
| :--- | :---: | :---: | :---: | :---: | :--- |
| `@delthin/dsh-feishu-notify` 单元测试 | 38 | 0 | 0 | 38 | 全部通过 |
| `@delthin/dsh-agent-roles` 单元测试 | 28 | 0 | 0 | 28 | 全部通过 |
| `@delthin/dsh-fast` 单元测试 | 29 | 0 | 0 | 29 | 全部通过 |
| `@delthin/dsh-tool-wrap` 单元测试 | 104 | 4 | 0 | 108 | 104 通过；4 项因当前本机环境 `sandbox-exec` 权限限制按预期 skip |

本地验证基于 Node `25.9.0` 与 DSH `0.2.2-rc.1` 基准环境完成：`npm run check` 以退出码 `0` 通过，四包合计 203 项测试（199 通过、4 跳过）；`npm run check:pack` 以退出码 `0` 通过，四个包的 tarball 均在空 profile、无 `NODE_PATH`、未使用 `--force` 或 `--legacy-peer-deps` 的隔离环境下独立安装，并直接加载打包产物运行全部测试通过。[远端 CI](<https://github.com/Delthin/dsh-plugins/actions/runs/41978144170>) 的 Node 22 与 Node 24 矩阵验证均已通过（涵盖 `npm ci`、`check`、`public` 与 `pack` 检查）。

### 4. 尚未完成的验证与已知限制（切勿视同已完成）

以下事项在本轮尚待执行或未覆盖，验收与后续接手时需明确区分：

1. **macOS `sandbox-exec` 受限用例**：
   - `@delthin/dsh-tool-wrap` 中有 4 个涉及 `sandbox-exec` 的测试用例在当前沙箱受限环境中被跳过（skip），需在具备非受限 macOS `sandbox-exec` 权限的宿主环境中补跑确认。
2. **最低宿主版本矩阵未实测**：
   - 声明的最低宿主版本（`0.2.1-rc.5` 与 `0.2.2-rc.1`）目前仅基于代码契约与当前 `0.2.2-rc.1` 依赖基准核对，尚未在各历史最低版本宿主实例上逐一挂载实测。
3. **真实外部依赖与浏览器端到端（E2E）未验**：
   - 尚未在真实浏览器 Web GUI、真实飞书开放平台机器人 API 以及真实上游大模型 API（含 Fast `priority` 转发链路与 `tool-wrap` 模型生成介绍链路）下执行端到端联调。
   - 即使后续 GitHub CI 与 `check:pack` 全部通过，也仅证明打包结构与模拟单测合格，**不等于真实外部 API 与未来宿主版本全兼容**。

---

## Part 2: English Implementation & Acceptance Record

### 1. Repository Setup & Package Migration Summary

The private GitHub repository `Delthin/dsh-plugins` has been initialized and all four packages have been migrated under `packages/*`. The root `package.json` is `UNLICENSED` (without overriding `MIT` in `packages/agent-roles`). All four packages remain `"private": true`, and no changes were made to the host machine's active `plugins/` directory or live DSH runtime profile.

| Workspace Path | Package & Version | License | DSH Range | Migration Origin & Key Structural Notes |
| :--- | :--- | :--- | :--- | :--- |
| [`packages/feishu-notify`](../packages/feishu-notify/README.en.md) | `@delthin/dsh-feishu-notify` `1.1.0` | `UNLICENSED` | `>=0.2.1-rc.5 \|\| >=0.2.2-rc.1` | Migrated with bilingual READMEs, CHANGELOG, standalone exports, client bundle, icons, and locales. |
| [`packages/agent-roles`](../packages/agent-roles/README.en.md) | `@delthin/dsh-agent-roles` `0.4.0` | `MIT` | `>=0.2.1-rc.5 \|\| >=0.2.2-rc.1` | Imported via `git subtree` preserving full commit history; legacy standalone repository remains untouched and unarchived with prior releases intact. |
| [`packages/fast`](../packages/fast/README.en.md) | `@delthin/dsh-fast` `0.1.0` | `UNLICENSED` | `>=0.2.1-rc.5 \|\| >=0.2.2-rc.1` | Migrated with personal default URLs/providers and machine-specific absolute paths stripped. |
| [`packages/tool-wrap`](../packages/tool-wrap/README.en.md) | `@delthin/dsh-tool-wrap` `1.2.0` | `UNLICENSED` | `>=0.2.2-rc.1` | Renamed from local directory `dsh-tool-discovery` to `packages/tool-wrap` (`@delthin/dsh-tool-wrap`), keeping tool name `discover_tools`, service IDs, settings IDs, and `tool-discovery.json` unchanged. |

### 2. Hardening & Behavioral Guarantees

1. **`@delthin/dsh-fast` (`0.1.0`)**: Requires `provider`, `sourceURL`, and `targetURL` to be explicitly set before enabling Fast routing (otherwise Standard requests work normally and Fast requests error out). `roleRunsPath` is optional and read-only. Forwards original `Authorization` headers to `targetURL` (requires administrator trust) and notes that `priority` routing may cost more without latency guarantees.
2. **`@delthin/dsh-feishu-notify` (`1.1.0`)**: Accepts `AppSecret` via Web UI only (`0600` atomic write). `notify_user` fires once at wrap-up for overall tasks lasting `>= 3` minutes. `feishu_notify` `status` sends no external message, whereas `test` sends a live message bypassing the master toggle and DND window.
3. **`@delthin/dsh-tool-wrap` (`1.2.0`)**: Keeps `discover_tools` and `tool-discovery.json` compatibility. The plugin defaults to off (not the host PTC mode); `origin-bootstrap` registers before `tools`; `toolDiscoveryOriginsReady` gating applies across restarts; does not escalate permissions; automatic tool description generation calls the default model and may incur charges.
4. **`@delthin/dsh-agent-roles` (`0.4.0`)**: Starts with an empty role list on fresh installations while preserving existing roles and run records inside the host data directory; no runtime seed roles or execution logs are tracked in Git.

### 3. Current Unit Test Baseline

Executed under the current local baseline (`Node.js 25.9.0`, `Cordis 4.1.0`, DSH dependency baseline `0.2.2-rc.1`):

| Suite | Pass | Skip | Fail | Total | Notes |
| :--- | :---: | :---: | :---: | :---: | :--- |
| `@delthin/dsh-feishu-notify` | 38 | 0 | 0 | 38 | All passed |
| `@delthin/dsh-agent-roles` | 28 | 0 | 0 | 28 | All passed |
| `@delthin/dsh-fast` | 29 | 0 | 0 | 29 | All passed |
| `@delthin/dsh-tool-wrap` | 104 | 4 | 0 | 108 | 4 skipped due to local `sandbox-exec` permission restrictions |

Local validation passed against the Node `25.9.0` and DSH `0.2.2-rc.1` baseline: `npm run check` exited with `0` across all four packages with 203 total tests (199 passed, 4 skipped), and `npm run check:pack` exited with `0` after installing each of the four package tarballs in isolated environments—with an empty profile, no `NODE_PATH`, and without `--force` or `--legacy-peer-deps`—and running the full test suite directly against the packed runtime artifacts. [Remote CI](<https://github.com/Delthin/dsh-plugins/actions/runs/41978144170>) matrix runs for both Node 22 and Node 24 have passed (covering `npm ci`, `check`, `public`, and `pack` checks).

### 4. Pending Verifications & Known Limitations

1. **Local `sandbox-exec` skips**: 4 tests in `@delthin/dsh-tool-wrap` were skipped under current sandbox constraints and require execution on an unrestricted macOS host.
2. **Minimum host version matrix & live E2E**: Minimum DSH host versions (`0.2.1-rc.5` / `0.2.2-rc.1`), live browser UI flows, live Feishu API delivery, and live upstream model API calls have not yet been end-to-end verified. Future CI success does not guarantee full compatibility with live external APIs or future host versions.
