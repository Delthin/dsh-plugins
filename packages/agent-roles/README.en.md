# DSH Agent Roles (`@delthin/dsh-agent-roles`)

[中文](README.md) · [Changelog](CHANGELOG.md) · [Releasing Guide](docs/RELEASING.md)

Role management UI for **DeepSeek Harness Web 0.2.1-rc.5+**, built on the native DSH Agent Team APIs to spawn role-based members, delegate tasks, and continue follow-up conversations.

In this plugin, a **Role** is a reusable configuration template that stores a responsibility prompt, model and reasoning effort, tool allowlist, and selected Skills; a **Member** is a concrete runtime instance spawned by the main agent from a role. During a session, the main agent can inspect the responsibilities, models, and selected Skills of all enabled roles, and decides when to call `spawn_role` based on the task at hand without requiring a predefined fixed workflow.

## Repository Migration and Publication Status

This plugin now lives under `packages/agent-roles` in the monorepo with its full Git history preserved. The package has been renamed from `dsh-agent-roles` to `@delthin/dsh-agent-roles` at version `0.4.0`, with `private: true` set to pause public npm publishing.

- The former standalone repository and historical releases remain available at [Legacy Repository](https://github.com/Delthin/dsh-agent-roles) and [Legacy Releases](https://github.com/Delthin/dsh-agent-roles/releases); historical GitHub Releases are not migrated or re-created in the monorepo.
- `@delthin/dsh-agent-roles` has not been published to npm and is not listed in the plugin marketplace.
- This repository migration does not automatically migrate or modify existing runtime data directories on your host.

## Compatibility and Verification Status

- **Declared Requirements**: The package declares `Node.js >= 22.18.0` (the monorepo root workspace requires `Node.js >= 22.19.0`), `engines.dsh >= 0.2.1-rc.5`, and at least one configured model provider. The underlying Agent Team APIs remain experimental, and minimum version ranges do not guarantee compatibility across all future host API changes.
- **Verified**: All 28 unit tests (0 skipped) and `npm pack` file allowlist checks pass under `Node.js 25.9.0` with `DSH 0.2.2-rc.1`.
- **Pending Verification**: Clean-install verification on the minimum declared host version (`0.2.1-rc.5`) and end-to-end browser UI / live model acceptance runs have not yet been recorded.

## Installation

Because `@delthin/dsh-agent-roles` is currently marked `private: true`, build a local tarball from the monorepo root:

```sh
npm ci --ignore-scripts
npm run check
npm pack --workspace @delthin/dsh-agent-roles
```

This produces `delthin-dsh-agent-roles-0.4.0.tgz`. Load the tarball or workspace package through the local package mechanism or profile configuration (`cordis.patch.yml`) supported by your DSH host, or stage it in an isolated test environment. Once `private: true` is removed and the scoped package is published to npm, you will be able to install `@delthin/dsh-agent-roles@0.4.0` through your host's standard package installation flow. Marketplace listing is independent of local packing and npm publication.

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

### 3. Skills Loading and Communication Overhead

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

[MIT](LICENSE), Copyright © 2026 Delthin.

Because npm's default semver rules exclude prerelease versions of a different version tuple from standard `>=` ranges, package and DSH `engines.dsh` host ranges with a `>=0.2.1-rc.5` minimum explicitly use `>=0.2.1-rc.5 || >=0.2.2-rc.1`, while entries that already start at `>=0.2.2-rc.1` keep their original range. This ensures resolution across the current RC series and newer stable releases without guaranteeing compatibility with every future RC or API change.
