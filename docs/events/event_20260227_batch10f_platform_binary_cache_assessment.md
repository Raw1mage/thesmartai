# Batch10F Platform binary cache assessment (rewrite-only decision)

Date: 2026-02-27
Source: `origin/dev` (`c79f1a72d`, `1ffed2fa6`, `1d9f05e4f`)
Target: `cms`

## Scope

- Evaluate upstream add/revert/re-add sequence for postinstall platform-binary caching.

## Assessment

Upstream sequence:

1. `c79f1a72d` adds cached binary execution and postinstall hardlink/copy setup.
2. `1ffed2fa6` reverts the caching logic.
3. `1d9f05e4f` re-enables caching with final path fixes.

Current cms state already has equivalent final behavior in root-layout paths:

- `bin/opencode` checks and executes cached `bin/.opencode` first.
- `script/postinstall.mjs` creates/refreshes cached binary (`linkSync` fallback to `copyFileSync`) and sets executable bit.

Given repo layout differences (`bin/` + `script/` at root vs upstream `packages/opencode/*`), current implementation is functionally aligned with the upstream final intent.

## Decision

- Mark `c79f1a72d` and `1d9f05e4f` as **integrated**.
- Mark intermediate revert `1ffed2fa6` as **skipped** (superseded by final re-enable).

## Validation

- Static code-path inspection of `bin/opencode` and `script/postinstall.mjs`.
- No additional code changes required in this batch.
