# @delthin/dsh-fast

[English](<./README.en.md>) | [变更日志](<./CHANGELOG.md>)

`@delthin/dsh-fast` 是 DeepSeek Harness (DSH) 的会话服务档位切换与请求转发插件（当前版本 `0.1.4`，许可 `Apache-2.0`）。它为当前会话提供 `Standard` 与 `Fast` 档位切换能力，并在配置完整时将指定供应商的 Responses 请求附加 `service_tier: "priority"` 后转发至管理员配置的目标地址。

> **重要声明**：`Fast` 档位仅负责注入 `service_tier: "priority"` 参数并将匹配请求转发至目标端点，**不构成模型生成速度或响应性能的承诺**。上游服务是否支持该参数、是否实际加速以及如何计费，均由管理员配置的上游供应商决定，需由管理员自行核实，本插件不保证加速效果或更低费用。

## 功能特性

- **会话档位切换**：支持在当前会话中切换 `Standard`（标准）与 `Fast`（优先）档位，保留原有的模型选择器与推理等级设置。
- **快捷指令控制**：提供 `/fast on`、`/fast off`、`/fast toggle` 与 `/fast status` 命令，随时控制或查询当前会话档位。
- **角色运行档位锁定**：子代理或角色会话启动时，从启动快照读取档位并锁定，运行期间保持一致。插件仅以只读方式读取角色运行文件（`roleRunsPath`），不会创建或迁移该文件；未配置或文件不存在时，普通会话功能正常可用。
- **按需请求转发**：当 `provider`、`sourceURL`、`targetURL` 三项配置齐全且合法时，自动在本地回环地址启动转发代理，为匹配的 Responses 请求注入 `service_tier: "priority"` 并转发至 `targetURL`。
- **安全降级与拦截**：三项核心转发配置默认均为空。缺少任意一项时不会启动本地转发代理，`Standard` 档位仍可正常使用；若在此状态下切换至 `Fast` 档位并发起下游请求，插件会在发送前直接拒绝并提示缺少配置。若三项配置填写完整但 URL 格式非法，插件将拒绝初始化。
- **内存回执记录**：在内存中维护最近最多 1000 个会话的转发回执状态，不落盘存储额外敏感报文。

## 安装说明

源码位于单仓子目录 `packages/fast`，配置 `publishConfig.access: "public"` 支持 npm 公共仓库发布。可通过 `npm i @delthin/dsh-fast`（或指定 `@delthin/dsh-fast@0.1.4`）安装，并在 DSH 宿主配置（如 `cordis.patch.yml`）中导入启用 `@delthin/dsh-fast`。插件市场收录独立于 npm 发布。

### 从源码仓库打包验证

在源码仓库根目录下执行以下命令完成依赖安装、质量检查与本地打包：

```bash
npm ci --ignore-scripts
npm run check
npm pack --workspace @delthin/dsh-fast
```

打包完成后，请使用 DSH 宿主支持的本地 tarball 导入方式或配置 patch 入口，将生成的包加载到**独立的测试 profile** 中进行验证。

### npm 安装

发布至 npm 后，可通过包管理器安装：

```bash
# 仅在包正式公开或配置私有源发布后可用
npm i @delthin/dsh-fast
```

## 配置说明

在 DSH 配置文件中通过 patch 方式引入插件。以下为安全配置示例（示例中的 `REPLACE_WITH_SOURCE_HTTP_ENDPOINT`、`REPLACE_WITH_TRUSTED_TARGET_HTTP_ENDPOINT` 占位符及供应商 ID 必须替换为真实的 `HTTP(S)` URL 与实际配置值，不能原样运行）：

```yaml
- insert:
  - id: fast
    name: "@delthin/dsh-fast"
    config:
      provider: "my-responses-provider"
      sourceURL: "REPLACE_WITH_SOURCE_HTTP_ENDPOINT"
      targetURL: "REPLACE_WITH_TRUSTED_TARGET_HTTP_ENDPOINT"
      # 可选：只读角色运行文件路径
      # roleRunsPath: "./agent-roles/runs.json"
```

