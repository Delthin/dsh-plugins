# Delthin DSH Plugins

[![tool-wrap](https://img.shields.io/npm/v/%40delthin%2Fdsh-tool-wrap?style=flat-square&label=tool-wrap)](https://www.npmjs.com/package/@delthin/dsh-tool-wrap)
[![agent-roles](https://img.shields.io/npm/v/%40delthin%2Fdsh-agent-roles?style=flat-square&label=agent-roles)](https://www.npmjs.com/package/@delthin/dsh-agent-roles)
[![license](https://img.shields.io/badge/license-Apache--2.0-8A2BE2?style=flat-square)](https://www.apache.org/licenses/LICENSE-2.0)
[![LINUX DO](https://img.shields.io/badge/LINUX%20DO-%E7%A4%BE%E5%8C%BA-FFB000?style=flat-square)](https://linux.do/)

A home for six DeepSeek Harness (DSH) plugins. Each plugin is developed, versioned, and installed on its own. Language: [中文](./README.md) | [Releasing & marketplace guide](./docs/releasing.md) | [Package handling notes](./docs/package-handoff.md)

## Plugins

| Plugin | Purpose |
| :--- | :--- |
| [`feishu-notify`](./packages/feishu-notify/README.en.md) | Feishu notifications and task-completion reminders |
| [`agent-roles`](./packages/agent-roles/README.en.md) | Reusable sub-agent roles on the native Agent Team |
| [`fast`](./packages/fast/README.en.md) | Standard / Fast tier and model reasoning-effort controls |
| [`tool-wrap`](./packages/tool-wrap/README.en.md) | On-demand folding of plugin tools and prompts |
| [`global-pins`](./packages/global-pins/README.en.md) | Globally pinned conversations |
| [`cardex`](./packages/cardex/README.en.md) | Turn sessions into knowledge cards, trees, and graphs via `/cardex` |

See each package for configuration details and changelogs.

## Installation

Pick what you need:

```bash
npm install @delthin/dsh-feishu-notify
npm install @delthin/dsh-agent-roles
npm install @delthin/dsh-fast
npm install @delthin/dsh-tool-wrap
npm install @delthin/dsh-global-pins
npm install @delthin/dsh-cardex
```

`agent-roles` 0.6.0 and later use the native Agent Team in DSH 0.2.2-rc.2. On DSH 0.2.2-rc.1, install `@delthin/dsh-agent-roles@0.5.1`.

See each plugin's README for loading and configuration entry points. Restart DSH after first install or upgrades.

## Notes

- `fast` forwards the raw `Authorization` header to the configured target gateway; only point it at fully trusted endpoints. The `priority` tier may bill at higher rates.
- `feishu-notify` stores the `AppSecret` only via the web UI, written with `0600` permissions; never commit it.
- `tool-wrap` is off by default and only applies to PTC sessions; auto-generating plugin descriptions calls the current default model and may incur costs.

## Development

Plain JavaScript source, no build step. Requires `Node.js >= 22.19.0` and `npm >= 11.5.1`. Before publishing, run from the repo root:

```bash
npm ci --ignore-scripts
npm run check          # per-package syntax, tests, manifest, locale checks
npm run check:public   # public/privacy boundary scan
npm run check:pack     # pack and isolated-install verification
```

Never commit runtime profiles, logs, secrets, or `.tgz` artifacts.

## License

Current versions use Apache-2.0 ([LICENSE](./LICENSE)); commercial use is permitted. Keep license notices and mark modifications when redistributing. Historical licenses are preserved for [agent-roles](./packages/agent-roles/LICENSE-MIT-legacy) and [Fast](./packages/fast/LICENSE-MIT-legacy).
