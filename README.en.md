# Delthin DSH Plugins Monorepo

`Delthin/dsh-plugins` is a private monorepo maintaining four plugins for DeepSeek Harness (DSH). All four workspace packages have been migrated into this repository and are maintained as independent packages without a root-level umbrella installer.

Documentation links: [中文说明](./README.md) | [Releasing & Marketplace Guide](./docs/releasing.md) | [Implementation & Handoff Record](./docs/package-handoff.md)

## Current Publication & Visibility Status

- **Source Repository**: `Delthin/dsh-plugins` is currently a private GitHub repository.
- **npm Registry**: All four workspace packages have `"private": true` and have not been published to the `@delthin/*` npm scope.
- **Marketplace Listing**: No submission has been made to Awesome DSH or `dshopen`.
- **License Boundary**: The root `package.json` is marked `UNLICENSED` for root workspace configuration and unlicensed directories; it does not override package-specific open-source licenses (`packages/agent-roles` remains `MIT`).

## Workspace Packages

Each package maintains its own entry exports, client bundle, icons, locale files, and standalone `README.md`, `README.en.md`, and `CHANGELOG.md`.

| Workspace Path | Package Name | Version | License | DSH Host Range (`engines.dsh`) | Core Scope & Key Constraints |
| :--- | :--- | :--- | :--- | :--- | :--- |
| [`packages/feishu-notify`](./packages/feishu-notify/README.en.md) | `@delthin/dsh-feishu-notify` | `1.1.0` | `UNLICENSED` | `>=0.2.1-rc.5 || >=0.2.2-rc.1` | Feishu notifications and completion reminders. `notify_user` fires once at wrap-up for tasks lasting at least 3 minutes; `feishu_notify` `status` sends no message while `test` sends a real message bypassing enable/DND toggles; `AppSecret` is entered via Web UI only and written atomically with `0600` permissions. |
| [`packages/agent-roles`](./packages/agent-roles/README.en.md) | `@delthin/dsh-agent-roles` | `0.4.0` | `MIT` | `>=0.2.1-rc.5 || >=0.2.2-rc.1` | Role management and delegation. Full historical Git commits were preserved via `git subtree` (the legacy repository remains unmodified and unarchived with its historical releases intact); starts with an empty role list on fresh install while preserving runtime data directory roles and records outside Git. |
| [`packages/fast`](./packages/fast/README.en.md) | `@delthin/dsh-fast` | `0.1.0` | `UNLICENSED` | `>=0.2.1-rc.5 || >=0.2.2-rc.1` | Fast routing and `service_tier: "priority"` forwarding. Personal default URLs, providers, and local absolute paths are removed; `provider`, `sourceURL`, and `targetURL` must all be explicitly configured to enable Fast (otherwise Standard works and Fast requests fail explicitly); `roleRunsPath` is optional and read-only. |
| [`packages/tool-wrap`](./packages/tool-wrap/README.en.md) | `@delthin/dsh-tool-wrap` | `1.2.0` | `UNLICENSED` | `>=0.2.2-rc.1` | On-demand tool discovery and PTC bridge. Migrated from the local directory name `dsh-tool-discovery` to `tool-wrap`, while preserving tool name `discover_tools`, service identifiers, settings IDs, and `tool-discovery.json`; The plugin defaults to off (not the host PTC mode), `origin-bootstrap` registers before `tools`, and `toolDiscoveryOriginsReady` gating takes effect after restart. |

Chinese package documentation: [`packages/feishu-notify/README.md`](./packages/feishu-notify/README.md), [`packages/agent-roles/README.md`](./packages/agent-roles/README.md), [`packages/fast/README.md`](./packages/fast/README.md), [`packages/tool-wrap/README.md`](./packages/tool-wrap/README.md).

## Runtime & Toolchain Requirements