### 配置项详解

| 字段名 | 类型 | 默认值 | 必填说明 | 作用与约束 |
| :--- | :--- | :--- | :--- | :--- |
| `provider` | `string` | `""` | 启用 Fast 转发必填 | 必须匹配 DSH 中已配置的对应供应商适配器 ID。 |
| `sourceURL` | `string` | `""` | 启用 Fast 转发必填 | 原始 Responses 请求匹配的源端点地址（必须将示例占位符 `REPLACE_WITH_SOURCE_HTTP_ENDPOINT` 替换为真实的 `HTTP(S)` URL，不能原样运行）。 |
| `targetURL` | `string` | `""` | 启用 Fast 转发必填 | 开启 `Fast` 档位后实际转发的目标端点地址（必须将示例占位符 `REPLACE_WITH_TRUSTED_TARGET_HTTP_ENDPOINT` 替换为管理员信任的真实 `HTTP(S)` URL，不能原样运行）。 |
| `roleRunsPath` | `string` | 无 | 可选 | 角色运行快照文件路径。**特别注意：相对路径是相对于 DSH 服务进程的当前工作目录（`cwd`）解析，而非插件包所在目录。** 仅以只读方式访问；未设置或文件不存在时不影响普通会话。 |

### 配置激活规则

1. **默认未激活**：`provider`、`sourceURL`、`targetURL` 默认均为空字符串。缺少其中任意一项时，插件不会创建本地代理，`Standard` 模式正常运作。
2. **缺项拦截**：当上述三项未配齐而用户开启 `Fast` 档位发起请求时，请求会在发往下游前被直接拒绝，并提示配置缺失。
3. **URL 严格校验**：当三项均非空时，插件在初始化阶段校验 `sourceURL` 与 `targetURL`。若保留未替换的占位符、存在非法 URL、内嵌凭据（`username:password`）或 URL fragment（`#...`），插件将直接拒绝初始化。

## 安全注意事项

- **凭据归属与保护**：实际请求的认证头（如 `Authorization`）在转发时会原样保留，但上游凭据仍完全归属原供应商适配器管理。**请勿在插件配置或 YAML patch 中硬编码 API 密钥**。
- **信任边界**：由于转发请求会携带原供应商的认证头，`targetURL` **必须是管理员明确信任的目标地址**，严禁指向不受信任的第三方端点。
- **URL 格式限制**：`sourceURL` 与 `targetURL` 严禁包含内嵌凭据（如 `user:pass@...`）和 `#fragment`。协议支持 HTTP 与 HTTPS，**生产环境强烈建议使用 HTTPS**。
- **本地代理隔离**：转发代理仅绑定本地回环地址（Loopback）监听，使用运行期随机令牌校验，且**不跟随上游重定向（Redirects）**，防止认证头在重定向过程中泄露。未配齐三项转发参数时，不会创建代理服务。

## 兼容性、升级与迁移

### 运行环境与依赖要求

- **Node.js**：`>= 22.19.0`
- **DeepSeek Harness (DSH)**：`>=0.2.1-rc.5 || >=0.2.2-rc.1`
- **Peer / 核心框架范围**：`@deepseek-ai/schemastery >= 3.18.5`，`@deepseek-ai/cordis >= 4.0.5`
- **运行时依赖**：`undici` (`7.30.1`)、`zod` (`4.6.7`)

> **验证状态说明**：当前版本已在 `Node.js 25.9.0`、`@deepseek-ai/cordis 4.1.0`、`@deepseek-ai/schemastery 3.19.0` 环境下完成定点验证，全部 29 项自动化测试通过。目前**尚未执行**最低声明版本（如 Node 22.19.0）的干净环境安装测试，也未在本次构建中覆盖真实浏览器 UI 交互与真实上游供应商的端到端联调。当前版本范围允许依赖更新，但不对未来主/次版本的未声明 API 变动做兼容承诺。

