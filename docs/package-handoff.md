# 日常维护与仓库协作说明 / Maintenance & Repository Handoff

本文档记录 `Delthin/dsh-plugins` 的源码维护边界、历史独立仓库关系与本机部署原则，供日常开发与维护参考。

This document outlines source-of-truth boundaries, historical repository relationships, and local deployment conventions for `Delthin/dsh-plugins`.

---

## 1. 唯一源码基准与本机运行环境 / Single Source of Truth & Local Runtime

### 中文说明

- **唯一源码位置**：本仓库 `packages/` 下的四个目录（`feishu-notify`、`agent-roles`、`fast`、`tool-wrap`）是四个插件的唯一开发源码基准。所有功能开发、缺陷修复、文档更新与版本发布均在本仓库内完成。
- **本机运行目录区分**：宿主机运行环境中加载的 `plugins/` 目录属于本机部署入口，而非源码开发副本。不要在运行目录中直接修改源码，也不要将本机运行配置、数据或本机绝对路径写入本仓库。本机服务与部署目录的具体结构及同步方式见宿主工作区的 `AGENTS.md`。

### English

- **Single Source of Truth**: The four directories under `packages/` (`feishu-notify`, `agent-roles`, `fast`, `tool-wrap`) are the sole authoritative source for plugin development, bug fixes, documentation, and releases.
- **Runtime Directory Separation**: Any local `plugins/` directory used by a live DSH host profile is a deployment target, not a development copy. Do not edit code directly in runtime directories or commit local runtime state, credentials, or machine-specific absolute paths into this repository. Refer to the host workspace `AGENTS.md` for local deployment specifics.

---

## 2. 历史独立仓库与许可证延续 / Historical Repositories & License Continuity

### 中文说明

- **历史仓库状态**：`@delthin/dsh-agent-roles` 与 `@delthin/dsh-fast` 早期曾在独立 Git 仓库中开发（其中 `agent-roles` 迁入时通过 `git subtree` 保留了提交历史）。原独立仓库保留其历史记录与早期 release，未作破坏性修改；后续所有开发、维护与新版本发布均已统一转入本 monorepo。
- **许可证切换与既有授权**：自统一采用 `Apache-2.0` 起，本仓库及四个子包的新版本均按 [LICENSE](../LICENSE) 开源许可证授权（允许商业使用、修改与分发，需保留版权与许可声明并标明修改文件，专利条款以许可证原文为准，无需另行付费获取商业授权，亦不强制衍生作品整体开源）。此前已在独立仓库或 npm 按 `MIT` 许可证发布的历史版本（含 `@delthin/dsh-agent-roles` `<= 0.4.0` 历史版本与 `@delthin/dsh-fast` `<= 0.1.2`）不撤回其对应旧版本的 MIT 授权。

### English

- **Historical Repositories**: `@delthin/dsh-agent-roles` and `@delthin/dsh-fast` were previously developed in standalone repositories (`agent-roles` history was imported via `git subtree`). Those standalone repositories remain intact to preserve historical commits and releases, while all ongoing development and future releases take place in this monorepo.
- **License Continuity**: Current versions in this monorepo are licensed under the `Apache-2.0` open-source license ([LICENSE](../LICENSE)), permitting commercial use, modification, and distribution without requiring a separate paid license or forcing derivative works as a whole to be open-sourced, subject to retaining notices, marking modified files, and the patent terms in the license. Historical versions previously released under `MIT` (including prior MIT releases of `@delthin/dsh-agent-roles` `<= 0.4.0` and `@delthin/dsh-fast` `<= 0.1.2`) retain their original MIT license grants for those specific versions.

---

## 3. 日常维护检查清单 / Routine Maintenance Checklist

### 中文说明

1. 修改任何子包代码、配置 schema、多语言词条或文档后，在根目录运行 `npm run check` 与 `npm run check:public`。
2. 涉及导出入口、`package.json` 字段、依赖范围或打包文件列表变更时，额外运行 `npm run check:pack` 验证隔离安装。
3. 保持 `tool-wrap` 的兼容契约稳定：工作区目录与包名为 `tool-wrap` / `@delthin/dsh-tool-wrap`，正式运行态工具名为 `unwrap` 并保留旧工具名 `discover_tools` 兼容，服务标识、设置 ID 与配置文件名 `tool-discovery.json` 不得随意改名。
4. 发布与市场更新按 [docs/releasing.md](./releasing.md) 执行。

### English

1. Run `npm run check` and `npm run check:public` at the repo root after modifying package code, config schemas, locales, or documentation.
2. Run `npm run check:pack` whenever modifying package exports, `package.json` manifests, dependency ranges, or packed file lists.
3. Preserve `tool-wrap` runtime compatibility identifiers: while the workspace directory and package name use `tool-wrap` / `@delthin/dsh-tool-wrap`, use `unwrap` as the canonical runtime tool name with `discover_tools` retained as a compatibility alias, and keep service identifiers, settings ID, and config filename `tool-discovery.json` unchanged.
4. Follow [docs/releasing.md](./releasing.md) for npm publishing and marketplace updates.
基于 Apache-2.0 发布基线提交 `412e219`（不含其他会话未提交的新功能），Node 22 / 24 CI 矩阵与 4 个插件包的独立 tarball 安装验证全部通过；最低宿主版本兼容性与专门的飞书真实消息发送尚未在真实环境验证。

For the fixed Apache-2.0 release baseline at commit `412e219` (excluding uncommitted features from other sessions), both the Node 22 / 24 CI matrix and standalone tarball installation across all 4 packages have passed; minimum host version compatibility and dedicated live Feishu message delivery have not yet been verified.
