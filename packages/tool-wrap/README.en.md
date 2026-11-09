# @delthin/dsh-tool-wrap

[中文说明](<README.md>) | [Changelog](<CHANGELOG.md>)

`@delthin/dsh-tool-wrap` is an on-demand tool discovery plugin for DeepSeek Harness (DSH) `>= 0.2.2-rc.1` PTC sessions. It builds a plugin catalog, selection controls, and discovery overview based on actual tool registration origins, condenses selected plugins in compatible PTC SDK prompts into a concise module summary plus tool names, and returns caller-visible raw tool definitions by exact plugin ID when the model invokes `unwrap`.

The plugin is disabled by default. Native tool-calling mode, disabled state, and incompatible SDK assembly paths all retain the host's original tool rendering.

## Key Features

- **Condensed PTC SDK Rendering**: Selected full definitions are deferred from `tools:sdk`; an independent unwrap directory retains plugin IDs, summaries and all deferred tool names.
- **Whole-Plugin Discovery by Exact ID**: Inside `run_code`, the model calls `unwrap` with an exact plugin ID (or an exact tool name for unattributed tools) to inspect full definitions visible to the current caller. Discovery does not perform keyword search, does not execute target tools, and does not expand caller permissions.
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
| `@deepseek-ai/dsh-scope` | `>=0.2.1-rc.5 \|\| >=0.2.2-rc.1` | Scope isolation and tool admission checks |
| `@deepseek-ai/dsh-llm` | `>=0.2.1-rc.5 \|\| >=0.2.2-rc.1` | Default model invocation for description drafting |

### Verification Baseline & Open Version Ranges

- **Host Contract Dependencies**: Starting in DSH `0.2.2-rc.1`, `renderToolsSdk` and `renderToolsSdkPy` moved to `@deepseek-ai/dsh-tool-executor-ptc`, `tools.modeFor` was removed, and step-resolved conditional toolsets were introduced. This plugin relies on these contracts and does not support earlier DSH versions.
- **Adapter Baseline**: The explicit host asset targets audited `cordis 4.1.0` + `DSH 0.2.2-rc.1` file shapes. Host activation and live-service acceptance belong to the maintainer's authorized maintenance window.
- **Open Upper Bounds**: Peer and host version ranges use open upper bounds (`>=`) to permit installation on subsequent releases, but do not guarantee compatibility ahead of time against future breaking host API changes.

## Installation & Migration from Legacy Package

### Installation & Host Wiring

Install via npm (or import the package bundle using the local package mechanism supported by your DSH host):

```bash
npm install @delthin/dsh-tool-wrap
```

To verify and pack from the source repository root:

```bash
npm ci --ignore-scripts
npm run check
npm pack --workspace @delthin/dsh-tool-wrap
```

Wire `@delthin/dsh-tool-wrap/origin-bootstrap` and the main `@delthin/dsh-tool-wrap` plugin entrypoint using the plugin bundle import or startup mechanism supported by your DSH host environment, then restart the DSH service.

### Migrating from `dsh-tool-discovery`

`@delthin/dsh-tool-wrap` replaces the legacy local package name `dsh-tool-discovery`. The official model tool is now `unwrap`; legacy `discover_tools` calls remain supported but are omitted from new ordinary PTC prompts. Service identifiers, settings page IDs, and the profile configuration filename (`tool-discovery.json`) remain unchanged, while client entrypoints, icons, and locale exports are now scoped under `@delthin/dsh-tool-wrap`.

When upgrading, follow these precautions:

1. **Never Enable Both Packages Simultaneously**: Because the legacy and new packages share internal service names, tool identifiers, and page routes, do not load or enable `dsh-tool-discovery` and `@delthin/dsh-tool-wrap` at the same time.
2. **Back Up and Reuse Existing Configuration**: Back up your profile's `tool-discovery.json` before upgrading. The new package reads existing configuration files directly and migrates `v1` / `v2` files to `version: 3` on load or save.
3. **Remove Legacy Package and Restart**: Disable and remove the old `dsh-tool-discovery` plugin according to your host deployment setup, wire up `@delthin/dsh-tool-wrap`, and restart the DSH service so origin gating takes full effect.

