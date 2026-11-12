# 发布与市场维护指南 / Releasing & Marketplace Guide

本文档说明 `Delthin/dsh-plugins` 插件包的版本管理、手动 npm 发布流程与社区市场申报维护规则。注意区分三个独立阶段：**源码推送至 GitHub 仓库**、**发布包至 npm 注册表**、**向外部插件市场提交收录或更新**；完成前一阶段不等于自动完成后一阶段。

This document covers version management, manual npm publishing, and marketplace maintenance for the packages in `Delthin/dsh-plugins`. Keep three independent stages distinct: **pushing source code to GitHub**, **publishing packages to the npm registry**, and **submitting/updating marketplace listings**.

---

## 1. 版本管理与发布前检查 / Versioning & Pre-Publish Checks

### 中文说明

仓库使用 `Changesets` 管理版本（`fixed: []`、`linked: []`），各子包独立发版，根包保持 `"private": true` 不发布。包名及源码版本以各包清单为准。

日常开发与版本更新步骤：版本以各包清单和 npm 实时结果为准；执行版本更新前先核对所有待消耗的 changeset，避免带入并行包。完整流程见 [AGENTS.md](../AGENTS.md#插件发布流程)。

1. 记录变更集：
   ```bash
   npm run changeset
   ```
2. 消耗变更集并更新对应子包版本与 `CHANGELOG.md`：
   ```bash
   npm run version:packages
   ```
3. 发布前必须在仓库根目录完整执行并通过三项检查：
   ```bash
   npm ci --ignore-scripts
   npm run check
   npm run check:public
   npm run check:pack
   ```

### English

The monorepo uses `Changesets` (`fixed: []`, `linked: []`) to version packages independently; the root package remains `"private": true`. Check package manifests and the live npm registry for versions, and review all pending changesets before applying them so parallel changes are not included accidentally. See [AGENTS.md](../AGENTS.md#插件发布流程) for the complete workflow.

Standard versioning and verification steps:

1. Record a changeset: `npm run changeset`
2. Apply version bumps and update changelogs: `npm run version:packages`
3. Run all required root checks before publishing:
   ```bash
   npm ci --ignore-scripts
   npm run check
   npm run check:public
   npm run check:pack
   ```

---

## 2. 手动 npm 发布流程 / Manual npm Publishing

用户本人完成 npm 登录、2FA 和正式发布。具体发布步骤及源码隔离、验收和市场核实规则见 [AGENTS.md](../AGENTS.md#插件发布流程)。不要提交长期 token、认证配置或临时发布文件。

在已验收的固定快照中生成 tarball，记录文件路径和 SHA-512；逐包核对实际文件清单并预演。下面的路径是示例，须替换成已验收产物的实际路径：

```bash
npm publish "path/to/verified-package.tgz" --dry-run --access public --registry=https://registry.npmjs.org
npm login --registry=https://registry.npmjs.org
npm whoami --registry=https://registry.npmjs.org
npm publish "path/to/verified-package.tgz" --access public --registry=https://registry.npmjs.org
```

发布后查询指定包和版本的 `dist.integrity` 并与 tarball 的 SHA-512 比对。注册表处理期间先等待，不重复发布。

The maintainer performs npm login, 2FA, and publishing. Follow [AGENTS.md](../AGENTS.md#插件发布流程) for the complete release, isolation, verification, and marketplace process. Do not commit long-lived tokens, authentication configuration, or temporary artifacts. Create and verify the tarball from the fixed release snapshot; substitute its actual path in the commands above. After publication, compare the registry's `dist.integrity` for the exact package version with the verified tarball's SHA-512. Wait for registry processing rather than publishing again.

---

## 3. 插件市场收录与维护 / Marketplace Submission & Maintenance

### 中文说明

虽然插件源码集中在同一 monorepo（`Delthin/dsh-plugins`）维护，但在外部市场中按独立插件条目分别申报与维护：

- **包名与地址稳定性**：采用 npm 包名（`@delthin/dsh-*`）作为稳定安装标识，日常发版后无需每次修改仓库地址。若使用 Git 引用方式，则需指向 monorepo 对应子目录 `path`。
- **Awesome DSH（YAML PR 模式）**：
  - 每个条目的 `url` 指向 monorepo 对应子包目录（如 `packages/feishu-notify`）；npm 包信息由市场从注册表自动关联，不在 YAML 中添加 `npm` 字段。
  - 遵守上游单次 PR 条目数量限制（具体限制以提交时的上游贡献指南为准）。
- **`dshopen`（Issue 申报模式）**：
  - 每个插件包单独提交一个 Issue。
  - 支持基于已发布的 npm 包名申报，或基于完整 40 位 Git commit SHA 加子包 `path` 申报；若采用固定 commit SHA 方式，后续每次版本升级均需提交更新并重新触发复审。
- **许可证与市场审核说明**：
  - 仓库根目录与子包新版本统一采用 `Apache-2.0` 开源许可证；历史已按 MIT 发布的旧版本（`@delthin/dsh-agent-roles` `<= 0.4.0`、`@delthin/dsh-fast` `<= 0.1.2`）保留其对应版本的既有 MIT 授权。
  - 外部市场的收录结果仍由各市场维护者（maintainer）按其审核流程独立决定。

### English

Although the plugins live in a single monorepo (`Delthin/dsh-plugins`), each plugin is submitted and maintained as an independent marketplace entry:

- **Identifier Stability**: Using npm package names after publication (`@delthin/dsh-*`) keeps installation identifiers stable across releases without updating repository URLs on every bump.
- **Awesome DSH (YAML PR Workflow)**:
  - Point each entry's `url` to its monorepo subdirectory. The marketplace links npm packages from the registry; do not add an `npm` field to the YAML.
  - Check the current upstream contribution guide for the per-PR submission limit.
- **`dshopen` (Issue Workflow)**:
  - Open one Issue per plugin package.
  - Reference either the published npm package or a full 40-character Git commit SHA plus workspace `path`. Note that commit-pinned Git entries require submitting an update and passing review again on every version upgrade.
- **License & Marketplace Review**:
  - The repository root and current package source versions use the `Apache-2.0` open-source license; historical MIT releases (`@delthin/dsh-agent-roles` `<= 0.4.0` and `@delthin/dsh-fast` `<= 0.1.2`) retain their prior MIT grants.
  - Marketplace listing decisions remain subject to each upstream maintainer's independent review process.
