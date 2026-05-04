# 2026-05-03 — provider-account-decoupling, full sweep + cutover prep

Branch: `beta/provider-account-decoupling`
Spec: `specs/_archive/provider-account-decoupling/`

## What landed

Phases 1–8 of the provider/family/account decoupling refactor:

| Phase | Commits | Outcome |
| --- | --- | --- |
| 1 — boundary infra | `chore(beta)…`, `feat(provider): phase 1` | `RegistryShapeError`, `UnknownFamilyError`, `NoActiveAccountError`, `MigrationRequiredError` declared; `assertFamilyKey` wired in |
| 2 — registry shape | `feat(provider): phase 2` | `providers[]` only contains family entries; per-account state lives under `providers[family].accounts[accountId]` |
| 3 — Auth signature | `feat(auth): phase 3` | `Auth.get(family, accountId?)` two-arg; legacy single-arg removed |
| 4 — getSDK signature | `feat(provider): phase 4` | `Provider.getSDK(family, accountId, modelId)` three-arg; `ModelDispatch` carried through `session/llm.ts` |
| 5 — rotation simplification | `feat(rotation): phase 5` | `enforceCodexFamilyOnly` + 2026-05-02 step 3b same-family hotfix deleted (DD-5). Per-step counters from `c27a127e8` retained |
| 6 — migration script | `feat(scripts): phase 6` | `packages/opencode/scripts/migrate-provider-account-decoupling.ts` (`--dry-run` / `--apply` / `--verify`, atomic + idempotent) |
| 7 — boot guard | `feat(server): phase 7` | `server/migration-boot-guard.ts` wired into `ServeCommand.handler`; daemon refuses to start without `.migration-state.json` version `"1"` |
| 8 — tests + docs | (this commit) | Boundary tests + migration round-trip tests + architecture.md `## Provider/Family/Account Naming` section |

## Rebase notes

Branch was rebased onto `main` HEAD `c27a127e8` after phase 5 work. Three main-side commits intersected with our changed files; resolution policy:

- `e14e308dc` (step 3b same-family skip) — **dropped during rebase**, structurally redundant under DD-1 once registry only holds family entries.
- `6949a49ca` (CodexFamilyExhausted debug enrichment) — **kept**; `Account.resolveFamily(current.providerId)` becomes a no-op post-DD-1 but the `triedVectors` / `willThrowCodexFamilyExhausted` debug payload remains useful and was not affected by Phase 4's `getSDK`/`Auth.get` signature changes.
- `c27a127e8` (per-step rotation counters) — **kept**; pure observability addition, merged into the simplified `buildFallbackCandidates` body. `log.info` upgrade and `stepCounts` payload survive.

## Cutover (operator, post-merge)

Phase 9 runs by hand once this branch is merged and a new daemon binary is built. Rollback is via the backup snapshot, not via code reverts.

```
opencode daemon stop
bun run packages/opencode/scripts/migrate-provider-account-decoupling.ts --dry-run    # review diff
bun run packages/opencode/scripts/migrate-provider-account-decoupling.ts --apply      # backup + sweep + marker
cat ~/.local/share/opencode/storage/.migration-state.json                              # confirm version "1"
ls ~/.local/share/opencode/storage/.backup/provider-account-decoupling-*/              # confirm backup
opencode serve --unix-socket /run/user/$UID/opencode.sock                              # start new binary
# smoke: codex completion on yeats.luo@thesmart.cc; force a 5H window; verify
# same-family fallback to a different codex account succeeds
```

If the new daemon refuses to start, error message points back at `bun run packages/opencode/scripts/migrate-provider-account-decoupling.ts --apply`. Do not bypass with env vars — the boot guard exists precisely for the case where someone forgets the migration step.

Rollback path: copy `<storage>/.backup/provider-account-decoupling-<ISO>/` over `~/.local/share/opencode/storage/` and `~/.config/opencode/accounts.json`, delete `.migration-state.json`, downgrade binary.

## Open follow-ups (not blocking merge)

- `specs/architecture.md ### Codex family rotation rule` retains the historical narrative with strikethrough on the deleted gate. Once enough time has passed that the strikethrough is no longer pedagogically useful, fold the section into the new `## Provider/Family/Account Naming` block.
- Consider deleting `Account.parseProvider` / `Account.resolveFamilyFromKnown` after the migration ships — they currently survive only for the migrator's offline use. A future cleanup pass can move that algorithm fully into `scripts/migrate-provider-account-decoupling.ts` (it is already inlined there).

## Cutover actually executed (2026-05-03 22:50 → 23:11 +08:00)

| When (UTC) | What | Outcome |
| --- | --- | --- |
| 14:50:02Z | `--apply` for pkcs12 (uid 1000) | rewrote 6 files (`claude-cli-subscription-claude-cli` → `claude-cli`); 6739 already-clean. Backup: `~/.local/share/opencode/storage/.backup/provider-account-decoupling-2026-05-03T14-50-02-489Z` |
| 14:50:11Z | `--apply` for liam (uid 1004) via sudo -u liam | rewrote 0 files (storage uses `.db`, not JSON walker target); marker still written. Backup: `/home/liam/.local/share/opencode/storage/.backup/provider-account-decoupling-2026-05-03T14-50-11-418Z` |
| 14:50:30Z | `--verify` for both | both `verify ok: no further rewrites needed` |
| 14:55Z | Daemon respawn via webctl restart | both daemons came back; boot guard accepted markers |
| 15:00Z | Frontend XDG symlink added | `~/.local/share/opencode/frontend → packages/app/dist` for both users — daemons no longer need OPENCODE_FRONTEND_PATH env to find index.html |
| 15:08Z | `Auth.get` regression observed | `github-copilot-enterprise` (synthetic family inherited via `inheritFrom`) hit the new strict gate; UI showed "Unknown error" toasts |
| 15:09Z | Hotfix attempt 1 (`566ab6834`) — REVERTED at `6103fac0c` | Tried lazy-import of `Provider.knownProviderIds` from inside `Auth.get`; deadlocked during init because state() population calls Auth.get. Symptom: `/api/v2/provider` hung → 504 Gateway Timeout |
| 15:11Z | Hotfix attempt 2 (`1ac82db2c`) — KEPT | Added static `RUNTIME_SYNTHETIC_FAMILIES = ["github-copilot-enterprise"]` to `Account.knownFamilies`. No async lookup, no circular dependency. UI returned to working state. |
| 15:12Z | Liam daemon stopped | spawned during cutover for migration only; gateway will lazily respawn on demand if liam becomes active |

### Lessons captured

1. **`Auth.get` from inside provider init is deadlock territory.** Any expansion of the strict-shape check that depends on `Provider.state()` will hang because state() initialization loads plugins which call Auth.get. Use a static set or push the expansion into `Account.knownFamilies` instead.
2. **The dev-mode daemon launch lacks `OPENCODE_FRONTEND_PATH`.** The systemd unit / production launcher set it; manual `bun ... serve` does not. Permanent fix: symlink `~/.local/share/opencode/frontend → packages/app/dist`.
3. **Synthetic families like `github-copilot-enterprise` need explicit registration.** They live in the runtime registry via `inheritFrom()` but never enter `models.dev` / accounts.json / PROVIDERS. Both `assertFamilyKey` (commit `722fbeb45`) and `Account.knownFamilies` (commit `1ac82db2c`) need the same expansion.
4. **Browser cookie flush alone doesn't break the auth/renew loop.** The frontend keeps polling `/auth/renew` without auto-redirecting to login. Operator must manually visit `/global/auth/login` to break out.