### 从本地包 `dsh-fast` 升级至 `@delthin/dsh-fast`

本次更新将原本地包名 `dsh-fast` 规范化为带作用域的 `@delthin/dsh-fast`：

1. **保留不变的内部标识**：升级时只需将宿主配置中的模块名（`name`）替换为 `@delthin/dsh-fast`。插件内部 ID（`fast`）、客户端与多语言标识（`dsh-fast`）、HTTP 路由前缀（`/api/fast`）、持久化存储域（`storageDomain: "dsh_fast"`，版本 `1`，`sessions` 表）以及配置键名均保持不变。
2. **无自动数据迁移**：本次升级不包含自动配置或外部数据迁移脚本。会话档位状态由 DSH 宿主统一管理在 `dsh_fast` 存储域中；角色运行文件仅只读使用，插件不会自动创建或迁移。
3. **补齐三项必填字段**：如果旧版配置依赖个人环境默认值而省略了 `provider`、`sourceURL` 或 `targetURL`，升级后必须显式补齐这三项配置，否则 `Fast` 转发不会激活。
4. **操作建议**：升级前请先备份 DSH 配置文件与运行数据；切换包名时请确保移除或停用旧版 `dsh-fast` 实例，**切勿将新旧两个插件实例同时启用**。

## 常见问题 (FAQ)

**Q1：开启 `/fast on` 后，为什么模型回复速度没有明显变快，或者费用发生变化？**
A：`Fast` 档位仅负责向请求体写入 `service_tier: "priority"` 并将请求转发至管理员设置的 `targetURL`。实际响应速度与计费标准完全取决于上游供应商对该参数及目标端点的支持情况，请管理员向所接入的供应商核实。

**Q2：不填写 `provider`、`sourceURL`、`targetURL` 可以安装插件吗？**
A：可以加载插件并在 `Standard` 档位下正常对话。但此时不会启动本地转发代理；一旦将当前会话切换为 `Fast` 并发送消息，插件会在请求发出前拦截并提示缺少必要配置。

**Q3：`roleRunsPath` 配置为相对路径时找不到文件怎么办？**
A：`roleRunsPath` 是相对于 **DSH 服务进程的当前工作目录（`cwd`）** 解析的，而不是相对于 `packages/fast` 目录。请核对启动 DSH 服务时的工作目录，或按需调整相对路径层级。

## 变更日志

各版本详细改动与迁移说明请参见 [CHANGELOG.md](<./CHANGELOG.md>)。

## 许可说明

自 `0.1.3` 起，本包采用 [Apache-2.0](./LICENSE) 开源许可证（参见仓库根目录 [LICENSE](../../LICENSE)），Copyright © 2026 Delthin。在遵守许可证条款的前提下，允许商业与非商业使用、修改及分发，无需另行付费获取商业授权，亦不强制衍生作品整体开源；分发时需保留许可证、版权及相关声明并标明修改文件，专利条款等以 [LICENSE](./LICENSE) 原文为准。历史版本 `<= 0.1.2`（含 npm 已发布的 `0.1.2`）已授予的 MIT 许可不撤回，历史 MIT 通知保留在 [LICENSE-MIT-legacy](./LICENSE-MIT-legacy)。

由于 npm 默认 semver 规则会将不同版本元组（tuple）的预发布版本排除在常规 `>=` 范围之外，最低要求为 `>=0.2.1-rc.5` 的包与 DSH `engines.dsh` 宿主范围显式声明为 `>=0.2.1-rc.5 || >=0.2.2-rc.1`；最低要求原本即为 `>=0.2.2-rc.1` 的条目则维持原范围。该配置用于确保当前 RC 与正式新版本均可正常解析，并非承诺兼容未来所有 RC 或 API 变更。
