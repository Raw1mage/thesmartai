# Tasks: claude-provider-beta-fingerprint-realign

Execution order is phase-by-phase. Each phase ends with a slice summary into `docs/events/`.

## 1. Predicate helpers + constants

- [ ] 1.1 Add `redact-thinking-2026-02-12` exported constant in `protocol.ts`
- [ ] 1.2 Add `MANTLE` to `ProviderRoute` enum / type union in `protocol.ts`
- [ ] 1.3 Implement `isHaikuModel(modelId)` helper (lowercased substring match)
- [ ] 1.4 Implement `isFirstPartyish(provider)` helper for `{firstParty, anthropicAws, foundry, mantle}`
- [ ] 1.5 Implement `modelSupportsContextManagement(modelId, provider)` per DD-12 (foundry → true ; firstPartyish → !claude-3- ; else → opus-4/sonnet-4/haiku-4 contains)
- [ ] 1.6 Update `supports1MContext(modelId)` to keep current prefix list; verify `claude-opus-4-7` still matches (added in 4f6039bf1)
- [ ] 1.7 Each helper carries a single-line comment `// upstream: <minifiedName> (cli.js@<offset>)` per DD-2

## 2. Push ladder rewrite

- [ ] 2.1 Extend `AssembleBetasOptions` with `provider`, `showThinkingSummaries`, `disableExperimentalBetas`, `isInteractive`, `disableInterleavedThinking` (DD-3, DD-13)
- [ ] 2.2 Remove the `MINIMUM_BETAS` exported constant and any internal use (DD-1)
- [ ] 2.3 Rewrite `assembleBetas()` body as a structurally-ordered conditional push ladder following spec.md Requirement 4
- [ ] 2.4 Each push site carries `// upstream: <push order N> (cli.js ZR1@3482150)` comment
- [ ] 2.5 Add `// RESERVED:` slot comments at positions 7 and 8 for structured-outputs / web-search (DD-6)
- [ ] 2.6 Preserve existing dedup-final-step semantics (`[...new Set(arr)]`)
- [ ] 2.7 Verify no other file in `packages/opencode-claude-provider/` references `MINIMUM_BETAS` (R-2)

## 3. Call-site plumbing

- [ ] 3.1 Extend `BuildHeadersOptions` in `headers.ts` with the same new fields (1:1 forwarding)
- [ ] 3.2 In `provider.ts` doStream, read `process.env.CLAUDE_CODE_DISABLE_EXPERIMENTAL_BETAS` and `process.env.DISABLE_INTERLEAVED_THINKING` once, resolve to booleans, forward
- [ ] 3.3 In `provider.ts` doStream, hardcode `provider: "firstParty"` (DD-4) and `isInteractive: false` (DD-17)
- [ ] 3.4 Remove any code path or fallback that would set `isOAuth: false` (DD-16); the call site always forwards `isOAuth: true` and a unit test asserts this
- [ ] 3.5 Resolve `showThinkingSummaries` from `callOptions.providerOptions?.showThinkingSummaries` if present, default `false`

## 4. Tests + datasheet sync

- [ ] 4.1 Create `packages/opencode-claude-provider/test/protocol.test.ts` (new file)
- [ ] 4.2 Implement test that loads `specs/claude-provider-beta-fingerprint-realign/test-vectors.json` and asserts `assembleBetas(input).toEqual(expected)` per case
- [ ] 4.3 Add a guardrail test asserting `provider.ts` always forwards `isOAuth: true` (DD-16) — grep-based or runtime spy
- [ ] 4.4 Run `bun test packages/opencode-claude-provider/` and confirm green
- [ ] 4.5 Update `plans/claude-provider/protocol-datasheet.md` § 9 with v2.1.112 push-order ladder + cli.js offset citations
- [ ] 4.6 Add a "Research outcomes" pointer in protocol-datasheet.md to `specs/claude-provider-beta-fingerprint-realign/design.md` § Research Outcomes
- [ ] 4.7 Bump `protocol-datasheet.md` doc-version header to reflect v2.1.112 reference
- [ ] 4.8 Manual end-to-end: capture `anthropic-beta` header from a live opencode request, diff against expected for the matching scenario; record evidence in `docs/events/event_<YYYYMMDD>_claude-provider-beta-realign.md`

## 5. Verification + commit gate

- [ ] 5.1 `bun test packages/opencode-claude-provider/` green
- [ ] 5.2 `grep -rc "MINIMUM_BETAS" packages/opencode-claude-provider/src/` returns 0 (R-2)
- [ ] 5.3 No new dependency on `@ai-sdk/anthropic` introduced (`grep -r "@ai-sdk/anthropic" packages/opencode-claude-provider/`)
- [ ] 5.4 `bun --bun tsc --noEmit packages/opencode-claude-provider/src/*.ts` reports no NEW errors (the pre-existing `Set<string>` iteration error is allowed to remain)
- [ ] 5.5 Final commit groups all changes; message references this spec slug
- [ ] 5.6 Promote spec state `implementing → verified` after commit + manual diff evidence captured
