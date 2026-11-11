# DSH Agent Roles (`@delthin/dsh-agent-roles`)

[中文](README.md) · [Changelog](CHANGELOG.md) · [Releasing Guide](docs/RELEASING.md)

Role management UI for **DeepSeek Harness Web 0.2.2-rc.1+**, built on the native DSH Agent Team APIs to spawn role-based members, delegate tasks, and continue follow-up conversations.

In this plugin, a **Role** is a reusable configuration template that stores a responsibility prompt, model and reasoning effort, tool allowlist, and selected Skills; a **Member** is a concrete runtime instance spawned by the main agent from a role. During a session, the main agent can inspect the responsibilities, models, and selected Skills of all enabled roles, and decides when to call `spawn_role` based on the task at hand without requiring a predefined fixed workflow.

## Repository Migration and Publication Status

This plugin lives under `packages/agent-roles` in the monorepo with its full Git history preserved. The package is named `@delthin/dsh-agent-roles` at version `0.5.0`, configured with `publishConfig.access: "public"` for public npm distribution.

- The former standalone repository and historical releases remain available at [Legacy Repository](https://github.com/Delthin/dsh-agent-roles) and [Legacy Releases](https://github.com/Delthin/dsh-agent-roles/releases); historical GitHub Releases are not migrated or re-created in the monorepo.
- `@delthin/dsh-agent-roles` is published manually to npm by the maintainer and is not currently listed in the plugin marketplace.
- This repository migration does not automatically migrate or modify existing runtime data directories on your host.

## Compatibility and Verification Status

- **Declared Requirements**: The package declares `Node.js >= 22.18.0` (the monorepo root workspace requires `Node.js >= 22.19.0`), `engines.dsh >= 0.2.2-rc.1`, and at least one configured model provider. The underlying Agent Team APIs remain experimental, and minimum version ranges do not guarantee compatibility across all future host API changes.
- **Verification environment**: `Node.js 25.9.0` and `DSH 0.2.2-rc.1`. Tests cover configuration persistence, tool permissions, real native Team lifecycles, and model fallback; packing checks inspect the actual public file allowlist.
- **Live-provider acceptance**: Automated tests use synthetic model adapters. Actual provider quota and error responses require acceptance checks in the corresponding environment.

## Installation

You can install `@delthin/dsh-agent-roles` via npm and import it into your DSH host, or build a local tarball from the monorepo root:

```sh
npm ci --ignore-scripts
npm run check
npm pack --workspace @delthin/dsh-agent-roles
```

To install via npm, run `npm install @delthin/dsh-agent-roles` (or `@delthin/dsh-agent-roles@0.5.0`) and import `@delthin/dsh-agent-roles` in your DSH host profile configuration (such as `cordis.patch.yml`). Local packing produces `delthin-dsh-agent-roles-0.5.0.tgz`, which can be loaded through your DSH host's local package mechanism, profile configuration, or an isolated test environment. Marketplace listing is independent of local packing and npm publication.

Installation requires no build step and runs no install scripts. After loading the plugin, refresh the DSH Web page to find「多智能体」in the left navigation bar; if the host does not reload plugins automatically, restart the corresponding Web profile.

A fresh installation starts with an **empty role catalog** and includes none of the author's roles, prompts, model configurations, or run records; upgrading an existing installation preserves your local data. The plugin bundle enables the native DSH team service, team tools, and UI, while disabling the legacy `tool-subagent`, `tool-subagent-fork`, `tool-subagent-control`, and `tool-subagent-list-agents` entries—matching the official experimental team profile switch. If you already use a custom team bundle, check for configuration overrides sharing the same IDs.

## Configuring Roles and Delegating Tasks

### 1. Create a Role

1. Open「多智能体 → 角色 → 新增角色」in the left sidebar.
2. Fill in the display name, dispatch name (lowercase letters, digits, and hyphens, e.g., `reviewer`), and responsibility description. The main agent uses this description to decide when to invoke the role.
3. Select the model provider, specific model, and reasoning effort for the role.
4. Define the role's responsibilities, working boundaries, and deliverable expectations under「提示词」, and check only the necessary tool allowlist under「工具」.
5. Search and select from DSH-discovered Skills under「技能」as needed (empty by default; the global skills catalog is not inherited automatically).
6. Enable the role and save.

### 2. Task Delegation and Coordination

Once a role is enabled, simply describe your task to the main agent in the main session. For example, after configuring a read-only `reviewer` role, you can ask the main agent:

> Ask reviewer to review these changes and report evidence-backed issues. Summarize the findings and decide how to address them.

Runtime and coordination rules:

- **On-Demand Instance Creation**: The main agent calls `spawn_role({role, name, prompt})` to start a member, which invokes the native `agentTeams.spawnTeammate` under the hood. At startup, the member captures a snapshot of the role's prompt, model settings, and selected Skills content; editing or deleting the role later does not affect existing members.
- **Isolated Sessions and Follow-Ups**: Each new member starts in an independent fresh session without inheriting the main agent's conversation history, so the main agent must include necessary context and materials in the initial `prompt`. For follow-up questions or additional input, the main agent continues communicating with the same member instance via the native `send_message` tool.
- **Centralized Coordination**: A member's tool allowlist never includes recursive delegation tools, and members cannot proactively message one another. The main agent handles all task decomposition, result synthesis, and cross-member coordination using `list_agents`, `send_message`, `interrupt_agent`, and `wait_agent`. Note that `list_agents` queries already-spawned member instances rather than the role catalog.
- **Inspecting Status and Results**: Open the native member session from the subagent/team entry at the top of the main session, or open「多智能体 → 子智能体」to view recent role member records for the current data directory, expand output summaries, or click「会话」to jump to the session. An `inactive` status only indicates that no turn is currently executing—it does not by itself mean the task succeeded. Check the member's output to verify conclusions or errors.
- **Request Verification**: Under a member record's「请求详情」, the plugin logs the actual model, reasoning effort, and tool list from the outgoing request, and verifies that the base DSH system prompt, verbatim role prompt, and selected Skills content were loaded (in `0.2.1-rc.5`, the model field in the native member list may retain the parent session's description; rely on「请求详情」for the actual routing).

