# event 20260420 — question-tool-input-normalization

## Summary

Fixed an end-to-end normalization pipeline bug in the tool framework that left
the QuestionTool's `z.preprocess` coercion ineffective at runtime and in
persisted session state. Consolidated the normalize helper into the SDK so
server runtime, webapp (QuestionDock / message-part.tsx), and TUI all share
a single implementation.

## Trigger

2026-04-20 user report from cisopro session `ses_25b16719fffejShr48aGTkRcEk`:
AskUserQuestion was rendering blank UI. Two consecutive question tool calls
failed — first with `TypeError: undefined is not an object (evaluating
'input.questions.length')`, second with a silently empty QuestionDock (blank
tab headers and option buttons). User dismissed both, tool errored out, AI
fell back to plain markdown.

## Root cause

`Tool.define` wrapper at [packages/opencode/src/tool/tool.ts:58-70](../../packages/opencode/src/tool/tool.ts#L58-L70)
called `parameters.parse(args)` but discarded the return value, passing raw
LLM args to `execute()`. `QuestionTool` had a working
`z.preprocess(normalizeQuestionInput, ...)` that wrapped flat inputs,
coerced string options, and filled missing headers — but the normalized
output never left the preprocess layer. In parallel, session processor wrote
`value.input` (raw) to tool part `state.input`, so even a fix at the tool
layer wouldn't have surfaced to UI renderers.

Full RCA in [specs/_archive/question-tool-input-normalization/proposal.md](../../specs/_archive/question-tool-input-normalization/proposal.md).

## Fix

Spec-driven via plan-builder (`specs/_archive/question-tool-input-normalization/`,
planned → implementing → verified). Five phases, six decisions (DD-1…DD-6):

**Phase 1 — Tool framework (DD-1)**  
[packages/opencode/src/tool/tool.ts](../../packages/opencode/src/tool/tool.ts): wrapper now uses `parsed = parameters.parse(args)` and passes `parsed` into `execute(parsed, ctx)`. Any tool with `z.preprocess` / `z.transform` / `z.default` now benefits at runtime.  
Tests: `packages/opencode/src/tool/tool.test.ts` — 6 tests covering preprocess, canonical, default, transform, and ZodError paths.

**Phase 2 — Question normalize extraction (DD-2)**  
Helpers moved from `packages/opencode/src/tool/question.ts` to
`packages/opencode/src/question/index.ts` (later to SDK in Phase 4).
Tests: `packages/opencode/src/question/normalize.test.ts` — 14 tests
including null / primitive / flat / canonical / value-detail shape variants.
`packages/opencode/src/tool/question.test.ts` — 5 tests covering the
four TV-4..TV-7 input scenarios.

**Phase 3 — state.input persistence (DD-3)**  
`ToolRegistry.getParameters(id)` helper added with process-lifetime cache. `session/processor.ts` tool-result handler now safeParses value.input using the tool's schema and writes the parsed data to state.input. tool-error keeps raw (forensic evidence). Tests: `packages/opencode/src/tool/registry.normalize-lookup.test.ts` — 6 tests covering registry miss, flat input, string-option array, canonical, un-normalizable, and cache behavior.

**Phase 4 — UI defensive normalize (DD-4)**  
Normalize helper promoted to `packages/sdk/js/src/v2/question-normalize.ts`
(pure JS, no deps) so webapp and TUI can import from `@opencode-ai/sdk/v2`.
Server-side `Question.normalize` re-exports from SDK. Updated three UI
points:
- `packages/app/src/components/question-dock.tsx` — normalize props.request,
  tab label fallback, option label/desc fallback, `questions.length === 0`
  error UI.
- `packages/ui/src/components/message-part.tsx` question renderer (≈L1656) —
  same normalize + unreadable state.
- `packages/opencode/src/cli/cmd/tui/routes/session/index.tsx` Question
  component (≈L2369) — same defensive normalize + unreadable match.
`ui.question.unreadable` i18n key added to all 16 locale files.

**Phase 5 — architecture + event log (DD-6)**  
Added "Tool Framework Contract" section to `specs/architecture.md` documenting:
`Tool.define` execute-receives-parsed contract, `state.input` persistence
matrix (running=raw / completed=normalized / error=raw), and the cross-runtime
single-source-of-truth pattern for the question normalizer.

## Related specs

- `specs/_archive/question-tool-input-normalization/` — the full plan-builder package (proposal, spec, design, idef0/grafcet, c4/sequence, data-schema, tasks, handoff, test-vectors, errors, observability).
- `specs/_archive/question-tool-abort-fix/` (living) — prior related spec for abort lifecycle + cache key + reason telemetry. Scope does not overlap.

## Test coverage summary

- `packages/opencode/src/tool/tool.test.ts` — 6 pass
- `packages/opencode/src/tool/question.test.ts` — 5 pass
- `packages/opencode/src/question/normalize.test.ts` — 14 pass
- `packages/opencode/src/tool/registry.normalize-lookup.test.ts` — 6 pass

Total new: 31 tests / 0 fail.

Existing pre-existing `packages/opencode/src/session/` has 5 test-isolation failures on main and beta alike (unrelated to this spec; tracked separately).

## Commits (beta/question-tool-input-normalization)

| Phase | SHA | Summary |
|---|---|---|
| 1 | `15377897d` | fix(tool): Tool.define passes parsed args to execute |
| 2 | `41509993a` | refactor(question): move normalize helpers to Question namespace |
| 3 | `a8848c720` | feat(session): persist normalized state.input on tool-result |
| 4 | `835fd139d` | feat(ui,sdk): defensive normalize across webapp and TUI renderers |
| 5 | (this commit) | docs(architecture,events): Tool Framework contract + event log |

## XDG backup

Pre-execution snapshot: `~/.config/opencode.bak-20260420-0115-question-tool-input-normalization/`. Retained until user explicitly says it can be removed.
