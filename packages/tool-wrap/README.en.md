# @delthin/dsh-tool-wrap

[中文说明](<README.md>) | [Changelog](<CHANGELOG.md>)

`@delthin/dsh-tool-wrap` is an on-demand tool discovery plugin for DeepSeek Harness (DSH) `>= 0.2.2-rc.1` PTC sessions. It builds a plugin catalog, selection controls, and discovery overview based on actual tool registration origins, condenses selected plugins in compatible PTC SDK prompts into a concise module summary plus tool names, and returns caller-visible raw tool definitions by exact plugin ID when the model invokes `discover_tools`.

The plugin is disabled by default. Native tool-calling mode, disabled state, and incompatible SDK assembly paths all retain the host's original tool rendering.

## Key Features

- **Condensed PTC SDK Rendering**: When enabled, selected plugins appear in the system prompt's `tools:sdk` section with only their plugin ID, summary description, and tool names—omitting full parameter and return-type definitions from the standing prompt.
- **Whole-Plugin Discovery by Exact ID**: Inside `run_code`, the model calls `discover_tools` with an exact plugin ID (or an exact tool name for unattributed tools) to inspect full definitions visible to the current caller. Discovery does not perform keyword search, does not execute target tools, and does not expand caller permissions.
- **Granular Scope Controls**: Configure on-demand folding by whole plugin (`groups`), explicit tool names (`tools`), and high-priority exclusions (`exclude`). Selecting a plugin automatically covers tools added by that plugin in future updates, while excluded tools always retain their full SDK definitions.
- **Plugin Description Management**: Uses developer-provided package descriptions by default, allows custom overrides per plugin (1–2,000 characters after trimming), and supports drafting descriptions via the deployment's default LLM using only global tool names and descriptions.
- **Smooth Migration & Atomic Persistence**: Automatically upgrades legacy `v1` and `v2` configurations to `v3`, writing to the active profile's `tool-discovery.json` via same-directory atomic rename with `0600` file permissions.

## Requirements & Compatibility

| Component / Dependency | Version Requirement | Notes |
| :--- | :--- | :--- |
| Node.js | `>= 22` | Runtime and test execution baseline |
| `@deepseek-ai/dsh` | `>= 0.2.2-rc.1` | Core host requirement |
| `@deepseek-ai/cordis` | `>= 4.0.5` | Service and plugin lifecycle framework |
| `@deepseek-ai/dsh-tools` | `>= 0.2.2-rc.1` | Required for step-resolved conditional toolsets |
| `@deepseek-ai/dsh-tool-executor-ptc` | `>= 0.2.2-rc.1` | Required for `renderToolsSdk` / `renderToolsSdkPy` exports |
| `@deepseek-ai/dsh-scope` | `>=0.2.1-rc.5 || >=0.2.2-rc.1` | Scope isolation and tool admission checks |
| `@deepseek-ai/dsh-llm` | `>=0.2.1-rc.5 || >=0.2.2-rc.1` | Default model invocation for description drafting |

### Verification Baseline & Open Version Ranges

- **Host Contract Dependencies**: Starting in DSH `0.2.2-rc.1`, `renderToolsSdk` and `renderToolsSdkPy` moved to `@deepseek-ai/dsh-tool-executor-ptc`, `tools.modeFor` was removed, and step-resolved conditional toolsets were introduced. This plugin relies on these contracts and does not support earlier DSH versions.
- **Targeted Test Baseline**: Verified against `cordis 4.1.0` + `DSH 0.2.2-rc.1` with 108 targeted tests (104 passed, 4 skipped locally due to macOS `sandbox-exec` `sandbox_apply: Operation not permitted`; browser E2E automation was not run, and isolated public CI verification is pending).
- **Open Upper Bounds**: Peer and host version ranges use open upper bounds (`>=`) to permit installation on subsequent releases, but do not guarantee compatibility ahead of time against future breaking host API changes.

## Installation & Migration from Legacy Package

This package lives in the private source repository (`Delthin/dsh-plugins`) at version `1.2.0` (`private: true`, `UNLICENSED`). It has not been published to the public npm registry or submitted to the plugin marketplace.

### Building and Installing from Source

From the repository root, install dependencies, run checks, and pack the workspace:

```bash
npm ci --ignore-scripts
npm run check
npm pack --workspace @delthin/dsh-tool-wrap
```

Install the resulting tarball or mount the package into an isolated test profile using the local package or startup patch mechanism supported by your DSH host environment.

> **Note**: Direct registry commands such as `npm install @delthin/dsh-tool-wrap` will only become available after a future npm release.

### Migrating from `dsh-tool-discovery`

`@delthin/dsh-tool-wrap` replaces the legacy local package name `dsh-tool-discovery`. Internal tool names (`discover_tools`), service identifiers, settings page IDs, and the profile configuration filename (`tool-discovery.json`) remain unchanged, while client entrypoints, icons, and locale exports are now scoped under `@delthin/dsh-tool-wrap`.

