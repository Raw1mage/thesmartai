# Batch8C FC6 Windows Resolver Slice (rewrite-only)

Date: 2026-02-27
Source: `origin/dev`
Target: `cms`

## Scope

- Continued split-port of deferred upstream `fc6e7934b`.
- This slice ports **Windows app path resolution hardening** only.

## Changes

1. `packages/desktop/src-tauri/src/lib.rs`
   - `check_windows_app` now returns real probe result via `resolve_windows_app_path`.
   - Reworked `resolve_windows_app_path` to include:
     - multi-candidate query generation (`app`, `.exe`, normalized variants)
     - hidden `where` probing (`creation_flags`) to avoid console flash
     - `.cmd/.bat` executable target resolution
     - registry fallback (`App Paths`) via `windows-sys::RegGetValueW`
     - environment-variable expansion for registry/cmd-discovered paths
2. `packages/desktop/src-tauri/Cargo.toml`
   - Added `windows-sys` dependency with registry/foundation features for resolver APIs.

## Validation

- `cargo check --manifest-path packages/desktop/src-tauri/Cargo.toml` ✅
- `bun run typecheck` in `packages/desktop` ❌
  - fails on known baseline TS issue: `window.__OPENCODE__.serverPassword` typing mismatch (pre-existing).

## Safety

- No changes to cms core domains: multi-account, rotation3d, `/admin`, provider split.
- Blast radius limited to desktop Windows external-app discovery/open path routing.
