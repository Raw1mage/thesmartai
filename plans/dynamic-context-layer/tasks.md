# Tasks

## 1. Slice A — Authority + plumbing

- [x] 1.1 Verify and document immutable `always-on core` prompt blocks versus managed skill-layer candidates
- [x] 1.2 Add provider billing mode visibility/editing in model manager using canonical provider rows
- [x] 1.3 Persist provider billing mode as the provider-level SSOT with product-provided defaults
- [x] 1.4 Resolve saved provider billing mode into runtime execution context (`token | request | unknown`)
- [x] 1.5 Add a no-behavior-change skill-layer registry and telemetry seam
- [x] 1.6 Verify transcript history remains source evidence only and is not mutated for unload

## 2. Slice B — Managed skill injection

- [x] 2.1 Define the session-owned skill layer state schema (`active`, `idle`, `sticky`, `summarized`, `unloaded`)
- [x] 2.2 Define load/use/idle/unload transitions and who is allowed to mutate each transition
- [x] 2.3 Formalize the three-state AI desired-state contract: `full | summary | absent` + short `lastReason`
- [x] 2.4 Define v1 summary residue schema (`skillName`, `purpose`, `keepRules`, `lastReason`, `loadedAt`, `lastUsedAt`)
- [x] 2.5 Define relevance-based `keepRules` retention and short-form `lastReason` policy
- [x] 2.6 Lock pin semantics to session scope for v1
- [x] 2.7 Migrate `skill` tool output from transcript-dependent full residency to managed skill-layer injection

## 3. Slice C — Status Tab operator controls

- [x] 3.1 Add a `Skill Layers` card to `Status Tab`
- [x] 3.2 Show each skill row's state (`full | summary | absent`), pin status, and short `lastReason`
- [x] 3.3 Add manual controls for pin/unpin, promote, demote, and unload
- [x] 3.4 Keep this surface operational only; do not expand it into a skill market/catalog in v1

## 4. Slice D — Validation + hardening

- [x] 4.1 Define prompt-cache / token / correctness benchmarks for before-vs-after comparison
- [x] 4.2 Define regression checks for safety/system prompt preservation
- [x] 4.3 Define migration/rollback criteria if skill unload causes continuity regressions
- [x] 4.4 Define provider-specific evaluation so by-request providers are measured separately from token-based providers
- [x] 4.5 Verify `unknown` pricing mode fails closed to conservative behavior
- [x] 4.6 Decide whether lazy tool catalog should become the next managed layer family after skill layer stabilizes

## 5. Documentation / governance

- [x] 5.1 Keep `docs/events/event_20260409_unload_idle_context_planning.md` aligned with planning decisions
- [x] 5.2 Verify `specs/architecture.md` sync status and update only if module boundaries actually change during implementation
