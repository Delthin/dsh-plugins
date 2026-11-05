# @delthin/dsh-feishu-notify

[简体中文](./README.md) | English | [Changelog](./CHANGELOG.md)

Send outbound notifications from the DeepSeek Harness (DSH) host to a designated recipient (direct message or group chat) via a Feishu custom app. Closing the browser does not affect automated alerts. This plugin is outbound-only: it does not receive incoming Feishu messages and does not maintain persistent connections.

- **Package Name**: `@delthin/dsh-feishu-notify`
- **Current Version**: `1.1.0` (`private: true`)
- **Repository Location**: `packages/feishu-notify` subdirectory in the private source repository `Delthin/dsh-plugins`
- **Runtime Requirements**: Node.js >= 22, DSH >= 0.2.1-rc.5 (current verification baseline `0.2.2-rc.1`)
- **License Status**: `UNLICENSED` (to be confirmed)

## Features

### 1. Long-Task Completion Notification (`notify_user`)

The plugin injects a dedicated system prompt instructing the model to generate a concise summary and call `notify_user` upon completing long-running tasks, rather than relying on host-driven per-turn fallbacks or a separate summarization model:

- **Trigger Rule**: When the overall user request takes at least 3 minutes, call `notify_user` once upon completion or wrap-up.
- **Exclusions**: Subtasks, intermediate progress updates, brief Q&A turns, and internal errors do not trigger notifications.
- **Payload Format**: `message` contains a brief work summary; `title` is optional. The mobile message body starts with applicable lines among `✅ Completed`, `❌ Remaining`, and `👉 Action Required` (omitting empty categories), with each item capped at 32 Unicode characters. Profile names, session IDs, and debug prefixes are excluded.
- **Filtering & Receipts**: Sent strictly to the saved recipient while respecting the master switch (`enabled`), quiet hours (`quietHours`), and subagent filtering. Returns an actual `success`, `skipped`, or `failed` receipt.
- **Deduplication & Idempotency Boundaries**: Task duration and boundaries are evaluated by the model from context; the host does not treat "current turn elapsed >= 3 minutes" as overall task completion. The host code blocks concurrent or repeat calls within the same turn after a success and records successful receipts in the session projection (persisting across reloads; failed or skipped attempts do not consume the success slot). However, cross-turn deduplication for the same overall task relies on model adherence to the prompt—there is no persistent cross-turn task ID guaranteeing automatic idempotency.

### 2. Automated Host Event Alerts

The host sends automated notifications only for events requiring user attention and ignores subagents:

- **Supported Events**: Approval requests, user questions, and plan confirmation notifications.
- **Excluded Events**: Normal turn completion (turn-end), session completion (session-end), execution failures, and interruptions do not trigger automated messages, invoke summarization models, or populate delivery logs.
- **Event Deduplication**: Identical events are submitted at most once within a 60-second window, and HTTP retries reuse the same request UUID.

### 3. Status, Configuration, and Test Tool (`feishu_notify`)

The `feishu_notify` tool supports inspection and non-sensitive configuration:

- **Status (`status`)**: Reads current enablement, configuration summary, and recent delivery status without sending a Feishu message.
- **Configuration (`configure`)**: Updates non-secret settings (`App Secret` cannot be read or modified via model tools).
- **Test Message**: Sends a real, fixed test message using saved settings to verify Feishu connectivity, bypassing both `enabled` and `quietHours`.

### 4. Transport & Reliability

- Uses built-in Node.js `fetch` with a 5-second timeout per request (including response body reading).
- Retries network errors and HTTP 5xx responses up to 3 times; Feishu API business errors (`code !== 0`) fail immediately.
- Caches `tenant_access_token` according to the returned TTL and refreshes it ahead of expiry; changing app credentials clears the token cache.

## Installation & Upgrade

This package resides in `packages/feishu-notify` within the private repository `Delthin/dsh-plugins` and has not been published to the public npm registry or the plugin marketplace.

### Source Verification & Packaging

Run dependency installation, checks, and workspace packaging from the repository root:

```sh
npm ci --ignore-scripts
npm run check
npm pack --workspace @delthin/dsh-feishu-notify
```

You can also run syntax and unit tests directly inside the package directory:

```sh
node --check index.js
node --check client.js
node --test core.test.js summary.test.js
```

### Local Host Installation & Upgrade Guidelines

1. **Local Deployment Verification**: Before public release, install the package or apply the local integration patch into an isolated test profile on the DSH host. The plugin registers its routes through the host's existing `webServer` service without opening a new port. Refresh the settings page after installation, and restart DSH when prompted after host module updates.
2. **Upgrading from the Unscoped Package**: While the package name is now `@delthin/dsh-feishu-notify`, internal service IDs, settings page IDs, and the profile configuration filename (`feishu-notify.json`) remain unchanged. When upgrading, replace only the package name and asset paths, never enable both old and new instances simultaneously, and back up your existing `feishu-notify.json` beforehand.
3. **Post-Release Installation** (only applicable after official publication to npm):

