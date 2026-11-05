# Delthin DSH Plugins Monorepo

`Delthin/dsh-plugins` 是维护四个 DeepSeek Harness (DSH) 插件的公开 monorepo。四个工作区包在 `packages/` 下按各自目录独立维护与发布；根仓库 `package.json` 保持 `"private": true` 以防止误发布根聚合包，用户按需单独安装所需子包。

语言与文档：[English](./README.en.md) | [发布与市场维护指南](./docs/releasing.md) | [日常维护说明](./docs/package-handoff.md) | [许可证](./LICENSE)

## 插件包一览

每个子包拥有独立的入口导出、客户端 bundle、图标、多语言资源（locale）以及独立的 `README.md`、`README.en.md` 和 `CHANGELOG.md`。配置细节与使用说明见各包文档。

| 工作区目录 | 包名 | 当前版本 | 许可证 | DSH 宿主范围 (`engines.dsh`) | 核心职责与关键约束 |
| :--- | :--- | :--- | :--- | :--- | :--- |
| [`packages/feishu-notify`](./packages/feishu-notify/README.md) | `@delthin/dsh-feishu-notify` | `1.1.0` | `Apache-2.0` | `>=0.2.1-rc.5 \|\| >=0.2.2-rc.1` | 飞书通知与完成提醒。`notify_user` 仅在整体工作持续至少 3 分钟收尾时调用一次；`feishu_notify` 的 `status` 不发消息，`test` 真实发送且绕过开关与免打扰；`AppSecret` 仅通过 Web UI 录入并以 `0600` 权限原子写入私有存储。 |
| [`packages/agent-roles`](./packages/agent-roles/README.md) | `@delthin/dsh-agent-roles` | `0.4.1` | `Apache-2.0` | `>=0.2.1-rc.5 \|\| >=0.2.2-rc.1` | 基于 DSH 原生 Agent Team 的角色管理与委派。首次启动默认为空角色列表，保留数据目录中的角色与运行记录，运行数据不入库。 |
| [`packages/fast`](./packages/fast/README.md) | `@delthin/dsh-fast` | `0.1.3` | `Apache-2.0` | `>=0.2.1-rc.5 \|\| >=0.2.2-rc.1` | Fast 优先路由与 `service_tier: "priority"` 转发。`provider`、`sourceURL`、`targetURL` 必须显式完整填写后才启用 Fast，否则 Standard 模式正常工作、Fast 请求直接报错；`roleRunsPath` 为可选只读配置，不存在时普通会话照常运行。 |
| [`packages/tool-wrap`](./packages/tool-wrap/README.md) | `@delthin/dsh-tool-wrap` | `1.2.0` | `Apache-2.0` | `>=0.2.2-rc.1` | 按需工具定义发现与 PTC 桥接。正式工具名 `unwrap`（`discover_tools` 为旧会话兼容别名）、服务名、设置 ID 及配置文件名 `tool-discovery.json` 保持稳定；插件默认关闭（非宿主 PTC 模式关闭），`origin-bootstrap` 先于 `tools` 注册；仅首次安装或升级涉及 `toolDiscoveryOriginsReady` 来源门控时需重启生效，设置页启用开关与配置保存对后续 prompt 立即生效。 |

各包英文文档：[`packages/feishu-notify/README.en.md`](./packages/feishu-notify/README.en.md)、[`packages/agent-roles/README.en.md`](./packages/agent-roles/README.en.md)、[`packages/fast/README.en.md`](./packages/fast/README.en.md)、[`packages/tool-wrap/README.en.md`](./packages/tool-wrap/README.en.md)。

## 许可证与授权边界

本仓库及四个子包的新版本统一采用 `Apache-2.0` 开源许可证（[LICENSE](./LICENSE)）。在遵守许可证条款的前提下，允许个人与商业用途的使用、修改与分发；重新分发源码或衍生作品时需保留许可证、版权及相关声明，并对修改过的文件作出说明，专利授权与终止条款等均以 [LICENSE](./LICENSE) 原文为准。