## Startup Gating & Entrypoints (`origin-bootstrap` vs. Main Plugin)

The package exports two distinct runtime entrypoints:

1. **`@delthin/dsh-tool-wrap/origin-bootstrap` (Origin Gate Adapter)**
   - Must load **before** `tools` and `system-prompt` admit dependent plugin registrations.
   - Observes real Loader identities for tools and prompt sections, providing `toolDiscoveryOriginsReady` and `toolDiscoveryPromptOriginsReady` respectively, preserving original return values, exceptions and lifecycle.
2. **`@delthin/dsh-tool-wrap` (Main Plugin)**
   - Registers `unwrap`, hooks the `tools:sdk` prompt waterfall, serves settings APIs, and registers client UI assets.
   - Waits on `toolDiscoveryOriginsReady` for deterministic startup ordering.

### Custom Composition and Startup Patches

- The standard patch targets default `tools` and `system-prompt` entries, adding `toolDiscoveryOriginsReady` and `toolDiscoveryPromptOriginsReady` respectively. Custom compositions must merge existing `inject` dependencies with the corresponding gate; later overlays must preserve them (host patches replace `inject` as a whole, not a deep merge).
- Observation cannot recover tools or sections registered before installation. Initial installation, upgrading this prompt-source gate or changing bootstrap wiring requires a restart and re-registration in an authorized maintenance window to capture complete sources; refreshing the browser cannot backfill them. Saving settings applies to subsequent requests without a restart.

## Usage

### Web UI Configuration

Once enabled, open **Tools and prompts** from the left sidebar (or under **More**, or via **Settings → Tools and prompts**):

1. Enable the required top-level toggles. Prompt roles, ordering and exclusion require **Prompt composition**.
2. **Injected** automatically places each prompt in the upper **System prompts** or lower **User context** section. Drag or press `Alt + ↑ / ↓` to reorder within a section. Cross-section dragging changes that prompt’s role; **More** in the detail pane also provides move and reset-default-role actions. Holding a drag at a section or detail edge scrolls continuously.
3. In **Tools**, click **Move in** to place an entire plugin inside **On-demand packs**; **Move out** restores ordinary tool exposure. Click a name to select individual tools. Pack ordering and outer tool-source ordering are independent; identified tools-only plugins are also orderable.
4. In **Injected**, click a prompt’s trash button to move it to **Excluded**. **Restore** returns to **Injected**, selects that individual prompt and places it by its effective role.
5. Click **Save Settings** at the bottom. Tool selection, ordering and exclusions remain cancellable drafts until saved. Changes apply to subsequent prompt assemblies across sessions in the active profile; in-flight requests are not modified retroactively.

The unified list includes all known prompt sources, including sources without global tools. Tools without recorded origins remain individually selectable under **Unidentified Origin**; unattributed prompt contributions are displayed separately without guessing a plugin from their names.

### Unified Tools and Prompt Composition

The left pane has **Injected / Excluded / Tools** tabs. Individual prompts appear in upper System prompts and lower User context sections, so a plugin’s sections can occupy different roles without expanding a plugin or repeatedly choosing role buttons. Each row retains its registered source identity. Tools independently manages the collapsible on-demand pack group; moving a prompt never changes tool selection or plugin ownership.

Role placement follows a section’s explicit role, parent field settings and registered default. Moving between sections overrides only that prompt’s role, retaining delivery and injection state. The detail pane shows one prompt body, with move, reset-default-role and delivery actions under **More**. Reset reclassifies it using inheritance. Unsupported stored roles appear in **Role needs recovery**, not falsely in System or User. Delivery remains `inherit/always/pack`; automatic delivery depends on the caller’s tool packs and host capabilities. Developer-role projection is not exposed. Legacy `order` and group rules remain compatible; the first individual reordering adds optional `sourceOrder` so interleaved cross-plugin ordering applies to actual prompt assembly. Both detail panes and role sections scroll independently.