### 3. Ordered Model Fallback

Keep the primary model under the role's Basic tab and use Add backup model to configure up to 15 ordered alternatives. Each entry has its own provider, model, reasoning effort, and Standard / Fast tier, with move-up, move-down, and remove controls.

- **Quota exhausted**: advance directly to the next entry when the provider reports exhausted quota.
- **Model request errors**: retry the current model three times after 1, 2, and 4 seconds, then advance; each model receives at most four attempts. Exhausting the chain ends the execution with the final error retained.
- **Continuity**: keep the same member, native session history, and committed tool results. Cancellation or interruption stops pending waits and further fallback.
- **Snapshots and evidence**: freeze the full chain at member startup, enforce delegation restrictions for alternatives, and show the active model and transition history in the member list. Existing roles without alternatives keep their single-model behavior.

Fallback requires the public model-selection and inbox APIs in `DSH >=0.2.2-rc.1`. The policy handles host-normalized model request failures. Exceptions thrown directly by preparation, prompt plugins, tool execution, or persistence terminate the execution.

The primary selection stays at the top level; the ordered `fallbacks` array uses the same `provider`, `model`, `reasoningEffort`, and `fast` fields. Fast still requires a compatible host transport adapter.

### 4. Skills Loading and Communication Overhead

New and existing roles default to `skills: []`. When Skills are checked, the plugin reads them via the native DSH skills service at member startup and injects the full content into the new member's system prompt using the native `<skill_content>` format (preserving the resource base directory and literal body). Even a zero-tool role can receive instructions from selected Skills.

Skills provide text instructions only and do not grant tool permissions. External commands, software, or dependencies required by a Skill must still be configured in the host environment and tool allowlist. If a selected Skill is unavailable at startup, member creation fails immediately and reports the missing Skill name; restore the Skill or uncheck it to retry.

Delegating tasks, processing returned results, and sending follow-ups incur additional model input/output usage across the main agent and members as they handle their respective turns, and the full text of all selected Skills is included in the member session's input. Select only the Skills a role genuinely needs, and let the main agent handle simple, straightforward tasks directly rather than splitting them across multiple agents.

## Data Storage and Configuration

The default data directory is `$DSH_HOME/agent-roles` (or `~/.dsh/agent-roles` when `DSH_HOME` is unset):

- `roles.json`: Stores the role catalog, schema version, and catalog revision.
- `runs.json`: Stores member startup snapshots, selected Skills bodies, request verification results, and up to 30,000 characters of recent output summary. Full conversation histories remain stored by the native DSH session store.

To customize the data directory or enable optional provider Fast toggles, configure `cordis.patch.yml` in your active profile:

```yaml
- id: agent-roles
  config:
    dataDir: ~/my-dsh-data/agent-roles
    fastProviders: []
```

`dataDir` accepts absolute paths, `~`, and paths relative to the current process working directory (an absolute path is recommended). The file store does not provide cross-process write locking; separate DSH processes must use different `dataDir` locations.

