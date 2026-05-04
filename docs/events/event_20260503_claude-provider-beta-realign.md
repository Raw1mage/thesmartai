# Event 2026-05-03: claude-provider beta-fingerprint realign — execution log

Spec: `specs/_archive/claude-provider-beta-fingerprint-realign/`
Beta worktree: `/home/pkcs12/projects/opencode-worktrees/claude-provider-realign`
Beta branch: `beta/claude-provider-realign` (forked from main @ `77b7787e6`)

## Phase 1 — Predicate helpers + constants (DONE)

**Tasks:** 1.1 – 1.7
**File touched:** `packages/opencode-claude-provider/src/protocol.ts`

### Done

- `BETA_*` named constants for all 9 + 1 (new) flag strings; each line carries `// upstream: <minifiedName>` traceback
- New `BETA_REDACT_THINKING = "redact-thinking-2026-02-12"` (was missing entirely pre-realign)
- New `ProviderRoute` type union including `mantle` (per upstream `$Q()` set)
- New `FIRST_PARTYISH` Set + `isFirstPartyish(provider)` helper
- New `isHaikuModel(modelId)` (lowercased substring match)
- New `modelSupportsContextManagement(modelId, provider)` implementing the full `iO_(q)` decision tree (foundry → true ; firstPartyish → !claude-3- ; else → opus-4/sonnet-4/haiku-4 contains)
- `supports1MContext` and `supportsThinking` annotated with upstream traceback comments
- `AssembleBetasOptions` extended (additive only — old fields preserved) with `provider`, `showThinkingSummaries`, `disableExperimentalBetas`, `disableInterleavedThinking`, `isInteractive`
- `MINIMUM_BETAS` marked `@deprecated`; the constant is retained one phase longer because the legacy `assembleBetas()` body still consumes it. Removal happens in Phase 2.

### Key decisions captured during phase

None new — Phase 1 implemented DD-1 through DD-15 as already documented in design.md. No spec drift detected (plan-sync: clean).

### Validation

- `bun --bun x tsc --noEmit` against `protocol.ts`: only the pre-existing `Set<string>` iteration warning at the legacy `assembleBetas` body line. Phase 1 introduces zero new TS errors.
- All 7 task checkboxes flipped on completion (no batch).

### Drift

None. plan-sync reports clean.

### Remaining before next state promotion

Phases 2–5 (push-ladder rewrite, call-site plumbing, tests + datasheet, verification + commit). The `verified` promotion gate also requires the manual end-to-end header diff from a live request — Task 4.8.

## Phase 2 — Push ladder rewrite (DONE)

**Tasks:** 2.1 – 2.7
**Files touched:** `packages/opencode-claude-provider/src/protocol.ts`, `src/index.ts`

### Done

- `MINIMUM_BETAS` deleted from `protocol.ts` and from `index.ts` re-exports (DD-1). Zero remaining references in `packages/opencode-claude-provider/` (verified by grep).
- `assembleBetas()` body rewritten as structurally-ordered conditional ladder mirroring upstream `ZR1` (cli.js@3482150). Push order positions 1–10 documented inline; positions 7 (structured-outputs) and 8 (web-search) marked `RESERVED` per DD-6.
- Each push site annotated with `// N. <flag> — upstream ZR1 step N` so future bumps can mechanically re-grep.
- New gates active: haiku exemption on flag 1, `ja()`-equivalent on flags 5+9, `provider==="firstParty"` on flag 6 (note: NOT isFirstPartyish — foundry/anthropicAws drop out here per upstream branch).
- Out-of-band feature flags (fast-mode, effort, task-budgets) preserved as opencode-side feature plumbing — they are not part of upstream ZR1 but kept to avoid accidental capability removal.
- Dedup preserved; switched syntax from `[...new Set(arr)]` to `Array.from(new Set(arr))` to dodge the pre-existing `--target` warning that was sitting on this line in the previous implementation.
- New exports added to `index.ts`: `BETA_*` constants × 10, `isFirstPartyish`, `isHaikuModel`, `supports1MContext`, `supportsThinking`, `modelSupportsContextManagement`, type `ProviderRoute`.

### Validation

- `bun --bun x tsc --noEmit protocol.ts` reports zero new errors. The previous pre-existing `Set<string>` iteration warning is gone (resolved as a side effect of the dedup-syntax change).
- `grep -rn MINIMUM_BETAS packages/opencode-claude-provider/` returns nothing.

### Drift

None. plan-sync clean (it tracks docsWriteRepo only; beta-worktree edits are by design invisible to it until fetch-back).