When upgrading, follow these precautions:

1. **Never Enable Both Packages Simultaneously**: Because the legacy and new packages share internal service names, tool identifiers, and page routes, do not load or enable `dsh-tool-discovery` and `@delthin/dsh-tool-wrap` at the same time.
2. **Back Up and Reuse Existing Configuration**: Back up your profile's `tool-discovery.json` before upgrading. The new package reads existing configuration files directly and migrates `v1` / `v2` files to `version: 3` on load or save.
3. **Remove Legacy Package and Restart**: Disable and remove the old `dsh-tool-discovery` plugin according to your host deployment setup, wire up `@delthin/dsh-tool-wrap`, and restart the DSH service so origin gating takes full effect.

## Startup Gating & Entrypoints (`origin-bootstrap` vs. Main Plugin)

The package exports two distinct runtime entrypoints:

1. **`@delthin/dsh-tool-wrap/origin-bootstrap` (Origin Gate Adapter)**
   - Must be loaded **before** the host `tools` service registers tool plugins.
   - Records the loader plugin identity for each registered tool and provides the internal readiness service `toolDiscoveryOriginsReady`.
2. **`@delthin/dsh-tool-wrap` (Main Plugin)**
   - Registers `discover_tools`, hooks the `tools:sdk` prompt waterfall, serves settings APIs, and registers client UI assets.
   - Waits on `toolDiscoveryOriginsReady` for deterministic startup ordering.

### Custom Composition and Startup Patches

- Standard startup patching targets the default `tools` entry. If your host uses a custom composition with an existing `inject` map, merge the existing dependencies and preserve `toolDiscoveryOriginsReady`—post-loaded overlays must not overwrite this gate either (host patches replace `inject` as a whole rather than deep-merging).
- Origin tracking cannot retroactively inspect tools registered before the gate was active. After installing, upgrading, or adjusting `origin-bootstrap` wiring, **you must restart the DSH service**; refreshing the browser alone will not populate registration origins.

## Usage

### Web UI Configuration

Once enabled, open **Tool On-Demand Discovery** from the left sidebar (or under **More**, or via **Settings → Tool On-Demand Discovery**):

1. Turn on the master toggle.
2. Check whole plugins to fold them on demand, or expand a plugin row to include or exclude individual tools.
3. Click **Save Settings** at the bottom. Changes apply to subsequent prompt assemblies across sessions in the active profile; in-flight requests are not modified retroactively.

The UI lists only plugins that currently expose concrete tools in the global catalog, hiding empty entries and session-only identities. Tools without recorded registration origins appear under **Unidentified Origin** and can be selected individually by tool name.

### Model Discovery Workflow

In a compatible PTC session, the prompt instructs the model to unpack needed plugins proactively via `discover_tools` without waiting for the user to ask:

1. **Inspect Available On-Demand Plugins** (optional): Run `console.log(await tools.discover_tools({}))` inside `run_code` to list caller-visible on-demand plugins.
2. **Load Full Definitions by Plugin ID**: Run `console.log(await tools.discover_tools({ plugin: "exact-plugin-id" }))` to retrieve full descriptions, parameter schemas, and return types for all caller-visible on-demand tools in that plugin. Load one plugin per `run_code` call to avoid output truncation.
3. **Load an Unattributed Tool**: Run `console.log(await tools.discover_tools({ tool: "exact_tool_name" }))` for standalone tools without a recorded plugin origin.
4. **Invoke Tools Normally**: Call `tools.<name>(...)` in subsequent `run_code` steps.

## Plugin Descriptions & Default Model Drafting

Expand any plugin row in the settings page to view or customize its summary description:

- **Precedence**: Saved custom descriptions take priority over package-provided developer descriptions. Clearing the field or clicking **Restore Developer Description** and saving removes the custom override.
- **Limits**: Up to 512 plugin description overrides can be stored; each description must be `1–2000` characters after trimming whitespace.
- **Drafting with Default Model**: Clicking **Generate Description** invokes the deployment's default LLM using only the selected plugin's global tool names and descriptions (**never** parameter schemas, return schemas, or conversation messages). Requests time out after 120 seconds and may incur model usage charges. Generated text populates the editor as an unsaved draft until you click **Save Settings**; errors are sanitized and never overwrite saved configuration.

## Configuration Schema & Migration

Settings are stored in `tool-discovery.json` inside the active host profile directory (never copy live profile configurations into the source repository).

### Default Configuration (`version: 3`)

```json
{
  "version": 3,
  "enabled": false,
  "groups": [],
  "tools": [],
  "exclude": [],
  "descriptions": {}
}
```

### Fields & Validation Limits

