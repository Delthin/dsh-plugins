# @delthin/dsh-fast

[中文说明](<./README.md>) | [Changelog](<./CHANGELOG.md>)

`@delthin/dsh-fast` is a session service-tier toggle and request forwarding plugin for DeepSeek Harness (DSH) (current version `0.1.3`, license `PolyForm-Noncommercial-1.0.0`). It enables switching between `Standard` and `Fast` tiers within the current session and, when fully configured, attaches `service_tier: "priority"` to targeted Responses requests and forwards them to an administrator-configured target endpoint.

> **Important Notice**: The `Fast` tier only sets `service_tier: "priority"` and forwards matching requests to the configured target endpoint. **It is not a promise of model performance or generation speed.** Whether the upstream provider supports this parameter, delivers faster responses, or applies different billing depends entirely on the upstream service and must be verified by the administrator. This plugin does not guarantee acceleration or lower costs.

## Features

- **Session Tier Switching**: Switch the active session between `Standard` and `Fast` tiers while preserving existing model selector choices and reasoning effort levels.
- **Slash Commands**: Control or inspect the current session tier with `/fast on`, `/fast off`, `/fast toggle`, and `/fast status`.
- **Locked Role Snapshot Tier**: Role or subagent runs read their service tier from the startup snapshot and lock it for the duration of the run. The plugin accesses the role runs file (`roleRunsPath`) in read-only mode and never creates or migrates it; regular sessions work normally when this option is unset or the file is absent.
- **Conditional Request Forwarding**: When `provider`, `sourceURL`, and `targetURL` are all provided and valid, a local loopback proxy is created to inject `service_tier: "priority"` into matching Responses requests and forward them to `targetURL`.
- **Safe Fallback & Pre-flight Rejection**: `provider`, `sourceURL`, and `targetURL` default to empty. If any of the three is missing, Fast forwarding is not activated and no local proxy is created, while `Standard` mode continues to work normally. Attempting a downstream request in `Fast` mode without all three fields configured will be rejected before transmission with a missing-configuration notice. If all three fields are populated but contain invalid URLs, initialization fails immediately.
- **In-Memory Receipts**: Tracks forwarding receipts in memory for at most 1,000 sessions without persisting sensitive payloads to disk.

## Installation

Its source lives in the `packages/fast` workspace directory and is configured with `publishConfig.access: "public"` for npm distribution. Install it with `npm i @delthin/dsh-fast` (or `@delthin/dsh-fast@0.1.3`) and import `@delthin/dsh-fast` in your DSH host configuration (such as `cordis.patch.yml`). Marketplace listing is independent of npm publication.

### Build and Pack from Source

Run the following commands from the repository root to install dependencies, run checks, and produce a local tarball:

```bash
npm ci --ignore-scripts
npm run check
npm pack --workspace @delthin/dsh-fast
```

Load the resulting tarball or configure a local patch entry using the host mechanisms supported by DSH inside an **isolated test profile**.

### npm Installation

Once published to npm, the package can be installed via a package manager:

```bash
npm i @delthin/dsh-fast
```

## Configuration

Enable the plugin in your DSH configuration using a patch entry. The `REPLACE_WITH_SOURCE_HTTP_ENDPOINT` and `REPLACE_WITH_TRUSTED_TARGET_HTTP_ENDPOINT` placeholders and the provider ID below must be replaced with real `HTTP(S)` URLs and your actual provider ID; the configuration cannot be run as-is:

```yaml
- insert:
  - id: fast
    name: "@delthin/dsh-fast"
    config:
      provider: "my-responses-provider"
      sourceURL: "REPLACE_WITH_SOURCE_HTTP_ENDPOINT"
      targetURL: "REPLACE_WITH_TRUSTED_TARGET_HTTP_ENDPOINT"
      # Optional: read-only path to the agent role runs file
      # roleRunsPath: "./agent-roles/runs.json"
```

### Configuration Options

| Field | Type | Default | Requirement | Description & Constraints |
| :--- | :--- | :--- | :--- | :--- |
| `provider` | `string` | `""` | Required for Fast forwarding | Must match an existing provider adapter ID configured in DSH. |
| `sourceURL` | `string` | `""` | Required for Fast forwarding | Source Responses endpoint URL to match (must replace the `REPLACE_WITH_SOURCE_HTTP_ENDPOINT` placeholder with a real `HTTP(S)` URL; cannot be run as-is). |
| `targetURL` | `string` | `""` | Required for Fast forwarding | Target endpoint URL where `Fast` requests are forwarded (must replace the `REPLACE_WITH_TRUSTED_TARGET_HTTP_ENDPOINT` placeholder with a real `HTTP(S)` URL trusted by the administrator; cannot be run as-is). |
| `roleRunsPath` | `string` | None | Optional | Path to the role runs snapshot file. **Note: Relative paths are resolved against the DSH service process working directory (`cwd`), NOT the package directory.** Accessed read-only; regular sessions work normally when omitted or when the file does not exist. |

### Activation Rules

1. **Inactive by Default**: `provider`, `sourceURL`, and `targetURL` default to empty. If any of them is omitted, the plugin does not start a local proxy, and `Standard` sessions operate normally.
2. **Pre-flight Rejection when Unconfigured**: If a session is switched to `Fast` while any of the three fields is missing, requests are rejected before being sent downstream with a prompt indicating missing configuration.
3. **Strict URL Validation**: When all three fields are provided, `sourceURL` and `targetURL` are validated during initialization. Unreplaced placeholders, invalid URL syntax, embedded credentials (`username:password`), or URL fragments (`#...`) cause plugin initialization to fail.

