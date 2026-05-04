# 2026-04-23 — responsive-orchestrator Phase 1 (foundation)

## Phase
1 — Foundation: schema, finishes, tweaks knobs

## Done
- 1.1 Extended `TERMINAL_FINISHES` in tool/task.ts:2073-2086 with `rate_limited` + `quota_low` (preserving existing `stop`/`error`/`length`/`canceled`)
- 1.2 Added `pendingSubagentNotices: PendingSubagentNotice.array().optional()` to Session.Info schema in session/index.ts (backward-compatible — absent = empty)
- 1.3 Added new `Tweaks.SubagentConfig` interface + `SUBAGENT_DEFAULTS` + `KNOWN_KEYS` entries + parsing block + `Tweaks.subagent()` accessor in config/tweaks.ts. Two knobs: `subagent_escalation_wait_ms` (5000-300000, default 30000), `subagent_quota_low_red_line_percent` (0-50, default 5)
- 1.4 Added `MessageV2.PendingSubagentNotice` zod schema in session/message-v2.ts after Info union (with statusEnum, finishEnum, errorDetail, rotateHint, cancelReason). Source-of-truth path `/specs/_archive/responsive-orchestrator/data-schema.json#PendingSubagentNotice` referenced inline

## Key decisions
- No new DD added this phase. Spec terminology adjusted: codebase uses `canceled` (American spelling), not `cancelled`. PendingSubagentNotice schema mirrors that. data-schema.json says `cancelled` in some places — drift to fix opportunistically next phase via plan-sync (not blocking).
- Spec said "three new tweaks knobs"; only two ended up needed (the `task_result_inject_grace_ms` knob from earlier draft was dropped when DD-3 was reworked to wake-only). tasks.md reflects this.

## Validation
- `tsc --noEmit -p packages/opencode/tsconfig.json` — only pre-existing errors in unrelated files (codex-provider AI SDK drift, CLI cmd argument count drift, TUI subSessionID rename drift, missing theme.json). Zero errors in message-v2.ts, tweaks.ts, session/index.ts.

## Drift
None requiring action. Spelling discrepancy noted above.

## Remaining
Phases 2-10: subagent self-awareness (escalation timeout + quota wrap-up), task tool async revert (the big one), notice delivery subscriber, prompt assembly addendum, cancel_task tool, system-manager MCP tools, prompt updates, validation, rollout.

## Branch
`beta/responsive-orchestrator` on `/home/pkcs12/projects/opencode-beta` from main `c39b6dfbb`.
