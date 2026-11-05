# Delthin DSH Plugins Monorepo

`Delthin/dsh-plugins` 是维护四个 DeepSeek Harness (DSH) 插件的私有 monorepo。四个工作区包现已迁入本仓库并按各自目录独立维护，不提供根级聚合安装入口。

语言说明：[English](./README.en.md) | [发布与市场收录指南](./docs/releasing.md) | [实施与验收记录](./docs/package-handoff.md)

## 当前发布与公开状态

- **源码仓库**：`Delthin/dsh-plugins` 当前为私有 GitHub 仓库。
- **npm 发布**：四个工作区包均设置 `"private": true`，均未发布到 `@delthin/*` npm scope。
- **市场收录**：均未向 Awesome DSH 或 `dshopen` 提交收录申请。
- **许可证边界**：根仓库 `package.json` 声明为 `UNLICENSED`，仅覆盖根级工程配置与未单独开源的目录，不覆盖子包已单独声明的开源许可证（`packages/agent-roles` 保持 `MIT`）。

## 插件包一览

每个子包拥有独立的入口导出、客户端 bundle、图标、多语言资源（locale）以及独立的 `README.md`、`README.en.md` 和 `CHANGELOG.md`。

| 工作区目录 | 包名 | 当前版本 | 许可证 | DSH 宿主范围 (`engines.dsh`) | 核心职责与关键约束 |
| :--- | :--- | :--- | :--- | :--- | :--- |
| [`packages/feishu-notify`](./packages/feishu-notify/README.md) | `@delthin/dsh-feishu-notify` | `1.1.0` | `UNLICENSED` | `>=0.2.1-rc.5 \|\| >=0.2.2-rc.1` | 飞书通知与完成提醒。`notify_user` 仅在整体工作持续至少 3 分钟收尾时调用一次；`feishu_notify` 的 `status` 不发消息，`test` 真实发送且绕过开关与免打扰；`AppSecret` 仅通过 Web UI 录入并以 `0600` 权限原子写入私有存储。 |
| [`packages/agent-roles`](./packages/agent-roles/README.md) | `@delthin/dsh-agent-roles` | `0.4.0` | `MIT` | `>=0.2.1-rc.5 \|\| >=0.2.2-rc.1` | 角色管理与委派。通过 `git subtree` 完整保留原独立仓库的 Git 历史（原仓库未修改、未归档，历史 release 保留在原仓库）；首次启动默认为空角色列表，保留数据目录中的角色与运行记录，运行数据不入库。 |
| [`packages/fast`](./packages/fast/README.md) | `@delthin/dsh-fast` | `0.1.0` | `UNLICENSED` | `>=0.2.1-rc.5 \|\| >=0.2.2-rc.1` | Fast 路由与 `service_tier: "priority"` 转发。已移除个人默认 URL、provider 与本机绝对路径；`provider`、`sourceURL`、`targetURL` 必须显式完整填写后才启用 Fast，否则 Standard 模式正常工作、Fast 请求直接报错；`roleRunsPath` 为可选只读配置，不存在时普通会话照常运行。 |
| [`packages/tool-wrap`](./packages/tool-wrap/README.md) | `@delthin/dsh-tool-wrap` | `1.2.0` | `UNLICENSED` | `>=0.2.2-rc.1` | 按需工具发现与 PTC 桥接。原本地目录名 `dsh-tool-discovery` 迁入后改为 `tool-wrap`，但工具名 `discover_tools`、服务名、设置 ID 及配置文件名 `tool-discovery.json` 保持不变；插件默认关闭（非宿主 PTC 模式关闭），`origin-bootstrap` 先于 `tools` 注册；仅首次安装或升级涉及 `toolDiscoveryOriginsReady` 来源门控时需重启生效，设置页启用开关与配置保存对后续 prompt 立即生效。 |

各包英文文档入口：[`packages/feishu-notify/README.en.md`](./packages/feishu-notify/README.en.md)、[`packages/agent-roles/README.en.md`](./packages/agent-roles/README.en.md)、[`packages/fast/README.en.md`](./packages/fast/README.en.md)、[`packages/tool-wrap/README.en.md`](./packages/tool-wrap/README.en.md)。

## 环境与工具链要求

