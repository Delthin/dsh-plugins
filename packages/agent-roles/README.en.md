# DSH Agent Roles (`@delthin/dsh-agent-roles`)

[![npm](https://img.shields.io/npm/v/%40delthin%2Fdsh-agent-roles?style=flat-square)](https://www.npmjs.com/package/@delthin/dsh-agent-roles)
[![Node](https://img.shields.io/node/v/%40delthin%2Fdsh-agent-roles?style=flat-square)](https://www.npmjs.com/package/@delthin/dsh-agent-roles)
[![DSH](https://img.shields.io/badge/DSH-%E2%89%A50.2.2--rc.3-6366F1?style=flat-square)](https://dshmarket.com/)
[![license](https://img.shields.io/badge/license-Apache--2.0-8A2BE2?style=flat-square)](https://www.apache.org/licenses/LICENSE-2.0)
[![LINUX DO](https://img.shields.io/badge/LINUX%20DO-%E7%A4%BE%E5%8C%BA-FFB000?style=flat-square)](https://linux.do/)

[中文](README.md) · [Changelog](CHANGELOG.md) · [Marketplace](https://dshmarket.com/zh/p/Delthin/dsh-plugins--packages-agent-roles/)

Role management on top of the native DSH `>= 0.2.2-rc.3` Agent Team. A **role** is a reusable template holding a responsibility prompt, model and reasoning effort, tool whitelist, and skills; a **member** is a running instance the lead agent starts from a role. The lead sees all enabled roles and decides when to spawn members based on the task.

First install ships an **empty role catalog** — no author presets. Upgrades keep your local data. The original standalone repo and its releases remain at [the old repository](https://github.com/Delthin/dsh-agent-roles) and [old releases](https://github.com/Delthin/dsh-agent-roles/releases).

## Installation

```bash
npm install @delthin/dsh-agent-roles
```

No scripts, no build step. Import and enable it via your host (e.g. `cordis.patch.yml`), refresh the web page, and an "Agents" entry appears in the left navigation; restart the web profile if it does not load. The plugin reuses the native team services, tools, and UI provided by the DSH base / Web profile. The lead delegates roles through `spawn_role`. When delegation restrictions apply, execution guards block generic `subagent` / `subagent_fork` calls. Native discovery, messaging, and waiting tools follow the active preset. Custom profiles must enable the host's native Agent Team first.

Version `0.6.1` and later require DSH `>= 0.2.2-rc.3`. For DSH `0.2.2-rc.1`, install the compatible release: `npm install @delthin/dsh-agent-roles@0.5.1`.

## Configuring roles

1. "Agents → Roles → New": set a display name, dispatch name (lowercase letters, digits, hyphens), and a responsibility description the lead agent uses to decide when to pick this role.
2. Choose a provider, model, and reasoning effort; optionally build an ordered fallback chain below (up to 15 entries).
3. Write the prompt; check the tool whitelist; optionally pick skills (empty by default).
4. Enable and save.

With roles enabled, just describe tasks in your main session, e.g.:

> Please hand this change to reviewer for a review focused on evidence-backed issues; summarize and decide what to do.

The lead calls `spawn_role`; members run in fresh, independent sessions with no inherited context, so include the necessary background in the dispatch prompt. Follow-ups go through `send_message` to the same member. Members cannot message each other; the lead coordinates everything. Member records, output summaries, and session links live under "Agents → Members".

Members capture a snapshot of the role prompt, model settings, and skill texts at startup; later role edits don't affect running members. "Request details" records the actual model, effort, and tool list, and verifies that system prompt, role prompt, and skills loaded in full.

## Model fallback chain

Each fallback entry picks its own provider, model, reasoning effort, and standard/Fast tier, applied in order:

- **Quota exhausted**: switch to the next entry immediately.
- **Other request errors**: retry at 1 / 2 / 4 seconds (3 retries), then switch; at most 4 requests per model.
- Switching keeps the same member and native session history, including submitted tool results; if the whole chain fails, the last error is kept and the run ends.
- The chain is frozen at startup; later role edits only affect new members. Roles without fallbacks keep single-model behavior. The member list shows the current model and switch history.
- Cancelling or interrupting a member stops waiting and any further switching; it is treated as a cancellation, not a model-error switch.

Fallback relies on the public model-selection and inbox APIs of DSH `>= 0.2.2-rc.3` and applies to host-normalized model request failures; exceptions thrown during preparation or tool execution end the run directly.

## Skills and tool boundaries

Selected skills are read through the native skill service at startup and injected into the member's system prompt as `<skill_content>`. Skills are text instructions only — they grant no tool permissions; commands and dependencies a skill needs must be configured in the host and the tool whitelist separately. A missing skill fails startup with its name reported.

The tool whitelist constrains which tools the model may call; file and command execution remains governed by DSH's global permissions and file policies — the two are configured separately.

## Usage costs

Both the lead and members generate model input/output as they handle tasks, results, and follow-ups, and the full text of selected skills counts toward member input. Check only the skills a role actually needs; for simple tasks, let the lead handle them directly instead of splitting into multi-agent work.

## Data and configuration

Default data dir: `$DSH_HOME/agent-roles` (`~/.dsh/agent-roles` if unset):

- `roles.json` holds the catalog; `runs.json` holds member snapshots, request checks, and recent output summaries (full conversations live in native session storage).
- Snapshots include prompt and skill texts — treat backups as sensitive. Uninstalling or deleting roles does not erase existing run records.
- Multiple independent DSH processes should use different `dataDir` values (no cross-process write lock).

Customize via the profile's `cordis.patch.yml` (model IDs below are example placeholders — replace them with real IDs from your environment):

```yaml
- id: agent-roles
  config:
    dataDir: ~/my-dsh-data/agent-roles
    fastProviders: []
    delegationRules:
      - leaderModel: lead-model-id # example placeholder, replace with a real ID
        denyModels:
          - blocked-member-model-id # example placeholder, replace with a real ID
```

- **Fast**: `fastProviders` defaults to `[]`, so the Fast toggle is unavailable. The plugin only records the choice and ships no priority transport; add a provider ID only when the matching transport adapter is installed — priority transport may change provider billing.
- **Delegation rules**: `delegationRules` blocks denied member models based on the lead's current model (exact match, provider-agnostic), effective immediately on save; configurable in "Agents → Settings", which is read-only when the host lacks the `configEditor` service.
- **Live configuration**: Updating `fastProviders` or `delegationRules` preserves active members and retries; new launches and model switches read the updated policy. Changing `dataDir` reloads the plugin. The run list and persisted records share the native status projection, and Fast can query the active model tier directly.

## Limits

Shared-task limits follow the host's native `agent-team` configuration; member execution, concurrency, and delegation depth follow native subagent configuration. Role APIs reuse DSH web authentication with a 1 MiB body limit. Do not expose a logged-in DSH web session to untrusted users.

## FAQ

- **Author presets and existing data.** First install is an empty catalog with no author presets; upgrades keep your data.
- **Read-only settings page.** Saving delegation rules online requires the host `configEditor` service; otherwise edit `cordis.patch.yml` directly.
- **Fast toggle unavailable.** `fastProviders` is empty by default; configure provider IDs with a priority transport adapter first.

## Development

From the monorepo root: `npm ci --ignore-scripts`, `npm run check`, `npm run check:public`, `npm run check:pack`. No build step; tests use fictional roles and mock models. See the [releasing guide](docs/RELEASING.md). When reporting issues, include DSH and plugin versions plus sanitized logs — never upload private role configs or session data.

## License

Apache-2.0 ([LICENSE](./LICENSE)) from `0.4.1` onward; commercial and non-commercial use, modification, and distribution are permitted — keep notices and mark modified files. Previously published versions `<= 0.4.0` keep their granted MIT license, preserved in [LICENSE-MIT-legacy](./LICENSE-MIT-legacy).
