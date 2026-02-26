# Refactor Plan: 2026-02-26 (origin/dev → cms, origin_dev_delta_20260227_round67)

Date: 2026-02-26
Status: WAITING_APPROVAL

## Summary

- Upstream pending (raw): 593 commits
- Excluded by processed ledger: 506 commits
- Commits for this round: 87 commits

## Policy Guardrails

- Execution mode: rewrite-only refactor-port.
- Forbidden: `git cherry-pick`, `git merge`, or direct upstream patch transplant.
- Allowed: analyze behavior intent, then re-implement on cms architecture and validate.

## Actions

| Commit | Logical Type | Value Score | Risk | Decision | Notes |
| :----- | :----------- | :---------- | :--- | :------- | :---- |
| `1a329ba47` | ux | 0/0/0/-1=-1 | high | skipped | fix: issue from structuredClone addition by using unwrap (#14359) |
| `1eb6caa3c` | feature | 1/0/0/1=2 | low | ported | release: v1.2.9 |
| `04a634a80` | feature | 1/0/0/1=2 | low | ported | test: merge test files into a single file (#14366) |
| `443214871` | feature | 1/0/0/1=2 | low | ported | sdk: build to dist/ instead of dist/src (#14383) |
| `296250f1b` | feature | 1/0/0/1=2 | low | ported | release: v1.2.10 |
| `7e0e35af3` | docs | -1/-1/-1/1=-2 | low | skipped | chore: update agent |
| `7419ebc87` | feature | 1/0/0/0=1 | medium | skipped | feat: add list sessions for all sessions (experimental) (#14038) |
| `7867ba441` | infra | 1/0/0/1=2 | low | ported | chore: generate |
| `92ab4217c` | feature | 1/0/0/1=2 | low | ported | desktop: bring back -i in sidecar arguments |
| `ce17f9dd9` | feature | 1/0/1/1=3 | low | ported | desktop: publish betas to separate repo (#14376) |
| `c79f1a72d` | feature | 1/0/0/1=2 | low | ported | cache platform binary in postinstall for faster startup (#14396) |
| `1ffed2fa6` | feature | 1/0/0/1=2 | low | skipped | Revert "cache platform binary in postinstall for faster startup" (#14457) |
| `2a904ec56` | feature | 1/0/0/1=2 | low | ported | feat(app): show/hide reasoning summaries |
| `1e48d7fe8` | feature | 1/0/0/1=2 | low | ported | zen: gpt safety_identifier |
| `fe89bedfc` | feature | 1/0/0/1=2 | low | ported | wip(app): custom scroll view |
| `c09d3dd5a` | infra | 1/0/0/1=2 | low | ported | chore: cleanup |
| `1d9f05e4f` | feature | 1/0/0/1=2 | low | ported | cache platform binary in postinstall for faster startup (#14467) |
| `950df3de1` | infra | 1/0/0/1=2 | low | ported | ci: temporarily disable assigning of issues to rekram1-node (#14486) |
| `58ad4359d` | infra | 1/0/0/1=2 | low | ported | chore: cleanup |
| `5a1aca918` | docs | -1/-1/-1/1=-2 | low | skipped | docs: add Bangla README translation (#14331) |
| `d0ce2950e` | docs | -1/-1/-1/1=-2 | low | skipped | chore: generate |
| `e77b2cfd6` | feature | 1/0/0/1=2 | low | ported | wip: zen lite |
| `b75a27d43` | infra | 1/0/0/1=2 | low | ported | chore: cleanup |
| `6d58d899f` | behavioral-fix | 1/1/0/1=3 | low | ported | fix: e2e test outdated |
| `206d81e02` | feature | 1/0/0/1=2 | low | ported | desktop: beta icon |
| `c45ab712d` | docs | -1/-1/-1/1=-2 | low | skipped | chore: locale specific glossaries |
| `dbf2c4586` | docs | 1/-1/-1/1=0 | low | skipped | chore: updated locale glossaries and docs sync workflow |
| `a41c81dcd` | docs | -1/-1/-1/1=-2 | low | skipped | docs(ko): improve wording in gitlab, ide, index, keybinds, and lsp docs (#14517) |
| `13616e345` | infra | 1/0/0/1=2 | low | ported | Update VOUCHED list |
| `b16f7b426` | docs | -1/-1/-1/1=-2 | low | skipped | docs(tui): correct typo in TUI documentation (#14604) |
| `aaf8317c8` | feature | 1/0/0/1=2 | low | ported | feat(app): feed customization options |
| `eb64ce08b` | infra | 1/0/0/1=2 | low | ported | Update VOUCHED list |
| `faa63227a` | infra | 1/0/0/1=2 | low | ported | chore: generate |
| `a4ed020a9` | feature | 1/0/0/1=2 | low | ported | upgrade opentui to v0.1.81 (#14605) |
| `ab75ef814` | infra | 1/0/0/1=2 | low | ported | chore: update nix node_modules hashes |
| `5712cff5c` | feature | 1/0/0/1=2 | low | ported | zen: track session in usage |
| `5596775c3` | feature | 1/0/0/1=2 | low | ported | zen: display session in usage |
| `a5a70fa05` | feature | 1/0/0/1=2 | low | ported | wip: zen lite |
| `d3ecc5a0d` | infra | 1/0/0/1=2 | low | ported | chore: generate |
| `24c63914b` | infra | 1/0/0/1=2 | low | ported | fix: update workflows for better automation (#14809) |
| `34495a70d` | behavioral-fix | 1/1/1/1=4 | low | ported | fix(win32): scripts/turbo commands would not run (#14829) |
| `284251ad6` | feature | 1/0/0/1=2 | low | ported | zen: display BYOK cost |
| `0269f39a1` | infra | 1/0/0/1=2 | low | ported | ci: add Windows to unit test matrix (#14836) |
| `ae190038f` | infra | 1/0/0/1=2 | low | ported | ci: use bun baseline build to avoid segfaults (#14839) |
| `cf5cfb48c` | feature | 1/0/0/1=2 | low | ported | upgrade to bun 1.3.10 canary and force baseline builds always (#14843) |
| `cda2af258` | feature | 1/0/0/1=2 | low | ported | wip: zen lite |
| `fb6d201ee` | feature | 1/0/0/1=2 | low | ported | wip: zen lite |
| `744059a00` | infra | 1/0/0/1=2 | low | ported | chore: generate |
| `3201a7d34` | behavioral-fix | 1/1/0/1=3 | low | ported | fix(win32): add bun prefix to console app build scripts (#14884) |
| `888b12338` | feature | 1/0/0/0=1 | medium | skipped | feat: ACP - stream bash output and synthetic pending events (#14079) |
| `ef7f222d8` | infra | 1/0/0/1=2 | low | ported | chore: generate |
| `c92913e96` | infra | 1/0/0/1=2 | low | ported | chore: cleanup |
| `519058963` | feature | 1/0/0/1=2 | low | ported | zen: remove alpha models from models endpoint |
| `f8cfb697b` | feature | 1/0/0/1=2 | low | ported | zen: restrict alpha models to admin workspaces |
| `2a87860c0` | docs | -1/-1/-1/1=-2 | low | skipped | zen: gpt 5.3 codex |
| `2c00eb60b` | feature | 1/0/0/0=1 | medium | skipped | feat(core): add workspace-serve command (experimental) (#14960) |
| `29ddd5508` | feature | 1/0/0/1=2 | low | ported | release: v1.2.11 |
| `814c1d398` | ux | 0/0/0/-1=-1 | high | skipped | refactor: migrate Bun.spawn to Process utility with timeout and cleanup (#14448) |
| `fa559b038` | feature | 1/0/0/0=1 | medium | skipped | core: temporarily disable plan enter tool to prevent unintended mode switches during task execution |
| `a487f11a3` | infra | 1/0/1/1=3 | low | ported | ci: auto-resolve merge conflicts in beta sync using opencode |
| `0b3fb5d46` | infra | 1/0/1/1=3 | low | ported | ci: specify opencode/kimi-k2.5 model in beta script to ensure consistent PR processing |
| `6af7ddf03` | infra | 1/0/1/1=3 | low | ported | ci: switch beta script to gpt-5.3-codex for improved code generation quality |
| `76b60f377` | docs | -1/-1/-1/1=-2 | low | skipped | desktop: make readme more accurate |
| `6fc550629` | feature | 1/0/0/1=2 | low | ported | zen: go |
| `d00d98d56` | feature | 1/0/0/1=2 | low | ported | wip: zen go |
| `1172ebe69` | feature | 1/0/0/1=2 | low | ported | wip: zen go |
| `5d5f2cfee` | feature | 1/0/0/1=2 | low | ported | wip: zen go |
| `d7500b25b` | feature | 1/0/0/1=2 | low | ported | zen: go |
| `fc6e7934b` | feature | 1/0/0/1=2 | low | ported | feat(desktop): enhance Windows app resolution and UI loading states (#13320) |
| `3c6c74457` | feature | 1/0/0/0=1 | medium | skipped | sync |
| `561f9f5f0` | ux | 0/0/0/-1=-1 | high | skipped | opencode go copy |
| `d848c9b6a` | feature | 1/0/0/1=2 | low | ported | release: v1.2.13 |
| `de2bc2567` | feature | 1/0/0/1=2 | low | ported | release: v1.2.14 |
| `5e5823ed8` | infra | 1/0/0/1=2 | low | ported | chore: generate |
| `e48c1ccf0` | infra | 1/0/0/1=2 | low | ported | chore(workflows): label vouched users and restrict vouch managers (#15075) |
| `b368181ac` | infra | 1/0/0/1=2 | low | ported | chore: move glossary |
| `1172fa418` | feature | 1/0/0/1=2 | low | ported | wip: zen go |
| `9d29d692c` | ux | 0/0/0/-1=-1 | high | skipped | split tui/server config (#13968) |
| `4551282a4` | infra | 1/0/0/1=2 | low | ported | chore: generate |
| `444178e07` | docs | -1/-1/-1/1=-2 | low | skipped | fix(docs): update schema URL in share configuration examples across multiple languages (#15114) |
| `c4ea11fef` | feature | 1/0/0/1=2 | low | ported | wip: zen |
| `799b2623c` | feature | 1/0/0/1=2 | low | ported | release: v1.2.15 |
| `6b021658a` | behavioral-fix | 1/1/0/1=3 | low | ported | fix(app): open in powershell (#15112) |
| `7453e78b3` | ux | 0/0/0/-1=-1 | high | skipped | feat: opencode go provider list (#15203) |
| `96ca0de3b` | feature | 1/0/0/1=2 | low | ported | wip: zen |
| `08f056d41` | docs | -1/-1/-1/1=-2 | low | skipped | docs: Sync zh_CN docs with English Version (#15228) |
| `5745ee87b` | ux | 1/0/0/1=2 | low | ported | refactor(desktop): enhance project tile interaction with suppress hover functionality (#15214) |

## Execution Queue

1. [ ] Confirm high-risk items (ported vs skipped).
2. [ ] Refactor-port selected items by behavior reimplementation (no cherry-pick/merge).
3. [ ] Update ledger with final status mapping.

## Mapping to Ledger

| Upstream Commit | Status | Local Commit | Note |
| :-------------- | :----- | :----------- | :--- |
| `1a329ba47` | skipped | - | fix: issue from structuredClone addition by using unwrap (#14359) |
| `1eb6caa3c` | ported | - | release: v1.2.9 |
| `04a634a80` | ported | - | test: merge test files into a single file (#14366) |
| `443214871` | ported | - | sdk: build to dist/ instead of dist/src (#14383) |
| `296250f1b` | ported | - | release: v1.2.10 |
| `7e0e35af3` | skipped | - | chore: update agent |
| `7419ebc87` | skipped | - | feat: add list sessions for all sessions (experimental) (#14038) |
| `7867ba441` | ported | - | chore: generate |
| `92ab4217c` | ported | - | desktop: bring back -i in sidecar arguments |
| `ce17f9dd9` | ported | - | desktop: publish betas to separate repo (#14376) |
| `c79f1a72d` | ported | - | cache platform binary in postinstall for faster startup (#14396) |
| `1ffed2fa6` | skipped | - | Revert "cache platform binary in postinstall for faster startup" (#14457) |
| `2a904ec56` | ported | - | feat(app): show/hide reasoning summaries |
| `1e48d7fe8` | ported | - | zen: gpt safety_identifier |
| `fe89bedfc` | ported | - | wip(app): custom scroll view |
| `c09d3dd5a` | ported | - | chore: cleanup |
| `1d9f05e4f` | ported | - | cache platform binary in postinstall for faster startup (#14467) |
| `950df3de1` | ported | - | ci: temporarily disable assigning of issues to rekram1-node (#14486) |
| `58ad4359d` | ported | - | chore: cleanup |
| `5a1aca918` | skipped | - | docs: add Bangla README translation (#14331) |
| `d0ce2950e` | skipped | - | chore: generate |
| `e77b2cfd6` | ported | - | wip: zen lite |
| `b75a27d43` | ported | - | chore: cleanup |
| `6d58d899f` | ported | - | fix: e2e test outdated |
| `206d81e02` | ported | - | desktop: beta icon |
| `c45ab712d` | skipped | - | chore: locale specific glossaries |
| `dbf2c4586` | skipped | - | chore: updated locale glossaries and docs sync workflow |
| `a41c81dcd` | skipped | - | docs(ko): improve wording in gitlab, ide, index, keybinds, and lsp docs (#14517) |
| `13616e345` | ported | - | Update VOUCHED list |
| `b16f7b426` | skipped | - | docs(tui): correct typo in TUI documentation (#14604) |
| `aaf8317c8` | ported | - | feat(app): feed customization options |
| `eb64ce08b` | ported | - | Update VOUCHED list |
| `faa63227a` | ported | - | chore: generate |
| `a4ed020a9` | ported | - | upgrade opentui to v0.1.81 (#14605) |
| `ab75ef814` | ported | - | chore: update nix node_modules hashes |
| `5712cff5c` | ported | - | zen: track session in usage |
| `5596775c3` | ported | - | zen: display session in usage |
| `a5a70fa05` | ported | - | wip: zen lite |
| `d3ecc5a0d` | ported | - | chore: generate |
| `24c63914b` | ported | - | fix: update workflows for better automation (#14809) |
| `34495a70d` | ported | - | fix(win32): scripts/turbo commands would not run (#14829) |
| `284251ad6` | ported | - | zen: display BYOK cost |
| `0269f39a1` | ported | - | ci: add Windows to unit test matrix (#14836) |
| `ae190038f` | ported | - | ci: use bun baseline build to avoid segfaults (#14839) |
| `cf5cfb48c` | ported | - | upgrade to bun 1.3.10 canary and force baseline builds always (#14843) |
| `cda2af258` | ported | - | wip: zen lite |
| `fb6d201ee` | ported | - | wip: zen lite |
| `744059a00` | ported | - | chore: generate |
| `3201a7d34` | ported | - | fix(win32): add bun prefix to console app build scripts (#14884) |
| `888b12338` | skipped | - | feat: ACP - stream bash output and synthetic pending events (#14079) |
| `ef7f222d8` | ported | - | chore: generate |
| `c92913e96` | ported | - | chore: cleanup |
| `519058963` | ported | - | zen: remove alpha models from models endpoint |
| `f8cfb697b` | ported | - | zen: restrict alpha models to admin workspaces |
| `2a87860c0` | skipped | - | zen: gpt 5.3 codex |
| `2c00eb60b` | skipped | - | feat(core): add workspace-serve command (experimental) (#14960) |
| `29ddd5508` | ported | - | release: v1.2.11 |
| `814c1d398` | skipped | - | refactor: migrate Bun.spawn to Process utility with timeout and cleanup (#14448) |
| `fa559b038` | skipped | - | core: temporarily disable plan enter tool to prevent unintended mode switches during task execution |
| `a487f11a3` | ported | - | ci: auto-resolve merge conflicts in beta sync using opencode |
| `0b3fb5d46` | ported | - | ci: specify opencode/kimi-k2.5 model in beta script to ensure consistent PR processing |
| `6af7ddf03` | ported | - | ci: switch beta script to gpt-5.3-codex for improved code generation quality |
| `76b60f377` | skipped | - | desktop: make readme more accurate |
| `6fc550629` | ported | - | zen: go |
| `d00d98d56` | ported | - | wip: zen go |
| `1172ebe69` | ported | - | wip: zen go |
| `5d5f2cfee` | ported | - | wip: zen go |
| `d7500b25b` | ported | - | zen: go |
| `fc6e7934b` | ported | - | feat(desktop): enhance Windows app resolution and UI loading states (#13320) |
| `3c6c74457` | skipped | - | sync |
| `561f9f5f0` | skipped | - | opencode go copy |
| `d848c9b6a` | ported | - | release: v1.2.13 |
| `de2bc2567` | ported | - | release: v1.2.14 |
| `5e5823ed8` | ported | - | chore: generate |
| `e48c1ccf0` | ported | - | chore(workflows): label vouched users and restrict vouch managers (#15075) |
| `b368181ac` | ported | - | chore: move glossary |
| `1172fa418` | ported | - | wip: zen go |
| `9d29d692c` | skipped | - | split tui/server config (#13968) |
| `4551282a4` | ported | - | chore: generate |
| `444178e07` | skipped | - | fix(docs): update schema URL in share configuration examples across multiple languages (#15114) |
| `c4ea11fef` | ported | - | wip: zen |
| `799b2623c` | ported | - | release: v1.2.15 |
| `6b021658a` | ported | - | fix(app): open in powershell (#15112) |
| `7453e78b3` | skipped | - | feat: opencode go provider list (#15203) |
| `96ca0de3b` | ported | - | wip: zen |
| `08f056d41` | skipped | - | docs: Sync zh_CN docs with English Version (#15228) |
| `5745ee87b` | ported | - | refactor(desktop): enhance project tile interaction with suppress hover functionality (#15214) |
