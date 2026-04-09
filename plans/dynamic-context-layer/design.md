# Design

## Context

- `packages/opencode/src/session/llm.ts` already rebuilds system prompt parts per request, which means unload should be modeled as a next-round injection decision.
- Current system parts are effectively `provider_prompt`, `agent_prompt`, `dynamic_system`, conditional `enablement_snapshot`, `user_system`, a critical boundary separator, `core_system_prompt`, and `identity_reinforcement`.
- `packages/opencode/src/tool/skill.ts` currently injects full `<skill_content>` into transcript history, so loaded skill content remains in active context until compaction.
- `packages/opencode/src/session/resolve-tools.ts` already proves the runtime can manage on-demand lifecycle with idle disconnect, but that mechanism is tool-surface-specific and does not preserve prompt residue.
- The runtime can observe prompt-resident artifacts and tool events, but it cannot directly observe whether a loaded skill has already been transformed into model-internal working memory.

## Goals / Non-Goals

**Goals:**

- Introduce a unified vocabulary for prompt-layer lifecycle.
- Make `skill layer` the first managed layer family.
- Reduce long-tail token waste from stale skill/tool prompt blocks.
- Preserve fail-fast, observability, and stable-prefix considerations.

**Non-Goals:**

- Replacing shared-context, compaction, or transcript storage.
- Making every prompt block unloadable.
- Hiding lifecycle errors behind silent fallback.

## Decisions

- Decision 1: Keep `always-on core` outside the new lifecycle manager. Candidate managed families start with `skill layer`, then optional/lazy tool-related prompt blocks.
- Decision 2: Model unload as a prompt-assembly concern, not a transcript-mutation concern.
- Decision 3: Add runtime-owned layer registry metadata per session. Minimum fields: `layerType`, `layerKey`, `state`, `sticky`, `summary`, `loadedAt`, `lastUsedAt`, `lastInjectedAt`, `reason`.
- Decision 4: Distinguish three payload forms for managed layers: `full`, `summary residue`, `absent`. The transition between them is policy-driven and observable.
- Decision 5: Reuse prompt telemetry in `llm.ts` as the first observability surface; extend block-level telemetry so managed layers show injected/skipped/summarized state.
- Decision 6: Roll out incrementally: first create registry + assembler seam, then migrate skill loading, then decide whether lazy tool catalog should become a sibling managed layer.
- Decision 7: Introduce a provider-pricing gate before unload. Token-based providers may benefit from token reduction; by-request providers remain conservative unless evidence proves otherwise.
- Decision 8: Allow AI-guided relevance decisions, but only over prompt-resident layers. The AI may judge topic drift; the runtime remains the authority that applies or vetoes the injection change.
- Decision 9: Standardize the AI relevance output as a three-state decision: `full | summary | absent`, instead of a boolean unload flag.
- Decision 10: Use a minimal structured residue schema for `summary` state. Initial fields: `skillName`, `purpose`, `keepRules`, `lastReason`, `loadedAt`, `lastUsedAt`.
- Decision 11: `keepRules` is not capped by a fixed numeric limit in v1; rule retention is determined by forward relevance, while `lastReason` remains a short description.
- Decision 12: `provider pricing mode` SSOT will live in the model manager as a provider-level setting with both view and edit capability. Runtime reads that configured value as the authority surface, while default values may be prefilled for operator override.
- Decision 13: Provider billing mode is keyed by canonical provider key, not provider family or individual model rows.
- Decision 14: `pin` in v1 is session-scoped: once pinned, a skill layer stays `full` until explicit unpin or session end.
- Decision 15: AI relevance output should be produced at turn boundary as structured per-skill desired state (`full | summary | absent`) plus short `lastReason`; runtime applies it only when the layer is unpinned and provider billing mode allows unload optimization.
- Decision 16: Manual control for skill-layer lifecycle will ship in `Status Tab` as a `Skill Layers` card, not as a separate skill market.

## Data / State / Control Flow

- Skill tool call records a runtime-owned layer entry when a skill is loaded.
- Before each model call, prompt assembly reads fixed core parts plus current layer registry and current provider pricing mode.
- Provider pricing mode is resolved from the model-manager provider setting before prompt assembly and carried as explicit runtime metadata, so unload policy reads one authoritative field rather than consulting multiple sources.
- The assembler decides, per managed layer, whether to inject `full`, inject `summary residue`, or skip entirely.
- An AI-guided relevance signal may recommend unload when topic/goal drift is detected, but pricing gate and safety gate can override that recommendation.
- When state resolves to `summary`, the assembler injects only a compact structured residue block instead of the original full skill body.
- Pinned skill layers bypass AI demotion logic and remain `full` for the session unless explicitly unpinned.
- Provider billing mode settings are persisted per canonical provider row in the model manager and read into runtime execution context before unload policy evaluation.
- `Status Tab` becomes the operator control surface for session-time skill layer lifecycle: row state, pin/unpin, promote/demote, and unload actions live there.
- `llm.prompt.telemetry` emits per-block status so idle/unload behavior is auditable.
- Future layers (lazy tool catalog, optional environment/doc governance blocks) can reuse the same registry contract without changing transcript history semantics.

## Risks / Trade-offs

- Risk: If layer ordering changes too often, prompt cache hit rate may degrade -> Mitigation: keep a stable bucket order (`always-on core` -> managed full layers -> managed residue layers).
- Risk: Poor unload policy can make the model forget important skill instructions too early -> Mitigation: support sticky/manual pinning and summary residue before full absence.
- Risk: If registry state derives from assistant prose instead of runtime events, lifecycle will drift -> Mitigation: make tool execution and prompt assembly the only authoritative state mutation surfaces.
- Risk: Big-bang migration across all blocks will raise blast radius -> Mitigation: skill layer first, other families opt in later.
- Risk: by-request providers may spend more requests because of unload/reload churn -> Mitigation: pricing-mode gate defaults these providers to stable injection unless evidence says otherwise.
- Risk: the AI may overconfidently unload a skill whose constraints still matter -> Mitigation: separate `AI recommendation` from `runtime apply`, support sticky/pin, and keep residue summaries for soft landing.
- Risk: summary residue may become too verbose and recreate the original token problem -> Mitigation: keep residue schema structured, keep `lastReason` short, and retain only rules that remain forward-relevant.
- Risk: pricing mode may drift if derived differently across modules -> Mitigation: make the model-manager provider setting the SSOT, allow operator edits, and resolve once into runtime metadata with fail-closed behavior on unset/unknown values.
- Risk: topic-aware pin semantics would be ambiguous in v1 -> Mitigation: make pin session-scoped only; topic-sensitive behavior remains part of AI relevance, not pin lifecycle.
- Risk: adding a separate skill market would blur runtime control with catalog management -> Mitigation: keep v1 UI in `Status Tab` as an operational card, separate from app/market surfaces.

## Critical Files

- `packages/opencode/src/session/llm.ts`
- `packages/opencode/src/session/prompt.ts`
- `packages/opencode/src/session/system.ts`
- `packages/opencode/src/tool/skill.ts`
- `packages/opencode/src/session/resolve-tools.ts`
- `packages/opencode/src/session/preloaded-context.ts`