### Remaining before next state promotion

Phases 3 (call-site plumbing in headers.ts + provider.ts), 4 (tests + datasheet), 5 (verification + commit gate).

## Phase 3 — Call-site plumbing (DONE)

**Tasks:** 3.1 – 3.5
**Files touched:** `packages/opencode-claude-provider/src/headers.ts`, `src/provider.ts`

### Done

- `BuildHeadersOptions` extended with `provider`, `showThinkingSummaries`, `disableExperimentalBetas`, `disableInterleavedThinking`, `isInteractive`. Forwarded 1:1 into `assembleBetas`.
- `provider.ts` doStream now resolves env vars once at the call site (not inside library helpers per DD-5):
  - `disableExperimentalBetas: !!process.env.CLAUDE_CODE_DISABLE_EXPERIMENTAL_BETAS`
  - `disableInterleavedThinking: !!process.env.DISABLE_INTERLEAVED_THINKING`
- Deployment posture hardcoded: `provider: "firstParty"`, `isInteractive: false`.
- `showThinkingSummaries` resolved from `callOptions.providerOptions?.showThinkingSummaries` with `!!` coercion (default false).
- **OAuth-only enforcement (DD-16)**: replaced the previous `isOAuth = creds.type === "oauth" || creds.type === "subscription"` boolean derivation with a **fail-loud guard**: if creds.type is anything else, `throw new Error(...)` with a DD-16 reference. The call site then unconditionally forwards `isOAuth: true`. There is no longer any code path that produces `isOAuth: false` from a real credential — that branch is reachable only via direct unit tests of `assembleBetas`.

### Validation

- `bun --bun x tsc --noEmit` against the four touched files reports zero errors.
- `creds.type` guard preserves the existing behavior (legacy `oauth` and `subscription` types both pass) but now panics on any other value rather than silently flipping to API-key path.

### Drift

None.

### Remaining before next state promotion

Phase 4 (matrix unit tests + datasheet sync) and Phase 5 (final verification + commit). The `verified` promotion still requires Task 4.8 (manual end-to-end header diff from a live request).

## Phase 4 + 5 — Tests, datasheet, commit (DONE)

**Tasks:** 4.1 – 4.7 (4.8 below), 5.1 – 5.5 (5.6 below)
**Files touched in beta:** `packages/opencode-claude-provider/test/protocol.test.ts` (NEW),
`plans/claude-provider/protocol-datasheet.md` (§ 11 added)
**Commit on beta/claude-provider-realign:** `0c8b51db4`

- 32 matrix tests pass (22 vectors + 10 helper/guardrail). All scenarios in `test-vectors.json` match `assembleBetas` output.
- protocol-datasheet.md § 11 records the canonical push order with cli.js offset citations and opencode-specific posture (DD-16, DD-17).
- `MINIMUM_BETAS` removed; verified by grep.
- No `@ai-sdk/anthropic` introduced (only the pre-existing comment "Does NOT depend on @ai-sdk/anthropic").
- `tsc --noEmit` reports zero errors across the four touched src + test files.

## Phase 4.8 — Manual end-to-end header capture (DONE)

**Mode:** in-beta header capture via `scripts/inspect-beta-header.ts`.
**Why not full daemon restart:** mainRepo carries 30 dirty files from unrelated ongoing work; switching to a test branch would force-stash them and risk loss. The script reproduces the exact call chain `provider.ts:doStream → buildHeaders → assembleBetas` with production-equivalent options and dumps the actual `Headers` instance's `anthropic-beta` value. This captures real wire bytes; the only step skipped is the TCP send to api.anthropic.com (irrelevant for fingerprint correctness).

**Inputs (production-equivalent posture per DD-4, DD-16, DD-17):**
```
modelId: "claude-opus-4-7"
isOAuth: true
provider: "firstParty"
isInteractive: false
showThinkingSummaries: false
disableExperimentalBetas: false
disableInterleavedThinking: false
```

**Captured wire bytes:**
```
User-Agent       : claude-code/2.1.126
anthropic-version: 2023-06-01
anthropic-beta   : claude-code-20250219,oauth-2025-04-20,context-1m-2025-08-07,interleaved-thinking-2025-05-14,context-management-2025-06-27,prompt-caching-scope-2026-01-05
```

**Expected (test-vector "opencode-default: opus-4-7 + OAuth + firstParty + non-interactive"):** identical above.

**Result:** ✅ byte-equivalent. Diff is empty. Realign achieves wire-fingerprint parity for opencode's runtime configuration.
