# Delthin DSH Plugins

[简体中文](README.md)

One repository for source, CI, and version records. Each DSH plugin is installed and versioned independently; there is no combined plugin.

## Status

This repository currently contains the workspace skeleton only. Plugin source has not been migrated. The npm names below are planned, not published; scope ownership still needs verification. No new marketplace listing is claimed.

| Plugin | Directory | Planned npm package |
| --- | --- | --- |
| Feishu work notifications | packages/feishu-notify | @delthin/dsh-feishu-notify |
| Native agent roles | packages/agent-roles | @delthin/dsh-agent-roles |
| Fast request handling | packages/fast | @delthin/dsh-fast |
| Tool wrapping and discovery (formerly dsh-tool-discovery) | packages/tool-wrap | @delthin/dsh-tool-wrap |

Existing agent-roles releases remain available from the [original repository](https://github.com/Delthin/dsh-agent-roles) and its [v0.4.0 release](https://github.com/Delthin/dsh-agent-roles/releases/tag/v0.4.0). Keep that entry point until migration is complete.

## Development

Use Node 22.19+ or Node 24, and npm 11.5.1+.

~~~sh
npm ci --ignore-scripts
npm run check
~~~

CI currently checks the skeleton. After migration it runs each package's check and test scripts. Package tarballs, isolated installation, real DSH APIs, and publication safety still require validation. DSH support ranges must use verified minimum versions, not exact host pins.

[Package handoff (Chinese)](docs/package-handoff.md) · [Migration and publishing (Chinese)](docs/releasing.md)

## License

Verify source provenance and preserve each package's license. Agent roles already uses MIT; licenses for other packages remain to be confirmed. The private root workspace is not published and no repository-wide license is granted at this stage.