## Security Considerations

- **Credential Ownership & Protection**: Authorization headers from the original request are preserved when forwarding to `targetURL`, while credentials remain managed by the original DSH provider adapter. **Never hardcode API keys or secrets into the plugin configuration or YAML patch examples.**
- **Trusted Target Only**: Because upstream authorization headers are forwarded intact, `targetURL` **must be an endpoint explicitly trusted by the administrator**.
- **URL Constraints**: Embedded credentials and URL fragments are strictly forbidden in `sourceURL` and `targetURL`. Both HTTP and HTTPS are supported, but **HTTPS is strongly recommended in production**.
- **Local Proxy Isolation**: When enabled, the local forwarding proxy binds exclusively to the loopback interface, authenticates internal hops with a random runtime token, and **does not follow upstream redirects** to prevent credential leakage across redirect hops. No proxy is created when Fast forwarding is unconfigured.

## Compatibility, Upgrade & Migration

### Runtime & Dependency Requirements

- **Node.js**: `>= 22.19.0`
- **DeepSeek Harness (DSH)**: `>=0.2.1-rc.5 || >=0.2.2-rc.1`
- **Peer / Framework Ranges**: `@deepseek-ai/schemastery >= 3.18.5`, `@deepseek-ai/cordis >= 4.0.5`
- **Runtime Dependencies**: `undici` (`7.30.1`), `zod` (`4.6.7`)

> **Verification Status**: Point verification has been completed on `Node.js 25.9.0`, `@deepseek-ai/cordis 4.1.0`, and `@deepseek-ai/schemastery 3.19.0` with all 29 automated tests passing. Clean installation testing on the minimum declared versions (such as Node 22.19.0), live browser UI testing, and end-to-end testing against a live upstream provider have **not** been performed in this verification pass. Dependency ranges allow compatible updates but do not guarantee future API compatibility across breaking upstream changes.

### Upgrading from Unscoped `dsh-fast` to `@delthin/dsh-fast`

This release renames the local package `dsh-fast` to the scoped package `@delthin/dsh-fast`:

1. **Preserved Internal Identifiers**: Only the module `name` in your DSH plugin configuration needs to be updated to `@delthin/dsh-fast`. The internal plugin ID (`fast`), client/locale ID (`dsh-fast`), HTTP route prefix (`/api/fast`), persistence storage domain (`dsh_fast`, version `1`, `sessions` table), and configuration keys remain unchanged.
2. **No Automatic Data Migration**: No automatic migration script is executed. Session tier records remain managed by the DSH host under the `dsh_fast` storage domain, and the role runs file remains read-only without automatic creation or migration.
3. **Explicitly Populate the Three Forwarding Fields**: If your previous setup relied on personal local defaults for `provider`, `sourceURL`, or `targetURL`, you must explicitly specify all three fields in your configuration; otherwise, Fast forwarding will remain inactive.
4. **Upgrade Precautions**: Back up your DSH configuration and profile data before upgrading. Replace the old plugin entry rather than running both `dsh-fast` and `@delthin/dsh-fast` simultaneously.

## FAQ

**Q1: Why isn't generation noticeably faster after running `/fast on`, or how does it affect billing?**
A: `Fast` mode only injects `service_tier: "priority"` and forwards matching requests to `targetURL`. Actual latency and billing depend on whether and how your upstream provider handles priority-tier requests on that endpoint. Please verify support and pricing with your provider.

**Q2: Can I load the plugin without setting `provider`, `sourceURL`, and `targetURL`?**
A: Yes. `Standard` mode works normally and no local proxy is started. However, switching a session to `Fast` and sending a request will be rejected before leaving the host until all three fields are configured.

**Q3: Why can't the plugin find the file configured in `roleRunsPath`?**
A: Relative paths in `roleRunsPath` are resolved relative to the **DSH service process working directory (`cwd`)**, not the `packages/fast` directory. Verify the working directory from which the DSH service is launched.

## Changelog

See [CHANGELOG.md](<./CHANGELOG.md>) for release history and migration notes.

## License

Starting with `0.1.3`, this package is licensed under [PolyForm-Noncommercial-1.0.0](./LICENSE) (a source-available license, not an OSI-approved open-source license; see also root [LICENSE](../../LICENSE)), Copyright © 2026 Delthin. As defined in the license, noncommercial uses—including personal study, evaluation, and organizational uses expressly permitted as noncommercial by the license terms—are allowed rather than prohibiting all organizational use outright; any commercial use requires separate written permission from the copyright holder. Prior MIT grants for historical releases `<= 0.1.2` (including `0.1.2` on npm) are not revoked, and the legacy MIT notice is retained in [LICENSE-MIT-legacy](./LICENSE-MIT-legacy).

Because npm's default semver rules exclude prerelease versions of a different version tuple from standard `>=` ranges, package and DSH `engines.dsh` host ranges with a `>=0.2.1-rc.5` minimum explicitly use `>=0.2.1-rc.5 || >=0.2.2-rc.1`, while entries that already start at `>=0.2.2-rc.1` keep their original range. This ensures resolution across the current RC series and newer stable releases without guaranteeing compatibility with every future RC or API change.