The public package defaults to `fastProviders: []`; the Fast button beside the model selector remains disabled. This plugin only records the Fast/standard selection in role and member snapshots and does not bundle provider-specific priority transport implementations. Add a provider ID to `fastProviders` only if you have an adapter installed that reads the role startup snapshot. Enabling priority transport may change provider billing rates.

### Restricting Delegated Models

In **Multi-agent → Settings**, add a rule, choose the lead model, select blocked member models, and save to apply it. Options come from configured DSH models. The default is `delegationRules: []` (unrestricted delegation). Changes use the native DSH configuration service with conflict detection; if the host environment does not provide the `configEditor` service, the settings UI and API operate in read-only mode.

You may also set the generic `delegationRules` option directly using your own model IDs:

```yaml
- id: agent-roles
  config:
    delegationRules:
      - leaderModel: lead-model-id
        denyModels:
          - blocked-member-model-id
```

Model IDs are matched exactly across providers. Rules use the lead’s current request model and follow model switches on the next turn. Blocked roles are omitted from its directory and rejected before launch. Restricted leads must use `spawn_role`; generic delegation tools are blocked, as are messages to existing blocked-model members. Already-running members are not automatically interrupted.

## Runtime Limits and Security Boundaries

- **Native Quotas and Delegation Depth**: A team supports up to 32 created members and 256 shared tasks. Concurrency and delegation depth remain governed by native DSH subagent settings; if the host delegation depth is set to `0`, delegation must first be enabled in the host configuration. This plugin does not elevate global quotas or system permissions.
- **Hook Mechanism and API Authentication**: Using the native `agent/created` hook, the plugin installs model routing, system prompt injection, and tool allowlist guards before a member's first request is sent, without running a custom model loop. The role management API relies on the DSH Web connection service for authentication, rejects unauthenticated requests, and enforces a `1 MiB` limit on JSON POST request bodies.
- **Permissions and Trust Boundaries**: A role's tool allowlist constrains which tools the model may call; it is not an OS-level file or directory sandbox. File access and command execution remain governed by DSH global permissions and file policies. Configured role prompts and Skills are trusted local text instructions provided to the model, while the installed plugin itself executes with host process privileges. Do not expose an authenticated DSH Web session to untrusted users.
- **Data Lifecycle**: Member snapshots in `runs.json` contain prompts, full Skill texts, and output summaries—protect backups as private data. Uninstalling the plugin does not remove the data directory, and deleting a role does not delete existing member run records. Run records do not expire automatically; the list API returns up to the 200 most recent entries for the data directory.

## FAQ

- **Does installing or upgrading include any preset roles from the author?**
  No. Neither the repository nor the packaged tarball includes real roles, prompts, or session records. Fresh installations always start with an empty catalog, while upgrades or switches to `@delthin/dsh-agent-roles` preserve existing data in the configured `dataDir`.
- **Why is Multi-agent → Settings read-only or unable to save?**
  Saving delegation rules from the UI requires the host's `configEditor` service. When `configEditor` is unavailable, the UI displays active rules in read-only mode; edit `cordis.patch.yml` directly instead.
- **Why is the Fast toggle next to the model selector disabled?**
  `fastProviders` defaults to `[]`. The toggle is only enabled for providers explicitly listed in `fastProviders` when paired with a compatible priority transport adapter.


## Development and Verification

From the monorepo root:

```sh
npm ci --ignore-scripts
npm run check
npm test --workspace @delthin/dsh-agent-roles
npm run check:public
npm run check:pack
```

Both server and client ship plain JavaScript directly without a build step. The client UI uses the React runtime and native UI controls bundled with DSH Web. The test suite uses fictional roles and mock models and makes no calls to paid model APIs.

See the [Releasing Guide](docs/RELEASING.md) for pre-release checks, Changesets versioning, privacy checks, and marketplace listing steps. When reporting issues, include your DSH version, plugin version, and sanitized error logs; never upload private role data, access tokens, or full session transcripts.

## License

Starting with `0.4.1`, this package is licensed under the [Apache-2.0](./LICENSE) open-source license (see also root [LICENSE](../../LICENSE)), Copyright © 2026 Delthin. Commercial and noncommercial use, modification, and distribution are permitted without requiring a separate paid commercial license or forcing derivative works as a whole to be open-sourced, provided that copyright and license notices are retained, modified files are marked, and the patent terms in [LICENSE](./LICENSE) are followed. Prior MIT grants for historical releases `<= 0.4.0` are not revoked, and the legacy notice is retained in [LICENSE-MIT-legacy](./LICENSE-MIT-legacy).

The host and DSH runtime dependencies use the minimum-supported range `>=0.2.2-rc.1`; development dependencies pin `0.2.2-rc.1` for reproducible verification. Review experimental Agent Team API changes when upgrading the host.
