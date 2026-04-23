# 2026-04-23 — responsive-orchestrator Phases 2-8 (autonomous batch)

## Phases
2 — Subagent self-awareness
3 — Async dispatch (PARTIAL: event emission only; stub-return flip deferred to Phase 9)
4 — Notice delivery (Bus event + subscriber + bootstrap)
5 — Prompt assembly (renderNoticeAddendum + drain-on-consume)
6 — cancel_task tool
7 — system-manager MCP tools (list_subagents, read_subsession)
8 — Prompt updates (PARTIAL: template only; runtime XDG sync deferred to Phase 10)

## Done

### Phase 2 — processor.ts + model-update-signal.ts
- ModelUpdateSignal.wait now accepts `timeoutMs` parameter (default 30s)
- Both child-session escalation sites (pre-flight ~line 498, retry ~line 1359) read `Tweaks.subagent().escalationWaitMs` and pass it
- Both timeout catch blocks now write `finish: "rate_limited"` + Session.updateMessage before break — disk-terminal delivery to watchdog A
- New runloop state in process(): `quotaLowExitRequested`, `wrapUpTurnDispatched`, `quotaLowSnapshot`
- Top-of-loop state machine (after abort check): on first detection injects "[QUOTA-LOW] final turn" system addendum; on second iteration writes `finish: "quota_low"` + rotateHint + persist + break
- Post-turn quota check (after existing checkCodexLowQuotaAndMark) probes child sessions specifically against `subagent_quota_low_red_line_percent`; when tripped, captures snapshot for rotateHint
- MAX_CUMULATIVE_ESCALATIONS=5 untouched (DD-10)

### Phase 3 (partial) — task.ts
- New `TaskCompletedEvent` Bus event type defined alongside existing TaskWorkerEvent / TaskRateLimitEscalationEvent
- After existing watchdog Promise.race resolves (and child output extraction completes), event is published with full payload (jobId, parentSessionID, childSessionID, status, finish, elapsedMs, errorDetail, rotateHint)
- jobId currently sourced from `ctx.callID` — full registry-by-jobId indexing deferred to Phase 9
- Status resolution: watchdog C/B outcomes (silent_kill / worker_dead) honored first; otherwise read child's actual finish from disk and map to status
- errorDetail.resetsInSeconds parsed from stored 429 message body via regex
- rotateHint extracted from stored MessageV2.Assistant.rotateHint field (set by Phase 2 quota_low path)
- Sync return path UNCHANGED — both paths active simultaneously (additive); Phase 9 will flip to stub-return

### Phase 4 — pending-notice-appender subscriber
- New file `bus/subscribers/pending-notice-appender.ts`
- Subscribes to `task.completed`, builds PendingSubagentNotice, appends via Session.update (atomic; preserves new arrivals)
- Idempotency: filters existing entries by jobId, latest-wins
- WATCHER_PARENT_GONE handling: warn + drop (does not throw)
- Instance.provide directory context preserved via event.context
- Registered in `index.ts` bootstrap alongside debug-writer and task-worker-continuation

### Phase 5 — prompt assembly
- New `renderNoticeAddendum(notice)` helper in prompt.ts
- Drains `session.pendingSubagentNotices` before processor.process call
- Each notice rendered as one-line system-prompt addendum (LLM-friendly, status-specific tail format)
- quota_low addendum includes "Switch to a different account before any further dispatch" directive (DD-3.1)
- rate_limited / worker_dead / silent_kill have status-specific guidance tails
- Drain is atomic via Session.update with closure (consumed jobId set); new arrivals between read+write survive

### Phase 6 — cancel_task tool
- New file `tool/cancel-task.ts` registered in tool/registry.ts
- New exported helper `cancelByJobId(jobId, reason)` in task.ts: looks up worker by `current.toolCallID`, writes `{type:"cancel"}` to worker stdin (existing handler at session.ts:304 honors this), returns "cancelled" | "not_found" | "already_terminal"
- Worker's existing cancel handler triggers SessionPrompt.cancel + sends `{type:"canceled"}` upstream — natural flow, no new code path
- `finish: "canceled"` written to disk → watchdog A picks up → notice delivered as cancellation result (DD-6 single authority)