- **根工程开发与构建**：`Node.js >= 22.19.0`，`npm >= 11.5.1`。
- **GitHub Actions CI 矩阵**：`Node.js 22` / `24`，`npm 11.12.1`。
- **当前本地定点验证基准**：`Node.js 25.9.0`，`Cordis 4.1.0`，DSH 依赖基准 `0.2.2-rc.1`。
- **源码形态**：纯 JavaScript 源码，无编译构建步骤。
- **版本范围说明**：各包 `engines.dsh` 采用开放上限（`>=0.2.1-rc.5 || >=0.2.2-rc.1` 或 `>=0.2.2-rc.1`），仅声明最低契约起点，不代表对未来尚未发布的 DSH 版本作无条件兼容承诺；CI 校验通过也不替代真实宿主、浏览器与外部 API 的端到端验证。

## 本地开发与校验工作流

根目录不提供聚合的 `npm test` 脚本，所有校验通过以下根级脚本执行：

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
   扫描工作区是否残留运行态数据、常见密钥格式、本机绝对路径或本地私有链接。
4. **打包与隔离安装验证**
   ```bash
   npm run check:pack
   ```
   对四个子包分别执行 `npm pack`，在临时隔离目录中独立安装 tarball，使用空 `DSH_HOME` / 临时 profile 并清空 `NODE_PATH`，验证根导出、`client` 与 `bootstrap` 入口可正常导入，且基于打包产物运行现有测试套件。

## 安装与本地加载方式

四个子包目前均为 `"private": true` 且未发布至 npm，当前不可通过 `npm install @delthin/<pkg>` 从远程注册表安装。

如需在本地独立测试 profile 中加载某个插件：

1. 在仓库根目录执行 `npm ci --ignore-scripts` 与 `npm run check`。
2. 针对目标子包生成 tarball：
   ```bash
   npm pack --workspace @delthin/dsh-feishu-notify
   npm pack --workspace @delthin/dsh-agent-roles
   npm pack --workspace @delthin/dsh-fast
   npm pack --workspace @delthin/dsh-tool-wrap
   ```
3. 将生成的 `.tgz` 包或子包目录，按照当前 DSH 宿主的本地插件加载机制部署到独立的测试 profile 中进行验证（请勿直接覆盖生产运行中的 `home/` 或本机 `plugins/` 目录）。

## 安全、隐私与仓库边界

- **入库白名单**：本仓库仅允许提交插件源码、虚构测试夹具（fixtures）、自动化测试、文档与静态资源。
- **禁止入库项**：`node_modules/`、运行 profile、`DSH_HOME`（`home/`）、`.env*`、`.npmrc`、`seed-roles`、运行日志/缓存/`runs` 目录及打包生成的 `.tgz` 文件严禁提交入库。
- **关键安全约束**：
  - `@delthin/dsh-fast` 会将请求原始 `Authorization` 请求头转发至所配置的 `targetURL`，管理员必须仅配置完全受信任的目标网关；`priority` 档位可能产生更高计费且不保证必然降低延迟。
  - `@delthin/dsh-feishu-notify` 的 `AppSecret` 仅限 Web UI 录入并以 `0600` 权限落盘，绝不通过环境变量或仓库文件回填。
  - `@delthin/dsh-tool-wrap` 不提升工具执行权限；开启工具介绍自动生成时会调用当前默认模型，可能产生模型调用费用。

## 版本管理与发布参考

本仓库使用 `Changesets 2.29.7` 管理各包版本（`fixed: []`、`linked: []`，四包版本彼此独立）。日常变更可记录 changeset（`npm run changeset`），但仅在获得用户对目标版本与发布范围的明确授权后，才运行 `npm run version:packages` 或移除 `"private": true`。完整流程与市场准入条件见 [docs/releasing.md](./docs/releasing.md)，当前迁移与测试状态见 [docs/package-handoff.md](./docs/package-handoff.md)。

由于 npm 默认 semver 规则会将不同版本元组（tuple）的预发布版本排除在常规 `>=` 范围之外，最低要求为 `>=0.2.1-rc.5` 的包与 DSH `engines.dsh` 宿主范围显式声明为 `>=0.2.1-rc.5 || >=0.2.2-rc.1`；最低要求原本即为 `>=0.2.2-rc.1` 的条目则维持原范围。该配置用于确保当前 RC 与正式新版本均可正常解析，并非承诺兼容未来所有 RC 或 API 变更。
