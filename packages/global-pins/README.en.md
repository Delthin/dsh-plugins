# Global pins

[中文说明](<README.md>)

Show DSH’s existing pinned conversations above all workspaces in the left sidebar. Keep using the native Pin and Unpin actions; no separate favorites list is needed.

## Usage

- Titles and workspace names follow the host’s pinned-ID list, independently of manual or recently-updated ordering inside workspace views. Conversations remain accessible when workspace groups are collapsed.
- Click a title to open the conversation, or use the trailing Unpin button.
- The native workspace browser stays intact, including the original conversation rows.
- An empty list and a collapsed sidebar take no space. Long pin lists scroll separately. Archived, deleted and unavailable summaries are omitted.

## Installation

Version `0.1.0` is a private development package, not published on npm or the marketplace. From the repository root:

```bash
npm run check -- --package=global-pins
npm run check:pack -- --package=global-pins
```

The archive is written to `.cache/packs/`. Install the generated `.tgz` in the target DSH environment and load its [cordis.patch.yml](<cordis.patch.yml>) through the host’s plugin integration workflow. If initial loading requires a service restart, confirm the active tasks and maintenance window first.

No additional settings are needed. Disabling the plugin removes its sidebar section and preserves the host’s pins.

## Compatibility and privacy

The declared minimum is `DSH >=0.2.2-rc.1`, with `Node.js >=22.19.0`. The current adapter targets the DSH Web `0.2.2-rc.1` sidebar.

That version has no dedicated workspace-header extension slot. This plugin registers through `shell.overlay` and inserts its own container before `[data-slot="sidebar.workspaces"]`, leaving the browser untouched. The DOM anchor is a version-dependent integration point and must be checked after host upgrades or sidebar replacements. Without the anchor, the plugin inserts nothing and leaves the native list intact.

Only session summaries, workspace membership and native pin state are read. Open and Unpin use host operations and their permission checks. No conversation bodies, additional server-side storage or duplicate pin database are used.

## FAQ

**Why does a pinned conversation still appear inside its workspace?** Global pins are shortcuts. Native groups are preserved so search, ordering and archiving keep their existing behavior.

**Why is the section missing?** Expand the sidebar and confirm that at least one pinned, unarchived conversation has a loaded summary. After a host upgrade or sidebar replacement, check the adapter anchor.

## License

[Apache-2.0](<LICENSE>), including commercial use. See [NOTICE](<NOTICE>) for attribution.
