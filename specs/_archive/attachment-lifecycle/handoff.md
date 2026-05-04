# Handoff: attachment-lifecycle

## Execution Contract

| Field | Value |
|---|---|
| `mainRepo` | `/home/pkcs12/projects/opencode` |
| `baseBranch` | `main` |
| `implementationWorktree` | `/home/pkcs12/projects/opencode-worktrees/attachment-lifecycle` |
| `implementationBranch` | `beta/attachment-lifecycle` |
| `docsWriteRepo` | `/home/pkcs12/projects/opencode` (= mainRepo) |
| `featureSlug` | `attachment-lifecycle` |

## Required Reads

(Read every file before any code change.)

- [proposal.md](./proposal.md) — Why + scope + 6 OQ resolutions
- [spec.md](./spec.md) — R1~R5 GIVEN/WHEN/THEN
- [design.md](./design.md) — DD-1..DD-14 (decisions + risks + critical files)
- [c4.json](./c4.json) — 6 components (DehydrationHook / IncomingStore / RereadAttachmentTool / WireFormatTransformer / GarbageCollector / AnnotationExtractor)
- [sequence.json](./sequence.json) — 5 scenarios
- [data-schema.json](./data-schema.json) — schema extension + tool I/O + telemetry
- [tasks.md](./tasks.md) — task tree T.0~T.6
- Risks recorded in design.md R1-R5
- Sister spec context: [prompt-cache-and-compaction-hardening](../prompt-cache-and-compaction-hardening/) (Phase B landed; this spec sits orthogonal to its preface architecture)
- Memory:
  - [feedback_beta_xdg_isolation](../../.claude/projects/-home-pkcs12-projects-opencode/memory/feedback_beta_xdg_isolation.md) — XDG isolation discipline
  - [feedback_no_silent_fallback](../../.claude/projects/-home-pkcs12-projects-opencode/memory/feedback_no_silent_fallback.md) — fail-loud on tool errors
  - [feedback_restart_daemon_consent](../../.claude/projects/-home-pkcs12-projects-opencode/memory/feedback_restart_daemon_consent.md) — ask before daemon restart
  - [feedback_minimal_fix_then_stop](../../.claude/projects/-home-pkcs12-projects-opencode/memory/feedback_minimal_fix_then_stop.md) — hotfix scope discipline (don't side-track)

## Beta Surface Setup

```bash
cd /home/pkcs12/projects/opencode-worktrees/attachment-lifecycle
source .beta-env/activate.sh
echo "$XDG_CONFIG_HOME"  # must equal $BETA_ROOT/.beta-env/xdg-config
```

## Stop Gates In Force

| Gate | When | What to do |
|---|---|---|
| **T.0.1 worktree creation** | Pre-implementation | Stop and report if worktree path conflicts |
| **T.5.7 validation gate** | After T.1-T.4 implemented + tests green | STOP; report Phase summary; await user finalize approval |
| **T.6.1 merge to main** | After user OK | Merge `--no-ff`; spec amend to record landing |
| **T.6.4 daemon restart** | Post-merge | Pause and ask "重啟嗎？" before calling restart |
| **DD-1..DD-14 want to change** | Anytime | STOP; design needs amend before implementation continues |
| **Schema field non-optional** | Anytime | STOP; backwards compat is non-negotiable per DD-7 |

## Per-task Ritual

After each tasks.md item completes:

1. Mark `- [x]` in mainRepo `specs/_archive/attachment-lifecycle/tasks.md`
2. Run `bun run /home/pkcs12/.claude/skills/plan-builder/scripts/plan-sync.ts specs/_archive/attachment-lifecycle/`
3. Read sync output:
   - `clean` → next task
   - `warned` → process drift per [plan-builder §16.3 decision tree](../../../../skills/plan-builder/SKILL.md)
4. TodoWrite status update

## Phase Boundary Ritual

End of each T.X phase: write phase-summary block into next session's event log if phase scope warrants. T.5.5 produces the final landing summary.

## Execution-Ready Checklist

- [x] mainRepo + baseBranch confirmed
- [x] Spec at `designed`; proposal/spec/design/c4/sequence/data-schema/idef0/grafcet all in
- [x] tasks.md drafted (T.0~T.6)
- [x] handoff.md (this file) drafted
- [ ] test-vectors.json drafted
- [ ] errors.md drafted
- [ ] observability.md drafted
- [ ] Spec promote to `planned`

## Branch / Worktree Discipline

- Code changes in beta worktree only
- Spec / docs changes in mainRepo only
- Conventional commits, no `--no-verify`, no auto-push
- New beta worktree path is `opencode-worktrees/attachment-lifecycle` (NOT the permanent `opencode-beta` per memory `feedback_beta_workspace_persistent`)

## Rollback Plan

- Each T.X commit independent; revert one without breaking the rest
- Schema additions are optional, so revert leaves old sessions parsing fine
- Incoming staging dir: manual `rm -rf ~/.local/state/opencode/incoming/` if disk pressure
- No flag — direct-ship per Phase B v2 discipline

## Post-Merge Spec Closeout

After T.6.1 merge to main:
- `plan-promote --to verified` (validation done)
- `plan-promote --to living` (matches current code state)
- spec history captures the full lifecycle

PDF support follow-up: open new spec `attachment-lifecycle-pdf` (or extend) when image-only path proves stable.