The detail pane shows one selected prompt or tool source. Counts use compact labels such as **Tools 2/2**. **Excluded** is a recoverable prompt-exclusion area. Removing a section changes only its `enabled` field, retaining its role, loading policy and tool selection without deleting its registered text. Restore clears the local exclusion when inheritance enables it, or explicitly enables the section when its parent remains disabled. An excluded prompt leaves its role section; tool entries and selection remain unchanged. Host-fixed contributions show a lock. Exclusion rules take effect only with prompt composition enabled, and all changes still require saving.

With composition enabled, dedicated sections and contexts for a folded plugin follow its pack by default; `always` keeps them resident. Native transport, unavailable unwrap, complete personas without the directory and plugins without caller-visible deferred tools retain resident guidance. The directory cannot defer itself. Unattributed dynamic assembly contributions remain individually orderable and role-configurable, but cannot be assigned a guessed plugin or automatically follow its pack.

Full composition requires explicit host support after complete-persona enforcement and final runtime-context refresh, before session admission. Ordinary user conversation messages never become configurable instruction sources. Composed system/user messages and surface replacements remain in the ordinary replayable session log. AGENTS exposes per-file boundaries after budget truncation instead of rereading files or guessing text boundaries. Observed dynamic sources retain identities only, not session bodies or IDs, and appear after actual admission. Body previews read only global registration literals or templates, leaving variables unresolved. Settings never execute dynamic providers: these are labelled **Generated per conversation**. Metadata-only sources show **No body preview**. Both labels describe preview availability; actual loading follows the caller’s context and composition settings. **Source not currently found** identifies a saved source absent from current registrations or observations, whose settings remain preserved. These previews are not the final context sent by a particular request.

Independent profile configuration is `prompt-composition.json`:

```json
{ "version": 1, "enabled": false, "order": [], "rules": {} }
```

`order` accepts group/source IDs; `rules[id]` is `{role:"inherit",delivery:"inherit"}`. Legacy `prompt-order.json` v1 priorities migrate while preserving the original file; the broader composition policy starts disabled pending confirmation. Existing settings for uninstalled sources are retained. `GET/PUT /api/tool-discovery/prompt-composition` returns configuration, flat source metadata and real host capabilities, rejecting unsupported role/delivery choices. Persistence is separate from tool settings, authenticated and same-origin, capped at 64 KiB, atomic with 0600 permissions, and never invokes a model.

#### Explicit Host Adaptation

Review [host-support](<host-support/README.md>) before applying. The local adapter accepts only audited `0.2.2-rc.1` hashes and file shapes; the package's open minimum-version ranges remain unchanged. This is not an existing public host API and never runs through npm lifecycle hooks, plugin loading or synchronization.

```bash
node host-support/adapter.mjs --check --root <installation-root>
node host-support/adapter.mjs --apply --root <installation-root> --backup <backup-directory>
node host-support/adapter.mjs --restore --root <installation-root> --backup <backup-directory>
```

Application requires review and authorization. Restoration only touches files still matching original or adapted hashes. The script never restarts services or modifies live profiles. Without the complete adapter, known sources and limitation reasons remain visible, but unified composition cannot be enabled.

### Model Discovery Workflow

In a compatible PTC session, the prompt instructs the model to unpack needed plugins proactively via `unwrap` without waiting for the user to ask:

1. **Inspect Available On-Demand Plugins** (optional): Run `return await tools.unwrap({});` inside `run_code` to list caller-visible on-demand plugins.
2. **Load Full Definitions by Plugin ID**: Run `return await tools.unwrap({ plugin: "exact-plugin-id", format: "schema" });` to retrieve full descriptions, parameter schemas, and return types for all caller-visible on-demand tools in that plugin. Load one plugin per `run_code` call to avoid output truncation.
3. **Load an Unattributed Tool**: Run `return await tools.unwrap({ tool: "exact_tool_name", format: "schema" });` for standalone tools without a recorded plugin origin.
4. **Invoke Tools Normally**: Call `tools.<name>(...)` in subsequent `run_code` steps.

