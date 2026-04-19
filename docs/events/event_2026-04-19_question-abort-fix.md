# Event — 2026-04-19 question-tool-abort-fix

Implementation log for [specs/question-tool-abort-fix/](../../specs/question-tool-abort-fix/).

## Context

User reported a reproducible failure mode on the webapp: after answering an `AskUserQuestion` dialog carefully, the UI shows a red "Tool execution aborted" banner and the AI re-asks the same question. Happened consecutively across several questions. Root cause triage in conversation pointed to three independent issues:

- (A) `Question.ask()` didn't listen to `AbortSignal`, so stream abort left pending questions orphaned
- (B) `QuestionDock` cached user input by `request.id`, which changes on AI re-ask
- (C) `prompt-runtime.cancel()` didn't carry a reason label, so logs can't tell which caller triggered the abort

Spec package created via `plan-builder` at `specs/question-tool-abort-fix/` (state=planned). Beta branch `beta/question-tool-abort-fix` created from `main@0e3730f8f`.

## Phase 1 — Server Foundation (Requirement A)

**Done**: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7

**Key decisions**:
- DD-1 applied: `Question.ask` gained optional `abort?: AbortSignal`; reuse `RejectedError` for both manual reject and stream abort so processor's `instanceof RejectedError` path is untouched.
- Pre-aborted signal short-circuit publishes `question.rejected` but skips `question.asked` to avoid ghost dialog flash.
- `dispose()` closure attached per pending entry; called from `reply` / `reject` / abort handler to remove the abort listener deterministically.
- `RejectedError` gained optional `detail` constructor arg (e.g. `"aborted: rate-limit-fallback"`) for debugging; default message unchanged.

**Validation**:
- `bun test packages/opencode/src/question/index.test.ts` → 6/6 pass (703 ms, 18 expect calls)
- `bunx tsc --noEmit -p packages/opencode/tsconfig.json` → no new errors on `question/index.ts` or `tool/question.ts` (pre-existing errors elsewhere unrelated to this change)

**Drift**: none — `plan-sync.ts` reports clean.

**Remaining**: Phase 2 (cancel reason enum), Phase 3 (webapp cache key), Phase 4 (docs/SSOT), Phase 5 (E2E), Phase 6 (finalize).

## References

- Spec: [specs/question-tool-abort-fix/spec.md](../../specs/question-tool-abort-fix/spec.md)
- Design: [specs/question-tool-abort-fix/design.md](../../specs/question-tool-abort-fix/design.md)
- Branch: `beta/question-tool-abort-fix` @ opencode-beta worktree