- `version`: Must be `3`. The settings UI and save endpoint require `v3`.
- `enabled`: Boolean master toggle.
- `groups`: Array of exact plugin IDs (max 512 items). Includes all current and future tools registered by those plugins.
- `tools`: Array of explicit tool names to fold on demand (max 512 items).
- `exclude`: Array of explicit tool names excluded from folding (max 512 items). **`exclude` takes highest precedence**—excluded tools always remain expanded in `tools:sdk`.
- **Reserved Tools**: `run_code` and `discover_tools` cannot be added to `groups`, `tools`, or `exclude`.
- `descriptions`: Map of exact plugin ID to custom summary string (max 512 entries; each value `1–2000` characters after trim).

### Legacy Migration & File Safety

- **Automatic Upgrade**: Legacy `v1` group aliases (`browser`, `image`, `schedule`) and `v2` opaque plugin IDs are automatically mapped to `v3` plugin IDs while preserving `enabled`, `tools`, and `exclude`.
- **Atomic Writes**: Updates write to a temporary file in the same directory and atomically `rename` with `0600` permissions.
- **Corruption Protection**: If `tool-discovery.json` is malformed or invalid, the plugin reports an error rather than silently overwriting the file.

## Security, Permissions & Isolation

- **Settings API Protection**: Configuration and description-generation endpoints enforce host authentication, same-origin checks, and a `64 KiB` request body limit.
- **Zero Permission Escalation**: The plugin only records registration origins and rewrites `tools:sdk` prompt text; it does not wrap tool execution or call `tools.restrict`. `discover_tools` resolves definitions strictly from the intersection of the caller's `scope` and the host's step-resolved `toolSet`, preserving conditional admission, scoped shadows, parameter validation, approvals, guards, cancellation, and sandboxing.
- **Session Isolation**: Discovery output is returned solely as a tool result in the calling conversation. There is no shared cross-session "unlocked tool pool" and no mutation of standing system prompts. Released or foreign session snapshots cannot be used to inspect or invoke tools.
- **Dynamic Context Preservation**: Dynamic prompt context injected by other plugins (such as default image providers or canvas state) remains intact; only the `tools:sdk` definition block is condensed.

## Performance Metrics & Fallback Behavior

### SDK Projection Character Metrics

The settings page displays **Global Estimate** and **Last Assembly** metrics (recording projected SDK character counts and a truncated SHA-256 digest, without storing prompts, parameters, or session IDs):

- Reported savings reflect **projected PTC SDK characters** only (factoring in the overhead of `discover_tools` and the plugin overview catalog; folding only one or two tiny tools may result in net-positive character overhead).
- **Important**: Projected SDK character counts and digest stability do not equal provider-billed token counts or guaranteed prompt-cache hits. While deterministic rendering preserves system prompt prefixes when configuration and visible toolsets remain unchanged, actual cache hit rates and token savings must be evaluated using provider usage/cache telemetry.

### Automatic Fallbacks

The plugin leaves the host's original `tools:sdk` text untouched when:

1. The plugin is disabled or the session uses native (non-PTC) tool calling.
2. `discover_tools` is not visible to the caller or PTC `run_code` transport is unavailable.
3. Another plugin has already modified `tools:sdk` in an incompatible format (recorded as `incompatible-sdk`).
4. The active preset forcibly restores its own full system prompt after waterfall assembly (such as the `complete` persona).

## FAQ

### 1. Why do all tools appear under "Unidentified Origin" after installing or upgrading?
`@delthin/dsh-tool-wrap/origin-bootstrap` must run before the host loads and registers tool plugins. Hot-reloading the plugin or refreshing the browser cannot retroactively capture origins for already-registered tools. Verify `origin-bootstrap` is wired in your startup configuration and **restart the DSH service**.

### 2. Does toggling settings affect an already running response?
In-flight requests are not modified retroactively. Saved settings take effect on subsequent prompt assemblies for sessions in that profile. Calling `discover_tools` during a conversation never modifies `tool-discovery.json`.

### 3. Why is a specific tool still shown in full even though its plugin is checked?
Check whether that tool is listed in `exclude`. Excluded tools take precedence over `groups` and `tools` and always remain expanded.

### 4. Does "Generate Description" send conversation history or parameter schemas to the LLM?
No. It sends only the selected plugin's global name, tool names, and brief tool descriptions to the deployment's default model.

## Changelog

See [CHANGELOG.md](<CHANGELOG.md>) for release and migration details.

## License

`UNLICENSED` (`private: true`). The license for this repository and package has not been finalized. All rights reserved.

Because npm's default semver rules exclude prerelease versions of a different version tuple from standard `>=` ranges, package and DSH `engines.dsh` host ranges with a `>=0.2.1-rc.5` minimum explicitly use `>=0.2.1-rc.5 || >=0.2.2-rc.1`, while entries that already start at `>=0.2.2-rc.1` keep their original range. This ensures resolution across the current RC series and newer stable releases without guaranteeing compatibility with every future RC or API change.
