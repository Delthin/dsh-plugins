# Changelog

## 0.6.0

### Minor Changes

- Use the native Agent Team supplied by DSH 0.2.2-rc.2 and later instead of installing the retired experimental packages. Migrate role dispatch, continuation and frozen-policy restoration to the native subagent lifecycle while preserving ordered model fallback. This fixes rc.2 plugin-manager compatibility rejection; DSH 0.2.2-rc.1 users can keep agent-roles 0.5.1.

## 0.5.1

### Patch Changes

- Keep delegation settings live without interrupting current members or fallback retries. Consolidate run-state persistence, expose live role-tier state, preserve published fallback APIs, and add bilingual locale metadata.

## 0.5.0

### Minor Changes

- Add per-role ordered fallback models with independent provider, reasoning effort and Standard / Fast settings, plus add/reorder/remove controls.

  Recover from quota exhaustion by switching models immediately; bound other model retries to 1/2/4-second backoff before advancing, while retaining the member session and committed tool results.

  Snapshot the full chain, enforce model delegation restrictions, and record active selections and fallback history. Require DSH >=0.2.2-rc.1 for the public model-selection and inbox APIs.

## Unreleased

## 0.4.1 — 2026-11-05

- Prepare `@delthin/dsh-agent-roles` (`0.4.1`) for public npm release (`publishConfig.access: "public"`, `private` removed from the subpackage while the monorepo root remains `private: true`).
- Migrate package into the monorepo under `packages/agent-roles` with full Git history preserved, and update repository metadata, workspace verification commands, and release documentation.
- Change license to `Apache-2.0` ([LICENSE](./LICENSE), root [LICENSE](../../LICENSE)) for `0.4.1` and later; prior MIT grants for `<= 0.4.0` are not revoked and remain preserved in [LICENSE-MIT-legacy](./LICENSE-MIT-legacy).
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
