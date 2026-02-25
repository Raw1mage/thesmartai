# Refactor Plan: 2026-02-25 (origin/dev → aaf8317c8, origin_dev_delta_20260225_mcp_round)

Date: 2026-02-25
Status: WAITING_APPROVAL

## Summary

- Upstream pending (raw): 75 commits
- Excluded by processed ledger: 0 commits
- Commits for this round: 75 commits

## Actions

| Commit | Logical Type | Value Score | Risk | Decision | Notes |
| :----- | :----------- | :---------- | :--- | :------- | :---- |
| `eb64ce08b` | infra | 1/0/0/1=2 | low | integrated | Update VOUCHED list |
| `a74fedd23` | behavioral-fix | 1/1/0/0=2 | medium | integrated | fix(desktop): change detection on Windows, especially Cygwin (#13659) |
| `faa63227a` | infra | 1/0/0/1=2 | low | integrated | chore: generate |
| `a4ed020a9` | feature | 1/0/0/1=2 | low | integrated | upgrade opentui to v0.1.81 (#14605) |
| `ab75ef814` | infra | 1/0/0/1=2 | low | integrated | chore: update nix node_modules hashes |
| `0042a0705` | behavioral-fix | 1/1/0/0=2 | medium | integrated | fix: Windows path support and canonicalization (#13671) |
| `ee754c46f` | behavioral-fix | 1/1/0/0=2 | medium | integrated | fix(win32): normalize paths at permission boundaries (#14738) |
| `5712cff5c` | feature | 1/0/0/1=2 | low | integrated | zen: track session in usage |
| `5596775c3` | feature | 1/0/0/1=2 | low | integrated | zen: display session in usage |
| `a5a70fa05` | feature | 1/0/0/1=2 | low | integrated | wip: zen lite |
| `d3ecc5a0d` | infra | 1/0/0/1=2 | low | integrated | chore: generate |
| `9f4fc5b72` | feature | 1/0/0/0=1 | medium | skipped | Revert "fix(app): terminal issues" |
| `8e9644796` | behavioral-fix | 1/1/0/1=3 | low | integrated | fix(app): correct inverted chevron direction in todo list (#14628) |
| `3b5b21a91` | behavioral-fix | 1/1/0/1=3 | low | integrated | fix(app): duplicate markdown |
| `8f2d8dd47` | behavioral-fix | 1/1/0/1=3 | low | integrated | fix(app): duplicate markdown |
| `24c63914b` | infra | 1/0/0/1=2 | low | integrated | fix: update workflows for better automation (#14809) |
| `ad5f0816a` | behavioral-fix | 1/1/0/1=3 | low | integrated | fix(cicd): flakey typecheck (#14828) |
| `34495a70d` | behavioral-fix | 1/1/1/1=4 | low | integrated | fix(win32): scripts/turbo commands would not run (#14829) |
| `284251ad6` | feature | 1/0/0/1=2 | low | integrated | zen: display BYOK cost |
| `0a9119691` | behavioral-fix | 1/1/0/1=3 | low | integrated | fix(win32): e2e sometimes fails because windows is weird and sometimes ipv6 (#14833) |
| `0269f39a1` | infra | 1/0/0/1=2 | low | integrated | ci: add Windows to unit test matrix (#14836) |
| `ae190038f` | infra | 1/0/0/1=2 | low | integrated | ci: use bun baseline build to avoid segfaults (#14839) |
| `cf5cfb48c` | feature | 1/0/0/1=2 | low | integrated | upgrade to bun 1.3.10 canary and force baseline builds always (#14843) |
| `eda71373b` | feature | 1/0/0/1=2 | low | integrated | app: wait for loadFile before opening file tab |
| `cda2af258` | feature | 1/0/0/1=2 | low | integrated | wip: zen lite |
| `fb6d201ee` | feature | 1/0/0/1=2 | low | integrated | wip: zen lite |
| `744059a00` | infra | 1/0/0/1=2 | low | integrated | chore: generate |
| `a592bd968` | behavioral-fix | 1/1/0/1=3 | low | integrated | fix: update createOpenReviewFile test to match new call order (#14881) |
| `de796d9a0` | behavioral-fix | 1/1/0/1=3 | low | integrated | fix(test): use path.join for cross-platform glob test assertions (#14837) |
| `3201a7d34` | behavioral-fix | 1/1/0/1=3 | low | integrated | fix(win32): add bun prefix to console app build scripts (#14884) |
| `659068942` | behavioral-fix | 1/1/0/0=2 | medium | integrated | fix(win32): handle CRLF line endings in markdown frontmatter parsing (#14886) |
| `13cabae29` | behavioral-fix | 1/1/0/0=2 | medium | integrated | fix(win32): add git flags for snapshot operations and fix tests for cross-platform (#14890) |
| `888b12338` | feature | 1/0/0/0=1 | medium | skipped | feat: ACP - stream bash output and synthetic pending events (#14079) |
| `ef7f222d8` | infra | 1/0/0/1=2 | low | integrated | chore: generate |
| `79254c102` | behavioral-fix | 1/1/0/1=3 | low | integrated | fix(test): normalize git excludesFile path for Windows (#14893) |
| `a292eddeb` | behavioral-fix | 1/1/0/0=2 | medium | integrated | fix(test): harden preload cleanup against Windows EBUSY (#14895) |
| `1af3e9e55` | behavioral-fix | 1/1/0/0=2 | medium | integrated | fix(win32): fix plugin resolution with createRequire fallback (#14898) |
| `1a0639e5b` | behavioral-fix | 1/1/0/0=2 | medium | integrated | fix(win32): normalize backslash paths in config rel() and file ignore (#14903) |
| `06f25c78f` | behavioral-fix | 1/1/0/1=3 | low | integrated | fix(test): use path.sep in discovery test for cross-platform path matching (#14905) |
| `3d379c20c` | behavioral-fix | 1/1/0/1=3 | low | integrated | fix(test): replace Unix-only assumptions with cross-platform alternatives (#14906) |
| `36197f5ff` | behavioral-fix | 1/1/0/0=2 | medium | integrated | fix(win32): add 50ms tolerance for NTFS mtime fuzziness in FileTime assert (#14907) |
| `32417774c` | behavioral-fix | 1/1/0/1=3 | low | integrated | fix(test): replace structuredClone with spread for process.env (#14908) |
| `e27d3d5d4` | behavioral-fix | 1/1/0/1=3 | low | integrated | fix(app): remove filetree tooltips |
| `2cee94767` | behavioral-fix | 1/1/0/0=2 | medium | integrated | fix: ACP both live and load share synthetic pending status preceeding… (#14916) |
| `082f0cc12` | behavioral-fix | 1/1/0/1=3 | low | integrated | fix(app): preserve native path separators in file path helpers (#14912) |
| `c92913e96` | infra | 1/0/0/1=2 | low | integrated | chore: cleanup |
| `519058963` | feature | 1/0/0/1=2 | low | integrated | zen: remove alpha models from models endpoint |
| `cc02476ea` | feature | 1/0/0/1=2 | low | integrated | refactor: replace error handling with serverErrorMessage utility and checks for if error is ConfigInvalidError (#14685) |
| `0d0d0578e` | infra | 1/0/0/1=2 | low | integrated | chore: generate |
| `c6d8e7624` | behavioral-fix | 1/1/0/1=3 | low | integrated | fix(app): on cancel comment unhighlight lines (#14103) |
| `f8cfb697b` | feature | 1/0/0/1=2 | low | integrated | zen: restrict alpha models to admin workspaces |
| `68cf011fd` | behavioral-fix | 1/1/0/1=3 | low | integrated | fix(app): ignore stale part deltas |
| `2a87860c0` | docs | -1/-1/-1/1=-2 | low | skipped | zen: gpt 5.3 codex |
| `2c00eb60b` | feature | 1/0/0/0=1 | medium | skipped | feat(core): add workspace-serve command (experimental) (#14960) |
| `29ddd5508` | feature | 1/0/0/1=2 | low | integrated | release: v1.2.11 |
| `3af12c53c` | behavioral-fix | 1/1/0/0=2 | medium | integrated | fix(opencode): import custom tools via file URL (#14971) |
| `e71826377` | behavioral-fix | 1/1/0/0=2 | medium | integrated | fix(project): await git id cache write (#14977) |
| `da40ab7b3` | behavioral-fix | 1/1/0/0=2 | medium | integrated | fix(opencode): disable config bun cache in CI (#14985) |
| `814c1d398` | ux | 0/0/0/-1=-1 | high | skipped | refactor: migrate Bun.spawn to Process utility with timeout and cleanup (#14448) |
| `fa559b038` | feature | 1/0/0/0=1 | medium | skipped | core: temporarily disable plan enter tool to prevent unintended mode switches during task execution |
| `637059a51` | ux | 0/0/0/-1=-1 | high | skipped | feat: show LSP errors for apply_patch tool (#14715) |
| `a487f11a3` | infra | 1/0/1/1=3 | low | integrated | ci: auto-resolve merge conflicts in beta sync using opencode |
| `0b3fb5d46` | infra | 1/0/1/1=3 | low | integrated | ci: specify opencode/kimi-k2.5 model in beta script to ensure consistent PR processing |
| `6af7ddf03` | infra | 1/0/1/1=3 | low | integrated | ci: switch beta script to gpt-5.3-codex for improved code generation quality |
| `76b60f377` | docs | -1/-1/-1/1=-2 | low | skipped | desktop: make readme more accurate |
| `6fc550629` | feature | 1/0/0/1=2 | low | integrated | zen: go |
| `d00d98d56` | feature | 1/0/0/1=2 | low | integrated | wip: zen go |
| `1172ebe69` | feature | 1/0/0/1=2 | low | integrated | wip: zen go |
| `5d5f2cfee` | feature | 1/0/0/1=2 | low | integrated | wip: zen go |
| `d7500b25b` | feature | 1/0/0/1=2 | low | integrated | zen: go |
| `fc6e7934b` | feature | 1/0/0/1=2 | low | integrated | feat(desktop): enhance Windows app resolution and UI loading states (#13320) |
| `3c6c74457` | feature | 1/0/0/0=1 | medium | skipped | sync |
| `561f9f5f0` | ux | 0/0/0/-1=-1 | high | skipped | opencode go copy |
| `d848c9b6a` | feature | 1/0/0/1=2 | low | integrated | release: v1.2.13 |
| `088a81c11` | protocol | 1/0/0/0=1 | medium | ported | fix: consume stdout concurrently with process exit in auth login (#15058) - ported in cms auth flow |

## Execution Queue

1. [ ] Confirm high-risk items (ported vs skipped).
2. [ ] Integrate low/medium-risk high-value items.
3. [ ] Update ledger with final status mapping.

## Mapping to Ledger

| Upstream Commit | Status | Local Commit | Note |
| :-------------- | :----- | :----------- | :--- |
| `eb64ce08b` | integrated | - | Update VOUCHED list |
| `a74fedd23` | integrated | - | fix(desktop): change detection on Windows, especially Cygwin (#13659) |
| `faa63227a` | integrated | - | chore: generate |
| `a4ed020a9` | integrated | - | upgrade opentui to v0.1.81 (#14605) |
| `ab75ef814` | integrated | - | chore: update nix node_modules hashes |
| `0042a0705` | integrated | - | fix: Windows path support and canonicalization (#13671) |
| `ee754c46f` | integrated | - | fix(win32): normalize paths at permission boundaries (#14738) |
| `5712cff5c` | integrated | - | zen: track session in usage |
| `5596775c3` | integrated | - | zen: display session in usage |
| `a5a70fa05` | integrated | - | wip: zen lite |
| `d3ecc5a0d` | integrated | - | chore: generate |
| `9f4fc5b72` | skipped | - | Revert "fix(app): terminal issues" |
| `8e9644796` | integrated | - | fix(app): correct inverted chevron direction in todo list (#14628) |
| `3b5b21a91` | integrated | - | fix(app): duplicate markdown |
| `8f2d8dd47` | integrated | - | fix(app): duplicate markdown |
| `24c63914b` | integrated | - | fix: update workflows for better automation (#14809) |
| `ad5f0816a` | integrated | - | fix(cicd): flakey typecheck (#14828) |
| `34495a70d` | integrated | - | fix(win32): scripts/turbo commands would not run (#14829) |
| `284251ad6` | integrated | - | zen: display BYOK cost |
| `0a9119691` | integrated | - | fix(win32): e2e sometimes fails because windows is weird and sometimes ipv6 (#14833) |
| `0269f39a1` | integrated | - | ci: add Windows to unit test matrix (#14836) |
| `ae190038f` | integrated | - | ci: use bun baseline build to avoid segfaults (#14839) |
| `cf5cfb48c` | integrated | - | upgrade to bun 1.3.10 canary and force baseline builds always (#14843) |
| `eda71373b` | integrated | - | app: wait for loadFile before opening file tab |
| `cda2af258` | integrated | - | wip: zen lite |
| `fb6d201ee` | integrated | - | wip: zen lite |
| `744059a00` | integrated | - | chore: generate |
| `a592bd968` | integrated | - | fix: update createOpenReviewFile test to match new call order (#14881) |
| `de796d9a0` | integrated | - | fix(test): use path.join for cross-platform glob test assertions (#14837) |
| `3201a7d34` | integrated | - | fix(win32): add bun prefix to console app build scripts (#14884) |
| `659068942` | integrated | - | fix(win32): handle CRLF line endings in markdown frontmatter parsing (#14886) |
| `13cabae29` | integrated | - | fix(win32): add git flags for snapshot operations and fix tests for cross-platform (#14890) |
| `888b12338` | skipped | - | feat: ACP - stream bash output and synthetic pending events (#14079) |
| `ef7f222d8` | integrated | - | chore: generate |
| `79254c102` | integrated | - | fix(test): normalize git excludesFile path for Windows (#14893) |
| `a292eddeb` | integrated | - | fix(test): harden preload cleanup against Windows EBUSY (#14895) |
| `1af3e9e55` | integrated | - | fix(win32): fix plugin resolution with createRequire fallback (#14898) |
| `1a0639e5b` | integrated | - | fix(win32): normalize backslash paths in config rel() and file ignore (#14903) |
| `06f25c78f` | integrated | - | fix(test): use path.sep in discovery test for cross-platform path matching (#14905) |
| `3d379c20c` | integrated | - | fix(test): replace Unix-only assumptions with cross-platform alternatives (#14906) |
| `36197f5ff` | integrated | - | fix(win32): add 50ms tolerance for NTFS mtime fuzziness in FileTime assert (#14907) |
| `32417774c` | integrated | - | fix(test): replace structuredClone with spread for process.env (#14908) |
| `e27d3d5d4` | integrated | - | fix(app): remove filetree tooltips |
| `2cee94767` | integrated | - | fix: ACP both live and load share synthetic pending status preceeding… (#14916) |
| `082f0cc12` | integrated | - | fix(app): preserve native path separators in file path helpers (#14912) |
| `c92913e96` | integrated | - | chore: cleanup |
| `519058963` | integrated | - | zen: remove alpha models from models endpoint |
| `cc02476ea` | integrated | - | refactor: replace error handling with serverErrorMessage utility and checks for if error is ConfigInvalidError (#14685) |
| `0d0d0578e` | integrated | - | chore: generate |
| `c6d8e7624` | integrated | - | fix(app): on cancel comment unhighlight lines (#14103) |
| `f8cfb697b` | integrated | - | zen: restrict alpha models to admin workspaces |
| `68cf011fd` | integrated | - | fix(app): ignore stale part deltas |
| `2a87860c0` | skipped | - | zen: gpt 5.3 codex |
| `2c00eb60b` | skipped | - | feat(core): add workspace-serve command (experimental) (#14960) |
| `29ddd5508` | integrated | - | release: v1.2.11 |
| `3af12c53c` | integrated | - | fix(opencode): import custom tools via file URL (#14971) |
| `e71826377` | integrated | - | fix(project): await git id cache write (#14977) |
| `da40ab7b3` | integrated | - | fix(opencode): disable config bun cache in CI (#14985) |
| `814c1d398` | skipped | - | refactor: migrate Bun.spawn to Process utility with timeout and cleanup (#14448) |
| `fa559b038` | skipped | - | core: temporarily disable plan enter tool to prevent unintended mode switches during task execution |
| `637059a51` | skipped | - | feat: show LSP errors for apply_patch tool (#14715) |
| `a487f11a3` | integrated | - | ci: auto-resolve merge conflicts in beta sync using opencode |
| `0b3fb5d46` | integrated | - | ci: specify opencode/kimi-k2.5 model in beta script to ensure consistent PR processing |
| `6af7ddf03` | integrated | - | ci: switch beta script to gpt-5.3-codex for improved code generation quality |
| `76b60f377` | skipped | - | desktop: make readme more accurate |
| `6fc550629` | integrated | - | zen: go |
| `d00d98d56` | integrated | - | wip: zen go |
| `1172ebe69` | integrated | - | wip: zen go |
| `5d5f2cfee` | integrated | - | wip: zen go |
| `d7500b25b` | integrated | - | zen: go |
| `fc6e7934b` | integrated | - | feat(desktop): enhance Windows app resolution and UI loading states (#13320) |
| `3c6c74457` | skipped | - | sync |
| `561f9f5f0` | skipped | - | opencode go copy |
| `d848c9b6a` | integrated | - | release: v1.2.13 |
| `088a81c11` | ported | - | fix: consume stdout concurrently with process exit in auth login (#15058) - ported in cms auth flow |
