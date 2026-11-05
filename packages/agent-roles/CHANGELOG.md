# Changelog

## Unreleased

- Migrate package into the monorepo under `packages/agent-roles` with full Git history preserved.
- Rename package to `@delthin/dsh-agent-roles` (`0.4.0`) and set `private: true` while public npm publishing is paused.
- Update repository metadata, workspace verification commands, and release documentation for the monorepo workflow.
- Retain links to the legacy standalone repository ([Legacy Repository](https://github.com/Delthin/dsh-agent-roles)) and historical releases ([Legacy Releases](https://github.com/Delthin/dsh-agent-roles/releases)).

## 0.4.0 — 2026-11-05

- Add configurable model delegation rules with a native settings UI, conflict-safe profile persistence, and enforcement for new and existing members. Fresh installations remain unrestricted.
- Use minimum supported versions instead of exact host and DSH dependency pins.
- Support the DSH 0.2.2-rc.1 native model selection and tool executor APIs while retaining the 0.2.1-rc.5 integration.
- Place Standard / Fast controls beside the role model selector and preserve immutable member launch tiers. Priority transport still requires an external adapter.
- Expand runtime and delegation regression coverage and update Chinese/English usage and release documentation.

Compatibility: DSH Web >=0.2.1-rc.5; verified with 0.2.2-rc.1.

## 0.3.0 — 2026-11-04

First public release.

- Native DSH Agent Team role dispatch and background member sessions.
- Sidebar role editor with configured models, reasoning effort, tools and Skills.
- Skills are unassigned by default and loaded from immutable launch snapshots.
- Request evidence for actual models, system/role prompts, tools and skill bodies.
- Portable data directory, empty first-install catalog and explicit package allowlist.
- Chinese and English documentation, MIT license and release checks.
- Optional external Fast transport integration is disabled by default.

Compatibility: DSH Web 0.2.1-rc.5. Earlier 0.1/0.2 versions were local development builds and were not published.
