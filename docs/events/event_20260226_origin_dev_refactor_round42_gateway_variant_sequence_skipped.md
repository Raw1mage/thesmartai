# Event: origin/dev refactor round42 (gateway/openrouter variant sequence)

Date: 2026-02-26
Status: In Progress

## 1) Goal

Evaluate upstream gateway/openrouter variant-mapping sequence for provider transform behavior under cms constraints.

## 2) Candidate(s)

- `759ec104b6e537235afd3177acd28b6c9694e496`
  - `fix vercel gateway variants`
- `933a491adeeed875d3ba4cbc88ed301a60456734`
  - `fix: ensure vercel variants pass amazon models under bedrock key`
- `839c5cda12fa978d4c7ba85c7cf51600ec853bc8`
  - `fix: ensure anthropic models on OR also have variant support`

## 3) Decision + rationale

- Decision: **Skipped** (all three)
- Rationale:
  - Sequence introduces intertwined behavior across provider transform variants/options mapping plus openrouter patch maintenance.
  - Current cms provider layer has heavy local divergence (multi-provider rotation/custom routing), making direct partial adoption high-risk without a dedicated provider test batch.
  - Defer to focused provider-integration round with targeted transform tests and patch lifecycle validation.

## 4) File scope reviewed

- `packages/opencode/src/provider/transform.ts`
- `packages/opencode/test/provider/transform.test.ts` (upstream reference)
- `patches/@openrouter%2Fai-sdk-provider@1.5.4.patch` (upstream reference)

## 5) Validation plan / result

- Validation method: sequence-level upstream diff analysis and local provider transform architecture comparison.
- Result: skipped for this stream; schedule as dedicated provider hardening batch.

## Architecture gate

- Checked `docs/ARCHITECTURE.md` before decision.
- No architecture change applied.