### Phase 7 — system-manager MCP tools
- Two new tools registered in system-manager: `list_subagents` and `read_subsession`
- Server version bumped 1.1.0 → 1.2.0
- list_subagents reads filesystem (sessions with parentID), classifies status from last assistant message finish field, returns shape per data-schema.json#SubagentStatusEntry
- read_subsession wraps existing readNestedSessionMessages helper, supports sinceMessageID cursor + limit, returns structured error (no throw) on missing/inaccessible session
- Implementation is disk-read based (system-manager runs as separate stdio MCP process; cannot directly access daemon's in-memory worker registry)

### Phase 8 (partial) — SYSTEM.md template
- Added cancel_task + system-manager.list_subagents + system-manager.read_subsession to "Your Tools" section
- Added new section 2.2.1 "Subagent completion notices" with pseudo-code parsing rules for the addendum format (per memory feedback_prompt_pseudocode_style.md)
- Each status (success/error/canceled/rate_limited/quota_low/worker_dead/silent_kill) gets its own action guidance
- quota_low explicitly tells LLM "YOU MUST switch to a different account before any new task() call"

## Deferred
- 3.2/3.3/3.4: stub-return flip + detached watcher refactor → Phase 9 (after manual smoke test confirms additive path works)
- 8.2/8.3/8.4: runtime XDG SYSTEM.md sync + agent prompt audit + enablement.json → Phase 9-10
- 9.x: all acceptance checks (require running daemon for verification)
- 10.x: rollout

## Validation
- `bun run --bun -- tsc --noEmit -p packages/opencode/tsconfig.json`: zero errors in any file modified by this batch
  - Pre-existing `processor.ts(337,19) Cannot find name 'l'` — confirmed present without my changes (stash test)
  - Pre-existing errors in codex-provider, CLI cmd args, TUI session, theme.json — unrelated to this spec
- `tsc --noEmit` from system-manager package: only pre-existing errors in submodule templates/skills/plan-builder/scripts (not from this spec)
- No daemon restart attempted yet (per beta-workflow §5: validate after build, not during)

## Drift
None requiring action. tasks.md updated to reflect actual completion state honestly (no false ticks).

## Branch
`beta/responsive-orchestrator` on `/home/pkcs12/projects/opencode-beta` from main `c39b6dfbb`.

## Files touched (cumulative across Phases 1-8)
- packages/opencode/src/tool/task.ts — TERMINAL_FINISHES, TaskCompletedEvent, cancelByJobId, post-watchdog event emission
- packages/opencode/src/session/index.ts — Session.Info.pendingSubagentNotices field
- packages/opencode/src/session/message-v2.ts — PendingSubagentNotice zod schema
- packages/opencode/src/session/processor.ts — escalation timeout, quota_low wrap-up state machine, R6 trigger
- packages/opencode/src/session/model-update-signal.ts — timeoutMs parameter
- packages/opencode/src/session/prompt.ts — renderNoticeAddendum + drain
- packages/opencode/src/config/tweaks.ts — SubagentConfig + 2 knobs
- packages/opencode/src/index.ts — registerPendingNoticeAppenderSubscriber bootstrap
- packages/opencode/src/tool/registry.ts — CancelTaskTool registration
- packages/opencode/src/tool/cancel-task.ts — NEW
- packages/opencode/src/bus/subscribers/pending-notice-appender.ts — NEW
- packages/mcp/system-manager/src/index.ts — list_subagents + read_subsession + version bump
- templates/prompts/SYSTEM.md — cancel_task + introspection tools + 2.2.1 notice parsing pseudo-code

## Next session
- Manual smoke test on beta daemon (separate XDG via OPENCODE_DATA_HOME or accept main XDG sharing; user picks)
- Phase 9: flip task tool to stub return + audit agent prompts + enablement.json
- Phase 10: fetch-back to test/responsive-orchestrator branch in main repo, validate, finalize, cleanup
