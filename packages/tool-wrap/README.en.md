# @delthin/dsh-tool-wrap

[![npm](https://img.shields.io/npm/v/%40delthin%2Fdsh-tool-wrap?style=flat-square)](https://www.npmjs.com/package/@delthin/dsh-tool-wrap)
[![Node](https://img.shields.io/node/v/%40delthin%2Fdsh-tool-wrap?style=flat-square)](https://www.npmjs.com/package/@delthin/dsh-tool-wrap)
[![DSH](https://img.shields.io/badge/DSH-%E2%89%A50.2.2--rc.1-6366F1?style=flat-square)](https://dshmarket.com/)
[![license](https://img.shields.io/badge/license-Apache--2.0-8A2BE2?style=flat-square)](https://www.apache.org/licenses/LICENSE-2.0)
[![LINUX DO](https://img.shields.io/badge/LINUX%20DO-%E7%A4%BE%E5%8C%BA-FFB000?style=flat-square)](https://linux.do/)

[中文](README.md) | [Changelog](CHANGELOG.md) | [Marketplace](https://dshmarket.com/zh/p/Delthin/dsh-plugins--packages-tool-wrap/)

In compatible PTC sessions, tool-wrap folds the tool definitions you select into a catalog of brief descriptions plus tool names, and gives the model a single `unwrap` tool to fetch full definitions per plugin when needed. Existing tool permissions are unchanged. Prompt-level composition — roles, ordering, exclusion, and pack-scoped loading — is a further capability that depends on an explicit host adaptation via host-support (see Installation).

For DSH `>= 0.2.2-rc.1` PTC sessions. The plugin is off by default; native tool-calling sessions and the disabled state keep the host's original rendering.

## Installation

```bash
npm install @delthin/dsh-tool-wrap
```

Load `@delthin/dsh-tool-wrap/origin-bootstrap` and the main plugin via your host's plugin import mechanism, then restart DSH. `origin-bootstrap` must load before other tool plugins register (see FAQ below).

Note that installing from npm does not perform the host adaptation for prompt composition: full composition (prompt roles, ordering, exclusion, and pack descriptions entering real messages) requires manually reviewing and running the adapter described in [host-support](host-support/README.md). Without it those features stay unavailable; tool folding itself is unaffected.

### Upgrading from `dsh-tool-discovery`

The model tool is now `unwrap` (`discover_tools` remains callable in old sessions); service names, page IDs, and the `tool-discovery.json` config file are unchanged. To upgrade:

1. Never enable the old and new package in the same host instance (they share internal service and page IDs).
2. Back up `tool-discovery.json` in your profile; the new package reads it directly, migrating automatically on read and saving as `v3`.
3. Remove the old package, load the new one, and restart DSH.

## Usage

### Settings page

Enable the plugin, then open "Tools & Prompts" from the left navigation or settings. The page has three tabs:

1. Turn on the top switches; prompt roles, ordering, and exclusion additionally require the "prompt composition" switch.
2. The Injected tab has three zones: System prompts, User (fixed), and User (state). Both user zones use real user messages. Unchanged fixed content stays in place; changed state is appended as a complete snapshot after the current input. Drag or use `Alt + ↑ / ↓` to reorder, and drag across zones to change role and placement. More offers zone moves, reset to defaults, and loading options. Zones collapse independently; searching or moving content into a zone expands it.
3. On the "Tools" tab, "Move in" adds a whole plugin to the on-demand tool pack; click a name to pick individual tools. "Move out" restores normal exposure. Sources sort independently.
4. On "Inject", the trash button moves a section to "Exclude"; "Restore" brings it back. Exclusion only flips the enabled flag and keeps role, load strategy, and tool selection.
5. Click "Save". Everything is a draft until saved; saved settings apply to subsequent prompt assembly for all sessions of the profile. In-flight requests are unaffected.

Tool configuration and prompt composition are independent: moving prompts never changes tool selection or plugin ownership.

### On-demand loading on the model side

In a compatible PTC session, the model calls `unwrap` inside `run_code`:

1. `return await tools.unwrap({});` — list the on-demand plugin catalog.
2. `return await tools.unwrap({ plugin: "exact-plugin-id", format: "schema" });` — fetch all visible tool definitions for that plugin. Load one plugin per `run_code` step to avoid truncation.
3. For tools without plugin ownership: `return await tools.unwrap({ tool: "exact-tool-name", format: "schema" });`
4. Call `tools.<name>(...)` normally in later steps.

`format: "schema"` keeps full original parameter and return schemas while dropping repeated SDK type text. Discovery does no keyword search, executes nothing, and expands no permissions: output strictly comes from tools visible to the current caller; conditional admission, validation, approval flows, and sandbox limits are all preserved.

### Plugin descriptions

Click a plugin name to view or edit its description (custom text takes precedence over the built-in one; 1–2000 chars after trim, up to 512 entries). If a plugin has no built-in description, "Generate" asks the current default model to draft one from tool names and descriptions only — no parameter schemas, no conversation content. Generation may incur model costs; results are drafts until you save.

### Usage stats

The settings page shows before/after comparisons for PTC tool-description projection characters (including the `unwrap` tool and catalog overhead; folding only a few short tools can cost more than it saves). Token figures are a rough estimate: character delta ÷ 4, rounded. Actual billing and cache behavior are whatever your provider reports. Prompt composition and unwrap results are not counted.

## Prompt composition (advanced)

With "prompt composition" enabled you can adjust roles, ordering, and load strategies per prompt section; changes apply to subsequent requests. Full composition (including pack descriptions entering real system/user messages) requires an explicit host adaptation: see [host-support](host-support/README.md). The adapter only accepts audited `0.2.2-rc.1` and `0.2.2-rc.3` file shapes and must be reviewed and run manually with a backup; installing from npm does not perform the adaptation. Without it, all known sources and limitation reasons are still shown, but unified composition stays unavailable.

Composition config lives separately in `prompt-composition.json` and is off by default; existing `prompt-order.json` priorities are migrated and the original file kept.

### Automatic updates and cache prefixes

Fixed-body updates append per-source overrides, while state updates append complete superseding snapshots, preserving the previous request prefix. Explicit exclusions and role or placement changes withdraw affected historical copies. Models supporting in-history system updates retain the native incremental path. After updating the plugin, check and apply the host adapter using its existing backup and manifest, then restart DSH and refresh the browser. Actual cache hits depend on provider usage reports.

## Config file

Stored as `tool-discovery.json` in the current profile:

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

- `groups`: plugin IDs folded as whole packs; tools added later are included automatically.
- `tools` / `exclude`: exact tool names to include or exclude; `exclude` wins and such tools always render fully.
- `run_code`, `unwrap`, and `discover_tools` are never folded.
- Legacy `v1`/`v2` configs migrate automatically on read; saves are atomic via a temp file with `0600` permissions; corrupted files raise an error instead of being silently overwritten.

## FAQ

- **All tool sources unrecognized.** `origin-bootstrap` must run before other tool plugins register; hot-loading or refreshing the page cannot recover sources retroactively. Ensure `origin-bootstrap` is in your startup config and restart DSH.
- **When saved settings take effect.** In-flight requests are untouched; subsequent assembly follows the new settings.
- **An excluded tool still renders fully.** Check whether it is in `exclude`, which takes precedence.
- **What description generation sends.** Only plugin names, tool names, and tool descriptions are sent — never conversation history or parameter schemas.

## Security

Settings and generation APIs are protected by host authentication and same-origin policy, with a 64 KiB body limit. The plugin wraps no tool executors and calls no `tools.restrict`; role changes are made only from the authenticated admin UI. Definitions are returned to the current conversation as tool results; nothing is written back to global prompts, and there is no cross-session "unlocked tool pool".

## License

Apache-2.0 ([LICENSE](../../LICENSE)); commercial and non-commercial use, modification, and distribution are permitted. Keep license notices and mark modified files when redistributing.
