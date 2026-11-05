# 发布与市场收录指南 / Releasing & Marketplace Guide

本文档说明 `Delthin/dsh-plugins` 四个工作区包的版本管理、对外发布前置条件、GitHub Actions OIDC 受信任发布（Trusted Publishing）设计以及 DSH 插件市场准入规则。中文在前，英文在后（English section follows below）。

关联文档：[根目录 README](../README.md) | [English README](../README.en.md) | [实施与验收记录](./package-handoff.md)

---

## 第一部分：中文指南

### 1. 当前状态与本轮禁令

当前四个子包均处于私有迁移收尾阶段，状态必须按以下三个维度分别跟踪，不得混同：

| 包名 | 源码仓库公开状态 | npm 发布状态 (`@delthin/*`) | 市场收录状态 (Awesome / `dshopen`) |
| :--- | :--- | :--- | :--- |
| `@delthin/dsh-feishu-notify` (`1.1.0`) | 私有 (`Delthin/dsh-plugins`) | 未发布 (`"private": true`) | 未申请 |
| `@delthin/dsh-agent-roles` (`0.4.0`) | 私有 (`Delthin/dsh-plugins`，原独立仓历史保留) | 未发布 (`"private": true`) | 未申请 |
| `@delthin/dsh-fast` (`0.1.0`) | 私有 (`Delthin/dsh-plugins`) | 未发布 (`"private": true`) | 未申请 |
| `@delthin/dsh-tool-wrap` (`1.2.0`) | 私有 (`Delthin/dsh-plugins`) | 未发布 (`"private": true`) | 未申请 |

**严格前置原则**：
- 未获用户明确授权前，**不修改版本号、不移除 `"private": true`、不执行 `npm publish`、不改变 GitHub 仓库公开性、不提交任何市场收录申请**。
- 严禁在未完成实际发布与校验前提前添加 npm、CI 或市场状态徽章（先验证、后徽章）。
- 当前仓库仅配置验证 CI workflow，**尚未配置自动发布 workflow**；正式版本号与发布命令须等获得授权后再配置。

### 2. 对外发布前必须由用户确认的事项

在启动任何公开或发布操作前，必须向用户逐项确认以下四件事：

1. **三个 `UNLICENSED` 包的正式开源许可证**：`@delthin/dsh-feishu-notify`、`@delthin/dsh-fast`、`@delthin/dsh-tool-wrap` 当前均为 `UNLICENSED`（仅 `@delthin/dsh-agent-roles` 已确定为 `MIT`）。若需公开或上架要求开源许可证的市场，需用户明确指定这三包的许可证并补充对应 `LICENSE` 文件。
2. **npm `@delthin` scope 组织/账户权限**：拥有 GitHub `Delthin` 组织或用户名**不等于**拥有 npm `@delthin` scope 的发布权限。需确认已在 npm 注册并持有 `@delthin` scope 的管理员与发包权限。
3. **具体逐包发布清单与目标版本号**：确认本次是发布单包还是多包，以及每个包的正式目标版本号。
4. **显式操作授权**：分别确认是否授权“切换仓库为 Public”、“发布至 npm 公共注册表”以及“提交外部市场 PR/Issue”。

### 3. Changesets 版本管理流程

仓库集成 `@changesets/cli` (`2.29.7`)，配置为 `fixed: []`、`linked: []`，四个子包版本彼此独立演进。

1. **记录变更意向**：
   ```bash
   npm run changeset
   ```
   在 `.changeset/` 下生成变更描述文件，此步骤不修改任何 `package.json` 的版本号。
2. **消费 Changeset 并更新版本（仅限获得明确发版授权后执行）**：
   ```bash
   npm run version:packages
   ```
   更新受影响子包的 `package.json` 版本号与对应子包的 `CHANGELOG.md`。
3. **移除私有锁并准备发布（仅限获得明确发版授权后对目标包执行）**：
   在目标子包 `package.json` 中移除 `"private": true` 并配置 `publishConfig.access: "public"`（仅配置 `publishConfig.access` 不能替代移除 `"private": true`），同时将 `check-workspaces` 迁移期全量 `private: true` 门禁同步切换为逐包授权发布检查，然后执行全量门禁：
   ```bash
   npm run check
   npm run check:public
   npm run check:pack
   ```

### 4. GitHub Actions OIDC Trusted Publishing 规范

对外发布 npm 包时，优先采用 **GitHub Actions OIDC 受信任发布（Trusted Publishing）**，**不要在仓库或 CI 中配置长期存活的 `NPM_TOKEN`**：

- **运行环境要求**：`Node.js >= 22.14.0`（本仓库根要求 `>= 22.19.0`），`npm >= 11.5.1`（CI 使用 `11.12.1`）。
- **权限与门控设计**：
  - 在 npm 网站逐包为 `@delthin/<pkg>` 绑定 GitHub 仓库 `Delthin/dsh-plugins`、指定的发布 workflow 文件名以及受控的 GitHub Environment（如 `npm-release`）。
  - 在 GitHub 仓库 Settings -> Environments 中为该 Environment 配置 **Required reviewers（人工审批）**，确保每次触发发布 workflow 均需人工批准后才可换取短期 OIDC 令牌。
  - Workflow job 声明 `permissions: { contents: read, id-token: write }`，通过 `npm publish --workspace <pkg> --provenance --access public` 完成签名与可溯源发布。

### 5. 插件市场收录规则（实施时须重新核查最新要求）

外部市场规则可能随时间调整，正式提交前必须重新核查目标仓库的最新说明：

