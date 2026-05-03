# 2026-05-03 — provider-account-decoupling Phase 9 handover

Companion to [event_2026-05-03_provider-account-decoupling-cutover.md](event_2026-05-03_provider-account-decoupling-cutover.md). The cutover doc captures *what landed*; this one captures *what the next session needs to know to finish the cutover safely*.

## Entry state

- `/home/pkcs12/projects/opencode` is on `main` at `bc1a7407d` — a merge commit folding `beta/provider-account-decoupling` into main with `--no-ff`. The 10 phase commits are visible in `git log` underneath.
- Branch ref `beta/provider-account-decoupling` is still alive; the worktree at `/home/pkcs12/projects/opencode-beta` is also still alive (do not delete).
- Spec `specs/provider-account-decoupling/.state.json` is at `verified`. `tasks.md` Phases 1–8 are all checked off; Phase 9 (cutover) is intentionally still unchecked because it is operator-driven.
- Nothing pushed. Nothing migrated. Daemon is still running the *old* binary; `.migration-state.json` does not exist yet.
- Main repo working tree carries unrelated in-flight state (`M specs/prompt-cache-and-compaction-hardening/.state.json` plus four untracked paths under `docs/`, `plans/`, `templates/`). **Not part of this branch's work — do not commit, do not stash.**

## What this branch did, in one sentence

Collapsed the provider dimension from "every per-account slug masquerades as a provider" to "the registry only holds families; per-account state lives under `providers[family].accounts[accountId]`", deleted every string-shape gate that was patching around the old shape, and added a one-shot migrator + boot guard so historical session storage can be normalised in a single sweep.

The DD-1 invariant is now load-bearing: `providers[X]` is a family, enforced by `provider/registry-shape.ts:assertFamilyKey` at every write site. Per-account slugs throw `RegistryShapeError`.

## Why the new daemon will refuse to start

Phase 7 added `server/migration-boot-guard.ts`, wired into `cli/cmd/serve.ts:handler`. On boot it reads `~/.local/share/opencode/storage/.migration-state.json`. If the file is missing, unparseable, or the version is not `"1"`, the daemon prints a remediation hint and exits 1 — by design, per AGENTS.md rule 1 (no silent fallback).

That marker only appears after `migrate-provider-account-decoupling.ts --apply` runs successfully. So the cutover order is fixed: stop daemon → migrate → start new daemon. There is no env var or flag to bypass; if you find yourself wanting to bypass, you are doing the cutover wrong.

## Phase 9 sequence

Each step is a separate user-consent gate. Do not chain them.

1. **Inspect main working tree.** Confirm the `M specs/prompt-cache-and-compaction-hardening/.state.json` and the four untracked paths are still present and identical to entry state. If any of them moved, stop and ask — the user has parallel work.

2. **Dry-run the migrator.** Read-only; safe to repeat.
   ```
   cd /home/pkcs12/projects/opencode
   bun run packages/opencode/scripts/migrate-provider-account-decoupling.ts --dry-run
   ```
   The output is `{ summary }` JSON plus per-file `rewrite ...` audit lines. Show the user the summary and the audit lines. Wait for explicit approval before step 3.

3. **Apply.** Writes backup, mutates storage, drops the marker.
   ```
   bun run packages/opencode/scripts/migrate-provider-account-decoupling.ts --apply
   ```
   The backup at `<storage>/.backup/provider-account-decoupling-<ISO>/` is the only rollback mechanism. Note its path in the cutover record.

4. **Verify.** Read-only consistency check; non-zero exit means step 3 missed something.
   ```
   bun run packages/opencode/scripts/migrate-provider-account-decoupling.ts --verify
   ```
   Expected: `verify ok: no further rewrites needed`.

5. **Restart daemon — user consent gate.** Per `feedback_restart_daemon_consent`, never auto-restart. Pause, ask "重啟嗎？", call `system-manager:restart_self` only after the user agrees. New binary should boot cleanly because the marker is now present.

6. **Smoke test.** Open a session against a codex model. If feasible, force a 5H window or a transient error and verify same-family fallback to a different codex account. If smoke fails, roll back via backup before doing anything else.

7. **Push — separate user consent gate.** `git push origin main` once smoke passes and the user explicitly approves.

8. **(Optional, ask first)** delete the `beta/provider-account-decoupling` branch ref via `git branch -d`. The directory `/home/pkcs12/projects/opencode-beta` is permanent — do not run `worktree remove` and do not `git submodule deinit`.

## Troubleshooting reference

| Symptom | Cause | Recovery |
| --- | --- | --- |
| Daemon exits 1 with "migration marker missing" | `--apply` not yet run | Run step 3 |
| Daemon exits 1 with "version mismatch" | Marker is from a previous schema version | Re-run `--apply`; it overwrites the marker |
| `--verify` reports `wouldRewrite > 0` | `--apply` was interrupted mid-walk | Re-run `--apply` (idempotent) |
| `RegistryShapeError` thrown at provider init for a key like `<family>-<suffix>` | A `mergeProvider` call site bypasses the database-keys union check | Trace the call site, ensure the key is either in `Account.knownFamilies()` or in `Object.keys(database)`; do not loosen `assertFamilyKey` itself |
| Need to roll back entirely | Restore the backup snapshot | `cp -a <backup>/{session,message} ~/.local/share/opencode/storage/`, `cp <backup>/accounts.json ~/.config/opencode/`, `rm ~/.local/share/opencode/storage/.migration-state.json`, downgrade binary, restart |

## Sanity-check tests

If anything feels off before step 3, run these to confirm the build is healthy. They exercise the boundaries this branch added.

```
cd /home/pkcs12/projects/opencode
unset OPENCODE_DATA_HOME
bun test packages/opencode/test/account/provider-account-decoupling.test.ts \
         packages/opencode/test/scripts/migrate-decoupling.test.ts \
         packages/opencode/test/account/codex-family-only-fallback.test.ts
```

Expected: 10 pass, 0 fail. The wider provider test suite carries 4 pre-existing transform.test.ts fails and 2 multi-file isolation fails — same profile as main pre-merge, not a regression.

## Hard don'ts (in priority order)

1. Do not auto-restart the daemon. User consent every time.
2. Do not auto-push. Shared state, user consent.
3. Do not commit the unrelated `M ... prompt-cache-and-compaction-hardening/.state.json` or any of the four untracked paths from entry state — that is a different work line.
4. Do not delete the `/home/pkcs12/projects/opencode-beta` directory or its underlying worktree config; only the branch ref is deletable.
5. Do not bypass the boot guard with env vars or flags. If the marker is wrong, fix the marker.
6. Do not run `--apply` without first stopping the daemon if the user has live sessions in flight; the migrator does not coordinate with a running server.

## Where to look if you need more context

- Spec package: `specs/provider-account-decoupling/` (proposal, design, tasks, errors, observability, c4, sequence, idef0, grafcet, test-vectors, data-schema, handoff).
- Phase landing summary + rebase decisions: `docs/events/event_2026-05-03_provider-account-decoupling-cutover.md`.
- Per-phase build narratives: `docs/events/event_2026-05-02_provider-account-decoupling-phase{1,2,3,4}.md`.
- Architecture documentation: `specs/architecture.md`, section `### Provider / Family / Account Naming` (added by Phase 8.3).
- Ground truth for the family list: `Account.knownFamilies()` in `packages/opencode/src/account/index.ts`. The hardcoded `PROVIDERS` list lives at the top of the same file.
