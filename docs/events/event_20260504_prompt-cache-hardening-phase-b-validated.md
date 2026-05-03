# Event: 2026-05-04 — prompt-cache-and-compaction-hardening Phase B validated

## Summary

Phase B (`specs/prompt-cache-and-compaction-hardening`) implementation complete on `beta/prompt-cache-hardening-phase-b`. Direct-ship architecture (no feature flag, sole path); validation gate green; ready for user finalize approval.

## Phase B commits (in beta worktree)

```
21a08ad2e feat(compaction): Phase B.7 — persist skillSnapshot on anchor metadata
7ded02fb6 feat(plugin):     Phase B.6 — chat.context.transform hook + assembly telemetry
206d449da feat(provider):   Phase B.5 — 4-breakpoint cache allocator (DD-3)
ec3cd5d0f feat(llm):        Phase B.4 — refactor llm.ts to static block + context preface
27837b467 feat(session):    Phase B.3 — static system block builder + family resolver
8a458f115 feat(session):    Phase B.2 — decompose dynamic content into structured parts
86f3bfd93 feat(session):    Phase B.1.3 — context-preface-types pure types module
1c7194055 feat(message-v2): Phase B.1 — schema preludes (DD-5 + DD-9)
```

Plus on main (docs):
```
ad18df79f docs: Phase B — rewrite prompt_injection.md + new prompt_dynamic_context.md
```

## What landed

| Area | Concrete change |
|---|---|
| Schema (DD-5 + DD-9) | `MessageV2.User.kind = z.literal("context-preface").optional()` + `CompactionPart.metadata = { skillSnapshot, pinnedByAnchor }.optional()`. Both back-compat with pre-Phase-B sessions. |
| Pure types (DD-1) | `context-preface-types.ts` defines `ContextPrefaceParts`, `PreloadParts`, `PrefaceContentBlock`, `PREFACE_DIRECTIVE_HEADER` (R1 mitigation directive), `CONTEXT_PREFACE_KIND`. |
| Producers (DD-1, DD-2) | `getPreloadParts` (cwd+README structured), `SystemPrompt.environmentParts` (date split out of env). |
| Builder (DD-1, DD-2, DD-4, DD-5) | `buildPreface(input)` pure function, slow-first tier order, R1 directive baked in (no A/B), T2 omit not relocate. |
| Static system block (DD-12, DD-15, DD-16) | `buildStaticBlock(tuple)` for L1+L2+L3c+L5+L6+L7+L8 with sha256 hash; `resolveFamily` fail-loud against `Account.knownFamilies`. |
| Skill partition (DD-1) | `SkillLayerRegistry.partitionForPreface(entries)` → `{pinned, active, summarized, dropped}` sorted for byte determinism. |
| llm.ts refactor (DD-12) | Replaces 9-layer join with two-track output: 1 static system message + 1 user-role context-preface message. Lite provider path unchanged (DD-14). Subagents skip AGENTS.md. Gemini behavioral_guidelines optimization preserved. |
| 4-BP allocator (DD-3) | `applyCaching` honors `_phaseBBreakpoint` markers on T1-end and T2-end blocks; legacy "last block of message" rule skips messages with explicit Phase B marks to avoid double-counting. Cap = 4 BPs in all cases. |
| Plugin hook (DD-11) | New `experimental.chat.context.transform` receives `{preface: {t1, t2}, trailingExtras}` for plugin mutation before serialization. Old `chat.system.transform` now sees only static block. |
| Cache miss diagnostic (DD-10 amended) | `recordSystemBlockHash` now feeds `staticBlock.hash` instead of `system.join("\n")` for sharper churn detection. |
| Skill anchor disk persistence (DD-9 amended) | `annotateAnchorWithSkillState` writes snapshot to `CompactionPart.metadata.skillSnapshot` + `pinnedByAnchor`. Telemetry log retained as backup signal. |
| Docs | `docs/prompt_injection.md` rewritten for two-track architecture (pre-Phase-B 9-layer model preserved as historical §1.1); new `docs/prompt_dynamic_context.md` companion doc. |

## Validation results

**Test sweep** (in beta worktree with `.beta-env/activate.sh` sourced):

