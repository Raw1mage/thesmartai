# Tasks

## 1. Orphan Task Recovery

- [ ] 1.1 Add `scanOrphanToolParts()` function in `task.ts`: query all sessions, find ToolParts with `status: "running"` and `tool: "task"`, verify no live worker owns them
- [ ] 1.2 Add `TaskWorkerEvent.OrphanRecovered` Bus event for UI notification
- [ ] 1.3 Wire orphan scan into `InstanceBootstrap()` completion callback (async, non-blocking, 5-second delay to avoid race with in-flight workers finishing)
- [ ] 1.4 Update `task-worker-continuation.ts` to handle OrphanRecovered event: update parent session ToolPart to `status: "error"` with descriptive message
- [ ] 1.5 Write test: create stale ToolPart, invoke scan, verify state transition to "error"

## 2. Session Version Guard

- [ ] 2.1 Add `staleVersion?: boolean` field to Session.Info (transient, not persisted)
- [ ] 2.2 In `Session.get()`: compare `info.version` vs `Installation.VERSION`, set `staleVersion` flag and log warning if mismatch
- [ ] 2.3 Add `debugCheckpoint` for version drift events (for debug.log observability)
- [ ] 2.4 Propagate `staleVersion` to UI metadata where applicable (session status display)
- [ ] 2.5 Write test: create session with mock old version, load it, verify staleVersion flag

## 3. Worker Pre-Bootstrap Observability

- [ ] 3.1 In `session.ts` worker handler: add `fs.appendFileSync` logging before `bootstrap()` call, writing to `{Global.Path.log}/worker-{pid}.log`
- [ ] 3.2 Add timestamps for key lifecycle points: process start, pre-bootstrap, bootstrap-start, bootstrap-complete, ready-sent
- [ ] 3.3 On successful bootstrap: optionally truncate the log file (keep last entry only) to prevent accumulation
- [ ] 3.4 In parent `task.ts`: when worker fails to become ready, include worker log file path in error message for diagnosis
- [ ] 3.5 Validate: kill worker during bootstrap, verify log file contains pre-bootstrap entries

## 4. Tool Input Normalization

- [ ] 4.1 Add `normalizeToolInput(toolName: string, input: Record<string, unknown>): Record<string, unknown>` utility function
- [ ] 4.2 Implement registry-driven normalization: lookup current tool schema, detect missing canonical params, remap from provided params if type matches
- [ ] 4.3 Add apply_patch-specific migration rule: `patchText` → `input` (as known codex-rs canonical name)
- [ ] 4.4 Wire normalization into message context assembly in `llm.ts` `normalizeMessages()` — transform ToolPart.input before feeding to LLM
- [ ] 4.5 Ensure normalization is read-only: original stored ToolPart.input is never modified
- [ ] 4.6 Write test: create ToolPart with old format, normalize, verify canonical format output

## 5. Execution Identity Validation

- [ ] 5.1 Add `Account.exists(accountId: string): Promise<boolean>` helper if not already present
- [ ] 5.2 In `processor.ts` account resolution: before using `execution.accountId`, verify account exists
- [ ] 5.3 On validation failure: log warning, fall back to current active account for same provider, update session execution identity
- [ ] 5.4 Ensure fallback doesn't trigger infinite recursion (guard against fallback account also being invalid)
- [ ] 5.5 Write test: pin session to nonexistent account, resume session, verify graceful fallback
