# 发布与市场维护指南 / Releasing & Marketplace Guide

本文档说明 `Delthin/dsh-plugins` 六个插件包的版本管理、手动 npm 发布流程与社区市场申报维护规则。注意区分三个独立阶段：**源码推送至 GitHub 仓库**、**发布包至 npm 注册表**、**向外部插件市场提交收录或更新**；完成前一阶段不等于自动完成后一阶段。

This document covers version management, manual npm publishing, and marketplace maintenance for the six packages in `Delthin/dsh-plugins`. Keep three independent stages distinct: **pushing source code to GitHub**, **publishing packages to the npm registry**, and **submitting/updating marketplace listings**.

---

## 1. 版本管理与发布前检查 / Versioning & Pre-Publish Checks

### 中文说明

仓库使用 `Changesets` 管理版本（`fixed: []`、`linked: []`），六个子包版本彼此独立，根包保持 `"private": true` 不发布：

- `@delthin/dsh-feishu-notify`（当前 `1.1.1`）
- `@delthin/dsh-agent-roles`（当前 `0.4.1`）
- `@delthin/dsh-fast`（当前 `0.1.4`；npm 注册表已存在历史版本 `0.1.2`，新发布版本必须高于注册表现有版本）
- `@delthin/dsh-tool-wrap`（当前 `1.2.0`）
- `@delthin/dsh-global-pins`（当前 `0.2.0`）
- `@delthin/dsh-cardex`（当前源码版本 `0.1.0`，server-only）

日常开发与版本更新步骤：

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

The monorepo uses `Changesets` (`fixed: []`, `linked: []`) so all six packages version independently while the root package remains `"private": true`:

- `@delthin/dsh-feishu-notify` (`1.1.1`)
- `@delthin/dsh-agent-roles` (`0.4.1`)
- `@delthin/dsh-fast` (`0.1.4`; version `0.1.2` already exists on the npm registry, and any new publish must use a version strictly higher than existing registry versions)
- `@delthin/dsh-tool-wrap` (`1.2.0`)
- `@delthin/dsh-global-pins` (`0.2.0`)
- `@delthin/dsh-cardex` (source version `0.1.0`, server-only)

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

### 中文说明

仓库不在版本库或配置文件中保存长期 npm token（禁止将 `.npmrc` 凭证提交入库）。发布由维护者本人在终端手动完成网页登录与双因素认证（2FA）：

1. 登录官方 npm 注册表并确认身份（在浏览器中完成登录/2FA 验证）：
   ```bash
   npm login --registry=https://registry.npmjs.org
   npm whoami --registry=https://registry.npmjs.org
   ```
2. 对待发布子包先执行 `--dry-run` 核对文件列表、包名与版本号（确认目标版本号高于 npm 现有版本）：
   ```bash
   npm publish --dry-run --workspace @delthin/dsh-feishu-notify --access public --registry=https://registry.npmjs.org
   npm publish --dry-run --workspace @delthin/dsh-agent-roles --access public --registry=https://registry.npmjs.org
   npm publish --dry-run --workspace @delthin/dsh-fast --access public --registry=https://registry.npmjs.org
   npm publish --dry-run --workspace @delthin/dsh-tool-wrap --access public --registry=https://registry.npmjs.org
   npm publish --dry-run --workspace @delthin/dsh-global-pins --access public --registry=https://registry.npmjs.org
   npm publish --dry-run --workspace @delthin/dsh-cardex --access public --registry=https://registry.npmjs.org
   ```
3. 核对无误后，按需逐包正式发布（仅对本次需要发版的包执行，本人完成 2FA 确认）：
   ```bash
   npm publish --workspace @delthin/dsh-feishu-notify --access public --registry=https://registry.npmjs.org
   npm publish --workspace @delthin/dsh-agent-roles --access public --registry=https://registry.npmjs.org
   npm publish --workspace @delthin/dsh-fast --access public --registry=https://registry.npmjs.org
   npm publish --workspace @delthin/dsh-tool-wrap --access public --registry=https://registry.npmjs.org
   npm publish --workspace @delthin/dsh-global-pins --access public --registry=https://registry.npmjs.org
   npm publish --workspace @delthin/dsh-cardex --access public --registry=https://registry.npmjs.org
   ```

### English

Never store long-lived npm tokens in the repository or commit `.npmrc` credentials. Publishing is performed manually by the maintainer with interactive browser login and 2FA:

1. Authenticate with the official npm registry and verify your account:
   ```bash
   npm login --registry=https://registry.npmjs.org
   npm whoami --registry=https://registry.npmjs.org
   ```
