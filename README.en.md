# Delthin DSH Plugins Monorepo

`Delthin/dsh-plugins` is the public monorepo maintaining four DeepSeek Harness (DSH) plugins. All four workspace packages live under `packages/` and are maintained and published independently. The root `package.json` remains `"private": true` to prevent accidental publishing of a root meta-package; users install only the specific plugin packages they need.

Links: [中文说明](./README.md) | [Releasing & Marketplace Guide](./docs/releasing.md) | [Maintenance Handoff](./docs/package-handoff.md) | [License](./LICENSE)

## Plugin Packages

Each package provides its own entry exports, client bundle, icon, locale resources, and standalone `README.md`, `README.en.md`, and `CHANGELOG.md`. Refer to each package README for configuration details.

| Workspace Path | Package Name | Version | License | DSH Host Range (`engines.dsh`) | Scope & Key Constraints |
| :--- | :--- | :--- | :--- | :--- | :--- |
| [`packages/feishu-notify`](./packages/feishu-notify/README.en.md) | `@delthin/dsh-feishu-notify` | `1.1.1` | `Apache-2.0` | `>=0.2.1-rc.5 \|\| >=0.2.2-rc.1` | Feishu notifications and completion alerts. `notify_user` is called once at completion when overall work lasts at least 3 minutes; `feishu_notify` `status` sends no message while `test` sends a real message bypassing toggles and DND; `AppSecret` is entered only via Web UI and written atomically with `0600` permissions. |
| [`packages/agent-roles`](./packages/agent-roles/README.en.md) | `@delthin/dsh-agent-roles` | `0.4.1` | `Apache-2.0` | `>=0.2.1-rc.5 \|\| >=0.2.2-rc.1` | Role management and delegation built on native DSH Agent Team. Starts with an empty role list by default, preserves roles and run records in the runtime data directory, and keeps runtime data out of git. |
| [`packages/fast`](./packages/fast/README.en.md) | `@delthin/dsh-fast` | `0.1.4` | `Apache-2.0` | `>=0.2.1-rc.5 \|\| >=0.2.2-rc.1` | Fast priority routing and `service_tier: "priority"` forwarding. `provider`, `sourceURL`, and `targetURL` must all be explicitly configured to enable Fast; otherwise Standard mode works normally and Fast requests fail explicitly. `roleRunsPath` is optional and read-only. |
| [`packages/tool-wrap`](./packages/tool-wrap/README.en.md) | `@delthin/dsh-tool-wrap` | `1.2.0` | `Apache-2.0` | `>=0.2.2-rc.1` | On-demand tool definition discovery and PTC bridge. Uses `unwrap` as the official tool (`discover_tools` remains a legacy alias), keeping service names, settings ID, and config filename `tool-discovery.json` stable. The plugin itself is disabled by default; `origin-bootstrap` registers before `tools`. Only initial install or upgrades touching `toolDiscoveryOriginsReady` origin gating require a host restart; settings toggles and config saves apply immediately to subsequent prompts. |

Chinese package docs: [`packages/feishu-notify/README.md`](./packages/feishu-notify/README.md), [`packages/agent-roles/README.md`](./packages/agent-roles/README.md), [`packages/fast/README.md`](./packages/fast/README.md), [`packages/tool-wrap/README.md`](./packages/tool-wrap/README.md).

## License

This repository and new releases of all four packages are licensed under the `Apache-2.0` open-source license ([LICENSE](./LICENSE)). Commercial use, modification, and distribution are permitted subject to the license conditions, including retaining the license, copyright, and related notices, stating changes made to modified files, and following the patent terms in [LICENSE](./LICENSE).

No separate paid commercial license is required, and derivative works as a whole are not required to be open-sourced. Prior versions previously released under the `MIT` license (including historical releases of `@delthin/dsh-agent-roles` `<= 0.4.0` and published versions of `@delthin/dsh-fast` `<= 0.1.2`) retain their existing MIT grants for those specific versions.

## Installation & Loading

All four workspace packages configure `publishConfig.access: "public"` and are published independently. Install only the specific packages you need into your DSH runtime environment or profile according to your host's plugin loading and import patch mechanism:

```bash
npm install @delthin/dsh-feishu-notify
npm install @delthin/dsh-agent-roles
npm install @delthin/dsh-fast
npm install @delthin/dsh-tool-wrap
```

To build local tarballs from source for isolated profile testing after running root checks:

```bash
npm pack --workspace @delthin/dsh-feishu-notify
npm pack --workspace @delthin/dsh-agent-roles
npm pack --workspace @delthin/dsh-fast
npm pack --workspace @delthin/dsh-tool-wrap
```

Load the resulting `.tgz` archive or workspace package into your target DSH profile via the host's local plugin integration workflow, then complete plugin configuration in the Web UI settings.

## Environment & Compatibility Requirements

- **Root Development Tooling**: `Node.js >= 22.19.0`, `npm >= 11.5.1`.
- **GitHub Actions CI Matrix**: `Node.js 22` / `24`, `npm 11.12.1`.
- **Source Format**: Plain JavaScript source code; no compile or build step is required.
- **DSH Host Range Notes**: Because standard npm semver rules exclude prereleases on different version tuples from `>=` ranges, packages requiring `0.2.1-rc.5` declare `>=0.2.1-rc.5 || >=0.2.2-rc.1`, while `tool-wrap` declares `>=0.2.2-rc.1`. Open upper bounds express only the minimum contract baseline and do not guarantee unconditional compatibility with future unreleased DSH API changes.

## Local Development & Verification Workflow

There is no aggregate `npm test` script at the repository root. Use the following root scripts for development and pre-release verification:

1. **Install dependencies (lifecycle scripts disabled)**
   ```bash
   npm ci --ignore-scripts
   ```
2. **Static & unit checks**
   ```bash
   npm run check
   ```
   Runs per-package syntax checks, unit tests, `package.json` manifest validation, YAML checks, locale completeness checks, and version range checks.
3. **Public & privacy boundary audit**
   ```bash
   npm run check:public
   ```
   Scans the workspace for accidental runtime data, secret patterns, machine-specific absolute paths, or private local references.
4. **Pack & isolated install verification**
   ```bash
   npm run check:pack
   ```
   Runs `npm pack` for each of the four packages, installs each tarball in an isolated temporary directory with an empty `DSH_HOME` / temporary profile and cleared `NODE_PATH`, verifies root, `client`, and `bootstrap` imports, and executes the test suite against the packed artifacts.

## Security, Privacy & Repository Boundaries

- **Tracked Content**: Only plugin source code, synthetic test fixtures, automated tests, documentation, and static assets belong in git. Never commit `node_modules/`, runtime profiles, `DSH_HOME` (`home/`), `.env*`, `.npmrc`, `seed-roles`, runtime logs/caches/`runs`, or `.tgz` archives.
- **Runtime Security Constraints**:
  - `@delthin/dsh-fast` forwards the original `Authorization` header to the configured `targetURL`; administrators must only configure fully trusted target gateways. The `priority` tier may incur higher billing rates and does not guarantee lower latency.
  - `@delthin/dsh-feishu-notify` accepts `AppSecret` exclusively via the Web UI and writes it with `0600` permissions; never populate it via environment variables or repository files.
  - `@delthin/dsh-tool-wrap` does not elevate tool execution permissions; enabling automatic tool summary generation invokes the current default model and may incur model usage costs.
