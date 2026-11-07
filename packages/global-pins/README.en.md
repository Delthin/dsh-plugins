# Global pins

[中文说明](<README.md>)

Lift DSH’s rendered pinned-conversation rows above the workspace list. These are the same native nodes, retaining the active theme—including Claude Style—along with native typography, spacing, status, hover behavior and menus. No separate conversation-row design is introduced.

## Usage

- Keep using DSH’s native Pin and Unpin actions; no separate favorites list is needed.
- Opening, selection, title reveal, hover cards, status dots and quick actions remain native. The plugin adds no extra row tooltip.
- Each native row appears once, rather than being duplicated at its original location.
- When the native view rebuilds, the adapter binds its replacement nodes. Disabling the plugin restores row placement and preserves pin state.
- Only pinned rows rendered by the current native view can be lifted. Rows hidden by collapsed groups or search follow that view’s visibility; the plugin does not expand groups or change view settings.

## Settings

Open **Plugins → Global pins**, choose **Placement**, and save:

- **Above the workspace list**: an independent pins section with its own scrolling for long lists.
- **Inside the workspace list**: one aggregated group that scrolls with the native list.

The default is Above workspaces. DSH persists accepted changes, applies them immediately and synchronizes other connected pages. Row density belongs to DSH and the active theme. Legacy density values remain accepted but no longer override native styling.

## Installation

Version `0.1.0` is a private development package. From the repository root:

```bash
npm run check -- --package=global-pins
npm run check:pack -- --package=global-pins
```

The archive is written to `.cache/packs/`. Install the generated `.tgz` in the target DSH environment and load its [cordis.patch.yml](<cordis.patch.yml>) through the host’s plugin integration workflow. Service restarts require a separately agreed maintenance window.

## Compatibility and privacy

The declared minimum is `DSH >=0.2.2-rc.1`, with `Node.js >=22.19.0`. The current adapter targets DSH Web `0.2.2-rc.1` and is checked against Claude Style’s date view.

That version has no public native-row rendering API. Through `shell.overlay`, this plugin places its section before `[data-slot="sidebar.workspaces"]` or inside the native scroll area. CSS layout lifts existing `[data-row-key="session:…"]` rows while preserving their React-owned parents: conversation nodes are neither reparented nor cloned. Recheck these DOM integration points after host upgrades or sidebar replacements.

The plugin reads native pin IDs and the layout of displayed rows, not conversation bodies. It does not duplicate status or maintain another pin store. Open, Unpin and other row actions retain their native handlers and host permission checks. Placement persists through DSH configuration.

## License

[Apache-2.0](<LICENSE>), including commercial use. See [NOTICE](<NOTICE>) for attribution.
