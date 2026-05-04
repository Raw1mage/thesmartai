# Handoff

## Execution Contract

- Execute all phases on the beta worktree at `/home/pkcs12/projects/opencode-beta/` on branch `beta/mobile-tail-first-simplification`.
- `mainRepo` = `/home/pkcs12/projects/opencode/`, `baseBranch` = `main`, `docsWriteRepo` = `mainRepo`.
- Spec artifacts (`specs/_archive/mobile-tail-first-simplification/**`, `docs/events/**`) are edited in `mainRepo`, never in beta.
- After all phases green + 9.5 grep-check clean: create `test/mobile-tail-first-simplification` from `main` in `mainRepo`, merge `beta/mobile-tail-first-simplification`, run full test suite, then merge test branch to `main`.
- Delete beta branch + test branch after merge. Beta worktree at `opencode-beta/` stays (permanent workspace).

## Required Reads

Before starting Phase 1, the executor MUST read:

- `specs/_archive/mobile-tail-first-simplification/spec.md` — full Requirements list
- `specs/_archive/mobile-tail-first-simplification/design.md` — DD-1 through DD-10, **especially DD-8 removal inventory**
- `specs/_archive/mobile-tail-first-simplification/sequence.json` — P1..P5 flows
- `specs/_archive/frontend-session-lazyload/spec.md` — to understand what R1/R2 will be superseded
- `AGENTS.md` (project) — XDG backup policy, daemon lifecycle authority

## Stop Gates In Force

Stop and escalate (do NOT improvise past these):

1. **Authority mismatch**: if current worktree/branch/repo does not match the admitted beta surface, stop.
2. **Tweak key collision**: if `session_tail_*` / `session_store_cap_*` already exist in `tweaks.cfg` with different defaults, stop — the user must reconcile before implementation.
3. **Removed path still imported**: if after Phase 3 grep shows `use-session-resume-sync` or `force:true` still referenced in source tree, stop — Phase 3 is incomplete, do NOT proceed.
4. **Grep-check (8.1) fails against beta bundle**: stop before fetch-back.
5. **Desktop regression in 9.1**: if scroll-up doesn't load older on desktop, stop — not a minor polish issue, it's the only way desktop users see history.
6. **Mobile still OOMs in 9.2**: stop, open follow-up spec `mobile-message-virtualization` — do NOT revert this work.
7. **Part-scoped expand endpoint (2.1) returns wrong content**: stop, this breaks long-reasoning/long-output UX.

## Execution-Ready Checklist

- [ ] XDG backup taken: `cp -a ~/.config/opencode/ ~/.config/opencode.bak-$(date +%Y%m%d-%H%M)-mobile-tail-first/`
- [ ] Beta worktree clean: `cd /home/pkcs12/projects/opencode-beta && git status` shows no uncommitted tracked changes
- [ ] Beta branch created: `git checkout -b beta/mobile-tail-first-simplification` from latest `main`
- [ ] `spec.md` + `design.md` re-read in full (not skimmed)
- [ ] DD-8 removal inventory open in side window during Phase 1-3
- [ ] `bun test` green on beta `main` head before Phase 1 starts
- [ ] No other in-flight beta branches — this is a destructive refactor, serialize with any other work