```sh
npm i @delthin/dsh-feishu-notify
```

## Configuration

Open **Settings → Feishu Notify** in the DSH Web UI, fill in the fields, save, and enable the plugin. Settings are stored in `feishu-notify.json` under the active profile directory.

| Field | Type | Description | Example (Placeholder) |
| --- | --- | --- | --- |
| `appId` | `string` | Feishu custom app App ID | `cli_a1b2c3d4e5f6g7h8` |
| `App Secret` | `string` | Feishu custom app secret. Entered only via the Settings UI. Displayed as `***` once saved; leaving it unchanged preserves the existing secret | `********************` |
| `receive_id` | `string` | Recipient ID: `ou_` prefix sends a direct message via `open_id`; `oc_` prefix sends to a chat via `chat_id` (can reuse an existing chat ID) | `ou_xxxxxxxxxxxxxxxx` or `oc_xxxxxxxxxxxxxxxx` |
| `enabled` | `boolean` | Master notification switch. Disables regular alerts and `notify_user` summaries when `false`, but does not block manual test messages | `true` |
| `quietHours.start` | `string` | Quiet hours start time (`HH:mm`) | `23:00` |
| `quietHours.end` | `string` | Quiet hours end time (`HH:mm`). Supports overnight ranges; `start == end` means all-day quiet hours | `08:00` |
| `quietHours.timeZone` | `string` | IANA time zone identifier for quiet hours evaluation | `Asia/Shanghai` |

### Feishu Admin Console Checklist

Verify your custom app settings in the official Feishu Open Platform console:

- Bot capability is enabled and messaging permissions are granted and published.
- For `ou_` (`open_id`), the target user is within the app's availability scope; for `oc_` (`chat_id`), the bot has been added to the target group or chat.
- Save any pending changes in the UI before clicking **Send Test Message**. The UI reports success only after the Feishu API responds with `code === 0`, and displays the exact Feishu error code and message on failure.

## Security & Privacy

- **Atomic Credential Storage**: The host writes `feishu-notify.json` in the active profile directory using a same-directory temporary file and atomic rename with `0600` permissions.
- **Secret Isolation**: `App Secret` stays on the local host, is never returned in plaintext by the API, and cannot be read or written by model tools (`notify_user` or `feishu_notify`).
- **No Secrets in Source Control**: Never commit `feishu-notify.json` or profile backups to version control, and never paste real `appId`, secrets, or `receive_id` values into documentation or issue reports.
- **Outbound Data Scope**: Notifications transmit user-authorized task summaries or action prompts to Feishu servers and the configured recipient. Payloads are minimized and exclude credentials, profile paths, and raw sensitive session transcripts.

## Compatibility & Verification Scope

- **Environment Baseline**: Node.js `>= 22` and DSH `>=0.2.1-rc.5 || >=0.2.2-rc.1` (verified against `0.2.2-rc.1`). This version range documents the tested baseline and does not guarantee compatibility against future breaking changes in DSH internal APIs.
- **Automated Test Coverage**: 38 unit tests across `core.test.js` and `summary.test.js` pass, along with syntax checks on `index.js` and `client.js`.
- **Verification Boundaries**: Automated checks do not cover live Feishu API delivery, real browser UI automation, or full host end-to-end tests. Verify live delivery using **Send Test Message** in an isolated test profile.

## FAQ

### Why does "Send Test Message" still deliver a message when the plugin is disabled or in quiet hours?

The test button verifies connectivity and credentials using your saved configuration and intentionally bypasses both `enabled` and `quietHours`. Always save any modified form fields before testing.

### Why didn't the model call `notify_user` after a single turn ran for over 3 minutes?

The 3-minute threshold applies to the overall user task at completion or wrap-up. The host does not automatically send a message simply because a single turn exceeded 3 minutes, and subtasks, intermediate steps, or internal errors do not trigger notifications.

### Is `notify_user` automatically idempotent across multiple turns of the same task?

No. Host code deduplicates concurrent or repeat calls within the same turn and records successful receipts in the session projection, but preventing duplicate notifications across separate turns relies on the model following the injected prompt rather than a persistent cross-turn task ID.

### What happens when `quietHours.start` and `quietHours.end` are set to the same value?

Setting `start == end` (for example, `00:00` to `00:00`) enables all-day quiet hours in the configured `timeZone`, causing regular notifications and `notify_user` calls to return `skipped`.

## Changelog

See [CHANGELOG.md](./CHANGELOG.md) for version history and migration details.

## License

Currently marked as `UNLICENSED` (`private: true`), pending final license confirmation.

Because npm's default semver rules exclude prerelease versions of a different version tuple from standard `>=` ranges, package and DSH `engines.dsh` host ranges with a `>=0.2.1-rc.5` minimum explicitly use `>=0.2.1-rc.5 || >=0.2.2-rc.1`, while entries that already start at `>=0.2.2-rc.1` keep their original range. This ensures resolution across the current RC series and newer stable releases without guaranteeing compatibility with every future RC or API change.