1. **Awesome DSH（PR 模式）**：
   - 通过向目标仓库的 `data/plugins` 目录提交 YAML 条目 Pull Request 申请收录，支持 monorepo 子路径（`path` 字段）。
   - 仓库必须为 Public、带有 `dsh-plugin` GitHub topic，且仓库创建至少满 1 天后才可通过校验。
   - 单次 PR 最多包含 **3 个插件**；因此本仓库 4 个插件全部申请时，**必须拆分为至少 2 个独立的 PR** 提交。
2. **`dshopen`（Issue 模式）**：
   - 通过提交 Issue 申请收录，要求提供公开源码仓库、明确的开源 `LICENSE` 以及可安装的产物的指向。
   - 安装源支持已发布的 npm 包名，或包含完整 **40 位 commit SHA** 的 `git+path` 引用。注意：若使用固定 40 位 SHA，后续每次版本升级均需重新提交审核。
3. **索引协议与渠道选择**：
   - 发布到 npm 并非所有市场索引协议的硬性前提；但若同时面向 Awesome DSH 与 `dshopen` 两个市场，**建议先完成 npm 正式发布**，以统一安装方式并免去固定 commit SHA 升级重审的维护负担。

---

## Part 2: English Guide

### 1. Current State & Non-Publication Guardrails

All four packages are currently in a private post-migration state. Track visibility and release status across three separate dimensions:

| Package | Source Repo Visibility | npm Registry Status (`@delthin/*`) | Marketplace Status (Awesome / `dshopen`) |
| :--- | :--- | :--- | :--- |
| `@delthin/dsh-feishu-notify` (`1.1.0`) | Private (`Delthin/dsh-plugins`) | Unpublished (`"private": true`) | Not submitted |
| `@delthin/dsh-agent-roles` (`0.4.0`) | Private (`Delthin/dsh-plugins`, legacy repo preserved) | Unpublished (`"private": true`) | Not submitted |
| `@delthin/dsh-fast` (`0.1.0`) | Private (`Delthin/dsh-plugins`) | Unpublished (`"private": true`) | Not submitted |
| `@delthin/dsh-tool-wrap` (`1.2.0`) | Private (`Delthin/dsh-plugins`) | Unpublished (`"private": true`) | Not submitted |

**Mandatory Guardrails**:
- Without explicit user authorization, **do not bump versions, do not remove `"private": true`, do not publish to npm, do not change repository visibility, and do not submit marketplace requests**.
- Never add npm, CI, or marketplace badges before publication and verification actually succeed.
- The repository currently includes verification CI workflows only; **no release workflow is configured yet**.

### 2. Prerequisites Requiring User Confirmation

Before initiating any public release, confirm all four items with the user:

1. **Licenses for the three `UNLICENSED` packages**: `@delthin/dsh-feishu-notify`, `@delthin/dsh-fast`, and `@delthin/dsh-tool-wrap` are currently `UNLICENSED` (only `@delthin/dsh-agent-roles` is `MIT`). Confirm the intended open-source license for each package before public release or marketplace submission.
2. **npm `@delthin` scope ownership**: Owning the GitHub `Delthin` account/organization **does not** automatically grant npm `@delthin` scope permissions. Verify npm scope access first.
3. **Per-package target versions**: Confirm which specific packages are approved for release and their exact target version numbers.
4. **Explicit stage authorization**: Confirm separate approval for making the repo public, publishing to npm, and opening marketplace PRs/Issues.

### 3. Changesets Workflow

Changesets (`2.29.7`) is configured with `fixed: []` and `linked: []` so each package versions independently:

1. Record a change intent with `npm run changeset`.
2. Only when explicitly authorized to prepare a release, run `npm run version:packages` to update package versions and per-package `CHANGELOG.md` files.
3. Only for packages explicitly approved for npm publication, remove `"private": true` and pass `npm run check`, `npm run check:public`, and `npm run check:pack`.

### 4. GitHub Actions OIDC Trusted Publishing

Prefer **GitHub Actions OIDC Trusted Publishing** over long-lived `NPM_TOKEN` secrets:

- **Tooling baseline**: `Node.js >= 22.14.0` (repo requires `>= 22.19.0`) and `npm >= 11.5.1` (CI uses `11.12.1`).
- **Workflow controls**: Configure per-package trusted publisher bindings on npm pointing to `Delthin/dsh-plugins`, a dedicated release workflow file, and a protected GitHub Environment with mandatory human approval (`Required reviewers`), using `permissions: { contents: read, id-token: write }`.

### 5. Marketplace Submission Rules (Re-verify Before Execution)

Always re-verify current upstream marketplace rules at submission time:

1. **Awesome DSH**: Submitted via PR adding YAML entries under `data/plugins` (supports monorepo `path`). Requires a public repo with the `dsh-plugin` topic and a repository creation age of at least 1 day. Maximum **3 plugins per PR** — submitting all 4 packages requires **splitting into 2 PRs**.
2. **`dshopen`**: Submitted via Issue requiring public source, an explicit open-source `LICENSE`, and an installable target (either npm or a `git+path` reference pinned to a full **40-character commit SHA**; pinned SHAs require re-review on every upgrade).
3. **Recommendation**: While npm publication is not strictly required by every index protocol, publishing to npm is recommended when targeting both marketplaces.

Currently, the `check-workspaces` guard enforces `"private": true` across all workspace packages during migration to prevent accidental publishing. Before running the release CI for an authorized public release, remove `"private": true`, set `publishConfig.access: "public"` (which does not replace removing `"private": true`), and synchronously switch `check-workspaces` from a blanket `private: true` enforcement to a per-package authorized release allowlist.