`format: "schema"` keeps the complete original parameter and return schemas while omitting the duplicate SDK type text. Omit `format` or use `"full"` for the backward-compatible result containing both `schemas` and `sdk`. Type projections are not equivalent to original schemas: exclusive `oneOf` branches, integers and special property names may not be fully represented.

The host serializes returned packs as complete JSON. If printing, use `console.log(JSON.stringify(await tools.unwrap({plugin: "exact-plugin-id", format: "schema"})))`, never `console.log(object)`, which can truncate long SDK strings through Node inspection. Python should use `json.dumps`. Both bindings retain the same conditional admission, scope, `toolSet`, and permission checks.

## Plugin Descriptions & Default Model Drafting

Select a plugin and expand its description under the **Tools** tab to view or customize it. Prompt-only plugins provide the same entry in their prompt view:

- **Precedence**: Saved custom descriptions take priority over package-provided developer descriptions. Clearing the field or clicking **Restore Developer Description** and saving removes the custom override.
- **Limits**: Up to 512 plugin description overrides can be stored; each description must be `1–2000` characters after trimming whitespace.
- **Drafting with Default Model**: For plugins without a developer description, clicking **Generate Description** invokes the deployment's default LLM using only the selected plugin's global tool names and descriptions (**never** parameter schemas, return schemas, or conversation messages). Requests time out after 120 seconds and may incur model usage charges. Generated text populates the editor as an unsaved draft until you click **Save Settings**; errors are sanitized and never overwrite saved configuration.

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
- **Reserved Tools**: `run_code`, `unwrap`, and legacy `discover_tools` cannot be added to `tools` or `exclude`; whole-plugin folding also protects these entrypoints.
- `descriptions`: Map of exact plugin ID to custom summary string (max 512 entries; each value `1–2000` characters after trim).

### Legacy Migration & File Safety

- **Automatic Upgrade**: Legacy `v1` group aliases (`browser`, `image`, `schedule`) and `v2` opaque plugin IDs are automatically mapped to `v3` plugin IDs while preserving `enabled`, `tools`, and `exclude`.
- **Atomic Writes**: Updates write to a temporary file in the same directory and atomically `rename` with `0600` permissions.
- **Corruption Protection**: If `tool-discovery.json` is malformed or invalid, the plugin reports an error rather than silently overwriting the file.

## Security, Permissions & Isolation

- **Settings API Protection**: Configuration and description-generation endpoints enforce host authentication, same-origin checks, and a `64 KiB` request body limit.
- **Tool Permissions Stay Unchanged**: Tool discovery and prompt composition neither wrap execution nor call `tools.restrict`. Instruction-role changes require explicit authenticated configuration and the host admission adapter; ordinary user messages are never promoted. `unwrap` resolves definitions strictly from the intersection of the caller's `scope` and the host's step-resolved `toolSet`, preserving conditional admission, scoped shadows, parameter validation, approvals, guards, cancellation, and sandboxing.
- **Session Isolation**: Discovery output is returned solely as a tool result in the calling conversation. When composition is enabled, visible successful unpack results activate guidance in the calling session’s configured real message roles. There is no shared cross-session "unlocked tool pool" or write-back to global prompt definitions. Released or foreign session snapshots cannot be used to inspect or invoke tools.
- **Dynamic Context Preservation**: Without composition, other plugins’ dynamic context keeps its original path. With composition, the accepted step’s refreshed context follows configured delivery; unwrap does not re-evaluate dynamic providers.

## Performance Metrics & Fallback Behavior

### SDK Projection Character Metrics

The settings page displays **Global Estimate** and **Last Assembly** metrics (recording projected SDK character counts and a truncated SHA-256 digest, without storing prompts, parameters, or session IDs):

- Reported savings reflect **projected PTC SDK characters** only (factoring in the overhead of `unwrap` and the plugin overview catalog; folding only one or two tiny tools may result in net-positive character overhead).
- **Important**: Projected SDK character counts and digest stability do not equal provider-billed token counts or guaranteed prompt-cache hits. SDK rendering is deterministic, but configured role/order changes and pack-guidance activation can change system text and its cache prefix; actual cache hit rates and token savings must be evaluated using provider usage/cache telemetry.

