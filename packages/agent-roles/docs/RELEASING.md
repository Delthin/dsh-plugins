# Release Guide (`@delthin/dsh-agent-roles`)

This document describes pre-release verification, Changesets versioning, manual publishing, marketplace listing criteria, and rollback rules for `@delthin/dsh-agent-roles` inside the monorepo.

## Current Publication Status

- **Package Name & Version**: `@delthin/dsh-agent-roles` (`0.4.0`), located at `packages/agent-roles`.
- **Private Guard**: `private: true` is currently set in `packages/agent-roles/package.json` to block accidental npm publication.
- **Legacy History**: The former standalone repository ([Legacy Repository](https://github.com/Delthin/dsh-agent-roles)) and its release list ([Legacy Releases](https://github.com/Delthin/dsh-agent-roles/releases)) remain online for historical reference. Old releases are not re-created in the monorepo.
- **No Automatic Publishing**: Repository CI runs `npm run check`, `npm run check:public`, and `npm run check:pack` on Node.js 22 and 24. CI never stores publish tokens and never publishes packages automatically.

## Pre-Release Verification

1. In a clean working tree on the target branch, install dependencies from the monorepo root:
   ```sh
   npm ci --ignore-scripts
   ```
2. Run workspace verification, package tests, privacy checks, and pack allowlist checks:
   ```sh
   npm run check
   npm test --workspace @delthin/dsh-agent-roles
   npm run check:public
   npm run check:pack
   npm run release:check --workspace @delthin/dsh-agent-roles
   ```
3. Inspect `git diff --check` and review all staged changes manually. Automated scripts do not replace manual privacy review: verify that no real role definitions, session transcripts, personal configurations, access tokens, host absolute paths, or screenshots are included. Tests must use fictional data only.
4. Build the package tarball and verify it in an isolated environment:
   ```sh
   npm pack --workspace @delthin/dsh-agent-roles
   ```
   Confirm that the package entry imports cleanly, a fresh data directory starts with an empty role catalog, `skills` and `fastProviders` default to empty arrays (`[]`), `delegationRules` defaults to `[]`, and role management plus native Agent Team member execution work in the target DSH host.

## Versioning and Publishing Workflow

The monorepo uses **Changesets** for independent package versioning rather than running `npm version` and manually editing lockfiles.

1. Record user-facing changes with Changesets and update `packages/agent-roles/CHANGELOG.md`. Ensure compatibility notes accurately distinguish between minimum declared ranges (`Node.js >= 22.18.0` for this package, `Node.js >= 22.19.0` for the monorepo root, `engines.dsh >= 0.2.1-rc.5`) and actual tested environments.
2. Keep `private: true` enabled until the user explicitly approves public release for `@delthin/dsh-agent-roles`.
3. When approved for public release:
   - Confirm npm organization scope (`@delthin`) access and OIDC / 2FA configuration.
   - Remove `"private": true` from `packages/agent-roles/package.json` for the approved package only.
   - Re-run `npm run check`, `npm test --workspace @delthin/dsh-agent-roles`, `npm run check:public`, and `npm run check:pack`.
   - Commit the reviewed release state before tagging.
4. Perform manual release and publication:
   ```sh
   VERSION=0.4.0
   TARBALL="delthin-dsh-agent-roles-${VERSION}.tgz"

   npm pack --workspace @delthin/dsh-agent-roles
   # Verify the exact tarball in an isolated environment before uploading or publishing.

   # After committing the release changes, create and push the package tag:
   git tag -a "@delthin/dsh-agent-roles@${VERSION}" -m "Release @delthin/dsh-agent-roles@${VERSION}"
   git push origin main "@delthin/dsh-agent-roles@${VERSION}"

   # Create a GitHub Release with the verified tarball:
   gh release create "@delthin/dsh-agent-roles@${VERSION}" "${TARBALL}" --verify-tag --title "@delthin/dsh-agent-roles v${VERSION}" --notes-file packages/agent-roles/CHANGELOG.md

   # Publish manually by the authorized account holder (with OIDC / local 2FA):
   npm publish "${TARBALL}" --access public
   ```

GitHub Releases, npm public registry availability, and DSH plugin marketplace listing are separate states and must be verified independently:

- **GitHub Release**: Verify uploaded release assets on GitHub before referencing the release URL.
- **npm Public Package**: After publishing, run `npm view "@delthin/dsh-agent-roles@${VERSION}" dist.integrity` and confirm that the returned integrity digest matches the local `${TARBALL}`. Never claim the scoped package is on npm while `private: true` is set or before `npm view` succeeds.

## DSH Plugin Marketplace

Marketplace indexing is maintained in the `awesome-dsh-plugin` repository and is never triggered automatically by GitHub or npm releases. Before submitting or updating an entry:

- Ensure the source repository is public and carries the `dsh-plugin` topic.
- Wait until the repository meets upstream age and eligibility rules.
- Submit a dedicated plugin entry YAML in the upstream repository without hand-editing its generated `README.md`.
- Confirm upstream PR merge and marketplace refresh before stating that the plugin is available in the marketplace.

## Rollback and Data Safety

Published Git tags, GitHub Release assets, and npm versions must never be overwritten or deleted and re-uploaded in place. If a defect is found after release, fix the issue, increment the version, and publish a new release following the full checklist. To roll back temporarily, install a known-good previous version or tarball.

Always back up `roles.json` and `runs.json` in your local runtime data directory before upgrading or changing data schemas. Neither the source repository nor published tarballs ever contain local runtime data.
