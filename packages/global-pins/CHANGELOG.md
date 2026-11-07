# Changelog

## Unreleased

- Replace bespoke pinned rows with visual reordering of the actual native conversation rows; inherit the active theme, native hover cards, menus, selection and live status.
- Preserve React-owned row parents and rebind when the native workspace view rebuilds; restore layout on disposal.
- Keep Above workspaces and Inside workspace list placement with native configuration persistence and cross-page updates.
- Let DSH and its active theme control row density; accept legacy density values without overriding native appearance.

## 0.1.0

- Add a global pinned-conversation section above all workspace groups.
- Reuse native pin ordering, session summaries and Open/Unpin operations.
- Preserve the native browser and pin state when disabling the plugin.
- Isolate the Web sidebar DOM adapter, including remount and disposal cleanup.

Private development package; not published.