商业使用无需另行付费获取授权，衍生作品整体亦不强制开源。历史已按 `MIT` 许可证发布的旧版本（含 `@delthin/dsh-agent-roles` `<= 0.4.0` 历史版本及 `@delthin/dsh-fast` `<= 0.1.2` 已发布版本），其对应版本的既有 MIT 授权不撤回。

## 安装与加载

四个子包均设置 `publishConfig.access: "public"` 并独立发布。请仅选择所需插件包，在对应的 DSH 运行环境或 profile 目录中按宿主插件加载与导入机制安装：

```bash
npm install @delthin/dsh-feishu-notify
npm install @delthin/dsh-agent-roles
npm install @delthin/dsh-fast
npm install @delthin/dsh-tool-wrap
```

如需从本仓库源码生成离线安装包进行本地隔离验证，可在通过根级检查后执行：

```bash
npm pack --workspace @delthin/dsh-feishu-notify
npm pack --workspace @delthin/dsh-agent-roles
npm pack --workspace @delthin/dsh-fast
npm pack --workspace @delthin/dsh-tool-wrap
```

随后将生成的 `.tgz` 包或子包入口按当前 DSH 宿主的本地插件接入与补丁导入流程加载到目标 profile，并在 Web UI 设置页完成各包配置。

## 环境与版本兼容要求

- **根工程开发要求**：`Node.js >= 22.19.0`，`npm >= 11.5.1`。
- **GitHub Actions CI 矩阵**：`Node.js 22` / `24`，`npm 11.12.1`。
- **源码形态**：纯 JavaScript 源码，无编译构建（build）步骤。
- **DSH 宿主范围说明**：由于 npm 默认 semver 规则会将不同版本元组（tuple）的预发布版本排除在常规 `>=` 范围之外，最低要求为 `0.2.1-rc.5` 的包显式声明为 `>=0.2.1-rc.5 || >=0.2.2-rc.1`，`tool-wrap` 声明为 `>=0.2.2-rc.1`。开放上限仅声明最低契约起点，不代表对未来尚未发布的 DSH API 变更作无条件兼容保证。

## 本地开发与校验工作流

根目录不提供聚合的 `npm test` 脚本，开发与发布前校验统一使用以下根级命令：

1. **安装依赖（禁用生命周期脚本）**
   ```bash
   npm ci --ignore-scripts
   ```
2. **静态与单元检查**
   ```bash
   npm run check
   ```
   逐包执行语法检查、单元测试、`package.json` 清单校验、YAML 校验、locale 完整性检查及版本范围核对。
3. **公开与隐私边界审计**
   ```bash
   npm run check:public
   ```
   扫描工作区是否残留运行态数据、常见密钥格式、本机绝对路径或本地私有内容。
4. **打包与隔离安装验证**
   ```bash
   npm run check:pack
   ```
   对四个子包分别执行 `npm pack`，在临时隔离目录中独立安装 tarball，使用空 `DSH_HOME` / 临时 profile 并清空 `NODE_PATH`，验证根导出、`client` 与 `bootstrap` 入口可正常导入，并基于打包产物运行现有测试套件。

## 安全、隐私与仓库边界

- **入库范围**：仓库仅保存插件源码、虚构测试夹具（fixtures）、自动化测试、文档与静态资源。`node_modules/`、运行 profile、`DSH_HOME`（`home/`）、`.env*`、`.npmrc`、`seed-roles`、运行日志/缓存/`runs` 目录及 `.tgz` 产物严禁入库。
- **关键运行安全约束**：
  - `@delthin/dsh-fast` 会将请求原始 `Authorization` 请求头转发至所配置的 `targetURL`，必须仅配置完全受信任的目标网关；`priority` 档位可能产生更高计费且不保证必然降低延迟。
  - `@delthin/dsh-feishu-notify` 的 `AppSecret` 仅限 Web UI 录入并以 `0600` 权限落盘，不通过环境变量或仓库文件回填。
  - `@delthin/dsh-tool-wrap` 不提升工具执行权限；开启工具介绍自动生成时会调用当前默认模型，可能产生模型调用费用。