- **Root Development Requirements**: `Node.js >= 22.19.0`, `npm >= 11.5.1`.
- **GitHub Actions CI Matrix**: `Node.js 22` and `24`, `npm 11.12.1`.
- **Current Local Verification Baseline**: `Node.js 25.9.0`, `Cordis 4.1.0`, and DSH dependency baseline `0.2.2-rc.1`.
- **Source Format**: Plain JavaScript source without a transpile/build step.
- **Compatibility Scope**: Open upper bounds in `engines.dsh` (`>=0.2.1-rc.5 || >=0.2.2-rc.1` or `>=0.2.2-rc.1`) specify the minimum contract baseline and do not guarantee compatibility with unreleased future DSH versions. Passing CI checks does not replace end-to-end verification against live hosts, browsers, or external APIs.

## Verification Workflow

The root workspace does not define a root `npm test` script. Run checks via the following root scripts:

1. **Install dependencies (with lifecycle scripts disabled)**
   ```bash
   npm ci --ignore-scripts
   ```
2. **Run package checks and unit tests**
   ```bash
   npm run check
   ```
   Runs per-package syntax checks, unit tests, `package.json` manifest validation, YAML checks, locale completeness checks, and version range verification.
3. **Run public readiness and secret/path audit**
   ```bash
   npm run check:public
   ```
   Verifies that no runtime data, common secret patterns, local absolute paths, or private local links are present in the repository.
4. **Run isolated tarball pack & load verification**
   ```bash
   npm run check:pack
   ```
   Executes `npm pack` for each of the four packages, installs each tarball into an isolated temporary directory with an empty `DSH_HOME`/profile and cleared `NODE_PATH`, imports root/`client`/`bootstrap` entrypoints, and runs existing tests against the packed artifacts.

## Installation & Local Loading

Because all four packages are currently marked `"private": true` and unpublished, `npm install @delthin/<pkg>` from the public registry is not yet available.

To load a plugin into an isolated local test profile:

1. Run `npm ci --ignore-scripts` and `npm run check` at the repository root.
2. Pack the target workspace package:
   ```bash
   npm pack --workspace @delthin/dsh-feishu-notify
   npm pack --workspace @delthin/dsh-agent-roles
   npm pack --workspace @delthin/dsh-fast
   npm pack --workspace @delthin/dsh-tool-wrap
   ```
3. Load the generated `.tgz` archive or workspace directory into an isolated DSH test profile using your host's local plugin loading mechanism (do not overwrite active production `home/` or local `plugins/` directories).

## Security, Privacy & Repository Boundaries

- **Tracked Content**: Only source code, synthetic test fixtures, automated tests, documentation, and static assets belong in Git.
- **Excluded Content**: `node_modules/`, runtime profiles, `DSH_HOME` (`home/`), `.env*`, `.npmrc`, `seed-roles`, runtime logs/caches/`runs`, and `.tgz` archives must never be committed.
- **Operational Security Notes**:
  - `@delthin/dsh-fast` forwards the caller's `Authorization` header to `targetURL`; administrators must only point `targetURL` at trusted endpoints. The `priority` tier may incur higher billing rates and does not guarantee lower latency.
  - `@delthin/dsh-feishu-notify` accepts `AppSecret` exclusively via the Web UI and stores it atomically with `0600` permissions.
  - `@delthin/dsh-tool-wrap` never escalates tool execution permissions; enabling automatic tool introduction generation invokes the default model and may incur token costs.

## Versioning & Releasing Reference

Versioning is managed with `Changesets 2.29.7` using independent package versions (`fixed: []`, `linked: []`). See [docs/releasing.md](./docs/releasing.md) for publication prerequisites, GitHub Actions OIDC trusted publishing, and marketplace rules, and [docs/package-handoff.md](./docs/package-handoff.md) for current migration and verification records.

Because npm's default semver rules exclude prerelease versions of a different version tuple from standard `>=` ranges, package and DSH `engines.dsh` host ranges with a `>=0.2.1-rc.5` minimum explicitly use `>=0.2.1-rc.5 || >=0.2.2-rc.1`, while entries that already start at `>=0.2.2-rc.1` keep their original range. This ensures resolution across the current RC series and newer stable releases without guaranteeing compatibility with every future RC or API change.
