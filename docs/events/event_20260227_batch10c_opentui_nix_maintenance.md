# Batch10C Opentui + Nix maintenance sync (rewrite-only)

Date: 2026-02-27
Source: `origin/dev` (`a4ed020a9`, `ab75ef814`)
Target: `cms`

## Scope

- Port low-risk maintenance updates while deferring larger `desktop: publish betas to separate repo` split work.

## Changes

1. `packages/opencode/package.json`
   - Bumped:
     - `@opentui/core` `0.1.79 -> 0.1.81`
     - `@opentui/solid` `0.1.79 -> 0.1.81`
2. `bun.lock`
   - Refreshed lockfile to align updated opentui versions and transitive artifacts.
3. `nix/hashes.json`
   - Synced node_modules hashes to upstream-maintained values.

## Validation

- `bun install` at repo root ✅
- `bun run typecheck` in `packages/opencode` ✅

## Notes

- `ce17f9dd9` (desktop beta separate repo publishing) remains deferred to a dedicated split batch due path/layout divergence (`script/*` vs `scripts/*`, download route structure differences).