2. Run `--dry-run` for each target package to inspect bundled files, package name, and version (ensuring the target version is higher than what is currently on npm):
   ```bash
   npm publish --dry-run --workspace @delthin/dsh-feishu-notify --access public --registry=https://registry.npmjs.org
   npm publish --dry-run --workspace @delthin/dsh-agent-roles --access public --registry=https://registry.npmjs.org
   npm publish --dry-run --workspace @delthin/dsh-fast --access public --registry=https://registry.npmjs.org
   npm publish --dry-run --workspace @delthin/dsh-tool-wrap --access public --registry=https://registry.npmjs.org
   npm publish --dry-run --workspace @delthin/dsh-global-pins --access public --registry=https://registry.npmjs.org
   npm publish --dry-run --workspace @delthin/dsh-cardex --access public --registry=https://registry.npmjs.org
   ```
3. Publish the specific package(s) being released and complete interactive 2FA when prompted:
   ```bash
   npm publish --workspace @delthin/dsh-feishu-notify --access public --registry=https://registry.npmjs.org
   npm publish --workspace @delthin/dsh-agent-roles --access public --registry=https://registry.npmjs.org
   npm publish --workspace @delthin/dsh-fast --access public --registry=https://registry.npmjs.org
   npm publish --workspace @delthin/dsh-tool-wrap --access public --registry=https://registry.npmjs.org
   npm publish --workspace @delthin/dsh-global-pins --access public --registry=https://registry.npmjs.org
   npm publish --workspace @delthin/dsh-cardex --access public --registry=https://registry.npmjs.org
   ```

---

## 3. 插件市场收录与维护 / Marketplace Submission & Maintenance

### 中文说明

虽然六个插件源码集中在同一 monorepo（`Delthin/dsh-plugins`）维护，但在外部市场中按六个独立插件条目分别申报与维护：

- **包名与地址稳定性**：采用 npm 包名（`@delthin/dsh-*`）作为稳定安装标识，日常发版后无需每次修改仓库地址。若使用 Git 引用方式，则需指向 monorepo 对应子目录 `path`。
- **Awesome DSH（YAML PR 模式）**：
  - 每个条目的 `url` 指向 monorepo 对应子包目录（如 `packages/feishu-notify`）；npm 包信息由市场从注册表自动关联，不在 YAML 中添加 `npm` 字段。
  - 遵守上游单次 PR 条目数量限制（每个 PR 最多新增 3 个条目；六个插件首次完整申报需拆分为至少两个 PR）。
- **`dshopen`（Issue 申报模式）**：
  - 每个插件包单独提交一个 Issue。
  - 支持基于已发布的 npm 包名申报，或基于完整 40 位 Git commit SHA 加子包 `path` 申报；若采用固定 commit SHA 方式，后续每次版本升级均需提交更新并重新触发复审。
- **许可证与市场审核说明**：
  - 仓库根目录与六个子包新版本统一采用 `Apache-2.0` 开源许可证；历史已按 MIT 发布的旧版本（`@delthin/dsh-agent-roles` `<= 0.4.0`、`@delthin/dsh-fast` `<= 0.1.2`）保留其对应版本的既有 MIT 授权。
  - 外部市场的收录结果仍由各市场维护者（maintainer）按其审核流程独立决定。

### English

Although all six plugins live in a single monorepo (`Delthin/dsh-plugins`), each plugin is submitted and maintained as an independent marketplace entry:

- **Identifier Stability**: Using npm package names after publication (`@delthin/dsh-*`) keeps installation identifiers stable across releases without updating repository URLs on every bump.
- **Awesome DSH (YAML PR Workflow)**:
  - Point each entry's `url` to its monorepo subdirectory. The marketplace links npm packages from the registry; do not add an `npm` field to the YAML.
  - Respect the upstream limit of at most 3 new plugins per PR (submitting all six packages requires splitting across at least two PRs).
- **`dshopen` (Issue Workflow)**:
  - Open one Issue per plugin package.
  - Reference either the published npm package or a full 40-character Git commit SHA plus workspace `path`. Note that commit-pinned Git entries require submitting an update and passing review again on every version upgrade.
- **License & Marketplace Review**:
  - The repository root and current package source versions use the `Apache-2.0` open-source license; historical MIT releases (`@delthin/dsh-agent-roles` `<= 0.4.0` and `@delthin/dsh-fast` `<= 0.1.2`) retain their prior MIT grants.
  - Marketplace listing decisions remain subject to each upstream maintainer's independent review process.