Metrics reflect saved tool settings; an unsaved draft displays a stale-estimate notice. Overhead is shown as a positive **Net increase**, not negative savings. Prompt composition and unwrap responses are outside these metrics. If host capabilities invalidate a saved option, choose a supported value or restore inheritance for that field without resetting unrelated rules or ordering.

### Design References

Official sources checked on 2026-11-07:

- [Anthropic: Context engineering](https://www.anthropic.com/research/effective-context-engineering-for-ai-agents): retain a lightweight index and load high-signal context just in time. This plugin pairs an exact-plugin directory with complete on-demand definitions.
- [Anthropic: Writing tools for agents](https://www.anthropic.com/research/writing-tools-for-agents): focus tool responses on relevant information and offer concise/detailed formats. Here, compact output removes duplication rather than parameter or return constraints.
- [MCP: Tools specification](https://modelcontextprotocol.io/specification/2026-07-28/server/tools): return a deterministic order for unchanged tool sets. The directory sorts plugins and tool names rather than relying on registration order.
- [OpenAI: Prompt caching](https://developers.openai.com/api/docs/guides/prompt-caching): reuse depends on matching rendered prefixes. Smaller text and stable ordering alone do not prove cache hits; evaluate provider usage.

These are design principles, not an implementation of provider-native tool search or cache-breakpoint APIs. Exact-ID discovery and DSH execution permissions remain unchanged.

### Automatic Fallbacks

The plugin retains complete business-tool definitions in these cases; when the raw SDK matches exactly, it still hides the compatibility alias:

1. The plugin is disabled or the session uses native (non-PTC) tool calling.
2. `unwrap` is not visible to the caller or PTC `run_code` transport is unavailable.
3. Another plugin has already modified `tools:sdk` in an incompatible format (recorded as `incompatible-sdk`).
4. The active preset forcibly restores its own full system prompt after waterfall assembly (such as the `complete` persona).

## FAQ

### 1. Why do all tools appear under "Unidentified Origin" after installing or upgrading?
`@delthin/dsh-tool-wrap/origin-bootstrap` must run before the host loads and registers tool plugins. Hot-reloading the plugin or refreshing the browser cannot retroactively capture origins for already-registered tools. Verify `origin-bootstrap` is wired in your startup configuration and **restart the DSH service**.

### 2. Does toggling settings affect an already running response?
In-flight requests are not modified retroactively. Saved settings take effect on subsequent prompt assemblies for sessions in that profile. Calling `unwrap` during a conversation never modifies `tool-discovery.json`.

### 3. Why is a specific tool still shown in full even though its plugin is checked?
Check whether that tool is listed in `exclude`. Excluded tools take precedence over `groups` and `tools` and always remain expanded.

### 4. Does "Generate Description" send conversation history or parameter schemas to the LLM?
No. It sends only the selected plugin's global name, tool names, and brief tool descriptions to the deployment's default model.

## Changelog

See [CHANGELOG.md](<CHANGELOG.md>) for release and migration details.

## License

Licensed under [`Apache-2.0`](../../LICENSE) (see package [`LICENSE`](./LICENSE) or repository root [`LICENSE`](../../LICENSE)).

- **Permitted Use**: Commercial and noncommercial use, copying, modification, and distribution are permitted without requiring a separate paid commercial license or forcing derivative works as a whole to be open-sourced.
- **Notices & Modification Marks**: Redistributing source code or derivative works requires retaining the license, copyright, and related notices, and stating changes in modified files.
- **Patent & Full Terms**: Patent grants, termination provisions, and warranty disclaimers are governed by the full text in [`LICENSE`](../../LICENSE).

Because npm's default semver rules exclude prerelease versions of a different version tuple from standard `>=` ranges, package and DSH `engines.dsh` host ranges with a `>=0.2.1-rc.5` minimum explicitly use `>=0.2.1-rc.5 || >=0.2.2-rc.1`, while entries that already start at `>=0.2.2-rc.1` keep their original range. This ensures resolution across the current RC series and newer stable releases without guaranteeing compatibility with every future RC or API change.