| Scope | Beta (Phase B) | Main (baseline) | Delta |
|---|---|---|---|
| `packages/opencode/src/session/` + `provider/` + `account/` | 392 pass / 20 fail / 1 error | 343 pass / 20 fail / 1 error | +49 new tests, all green; **zero new regressions** |

The 20 fails are pre-existing (Session.getUsage timing fragility, prepareCommandPrompt subtest, session execution identity revision, etc.) — same set on main pre-Phase-B.

**Typecheck**: `bunx tsc --noEmit -p packages/opencode/tsconfig.json` — only pre-existing `share-next.ts` Part/FilePart noise (same on main since Phase A).

**Spec-relevant focused sweep** (anchor-sanitizer + idle-gate + cross-account + skill-anchor-binder + cache-miss-diagnostic + capability-layer + skill-layer-registry + compaction-run + compaction.regression-2026-04-27 + compaction.phase-a-wiring + message-v2.context-preface + message-v2.compaction-skill-snapshot + context-preface + static-system-builder + transform.applyCaching + llm.skill-layer-seam): **160+ tests pass / 0 fail**.

## R1 mitigation status

Per Phase B v2 recalibration on 2026-05-04, R1 (LLM treats user-role context as chitchat) is mitigated **by design** rather than by post-hoc A/B test:

```
T1 first line = "## CONTEXT PREFACE — read but do not echo"
```

baked into `context-preface.ts buildPreface`. Test `directive is present even with all-empty input` pins this contract.

## What's NOT in this merge

- Cache hit/miss telemetry events from provider response headers (`prompt.cache.{system,preface.t1,preface.t2}.{hit,miss}`) — deferred to a follow-up; `cachedInputTokens` in `Session.getUsage` already provides the coarser signal.
- Plugin `experimental.chat.system.transform` deprecation warning when injecting dynamic content — one-release compatibility window, follow-up commit.
- `specs/architecture.md` Phase B section update — minor doc, can land alongside other arch updates.

## Next steps (operator)

1. **Review** Phase B commits + docs (this event).
2. **Approve finalize** to trigger B.10:
   - `git merge --no-ff beta/prompt-cache-hardening-phase-b` into main
   - `plan-promote --to verified` then re-promote to `living` (already `living` from Phase A; will move forward via amend with new history entry)
   - `git worktree remove` + `git branch -d` cleanup
3. **Monitor** cache hit rate via `prompt.preface.assembled` log events + `cachedInputTokens` in usage telemetry.
4. **Schedule** a 2-week follow-up agent (optional) to evaluate the deprecation window for legacy plugin hook injection.

## Files touched

| File | Phase B commit |
|---|---|
| `packages/opencode/src/session/message-v2.ts` | B.1 |
| `packages/opencode/src/session/context-preface-types.ts` (NEW) | B.1 |
| `packages/opencode/src/session/preloaded-context.ts` | B.2 |
| `packages/opencode/src/session/system.ts` | B.2 |
| `packages/opencode/src/session/context-preface.ts` (NEW) | B.2, B.4, B.6 |
| `packages/opencode/src/session/static-system-builder.ts` (NEW) | B.3 |
| `packages/opencode/src/session/skill-layer-registry.ts` | B.4 |
| `packages/opencode/src/session/llm.ts` | B.4, B.5, B.6 |
| `packages/opencode/src/session/prompt.ts` | B.4 |
| `packages/opencode/src/session/compaction.ts` | B.7 |
| `packages/opencode/src/provider/transform.ts` | B.5 |
| `packages/plugin/src/index.ts` | B.6 |
| `docs/prompt_injection.md` | B.8 |
| `docs/prompt_dynamic_context.md` (NEW) | B.8 |

Plus 7 new test files (~50 new unit tests).

## Reference

- Spec: [specs/prompt-cache-and-compaction-hardening/](../../specs/prompt-cache-and-compaction-hardening/) (state=living)
- Phase A landed event: [event_20260503_prompt-cache-hardening-phase-a-landed.md](./event_20260503_prompt-cache-hardening-phase-a-landed.md)
- Recalibration v1 (2026-05-03): commit `660f652c4`
- Recalibration v2 (2026-05-04, direct-ship): commit `5430bf32d`
