# Implementation Spec

## Goal

- 為 opencode 規劃一套 `dynamic context layer` 機制，先從 `skill layer` 開始，把 skill prompt 從 append-only context 改為 per-round managed injection，支援 idle unload 並保留最小可追溯 residue。

## Scope

### IN

- 盤點目前 per-round prompt rebuild 與 system-part assembly 的既有事實。
- 定義 `always-on core` 與 `managed layers` 的邊界。
- 規劃 skill layer 的 runtime state、activation/unload policy、residue policy。
- 規劃 lazy tool catalog 與其他可選 prompt blocks 如何逐步納入同一 lifecycle framework。
- 定義 observability / telemetry / validation contract，讓 unload 不會變成隱性行為。
- 將 provider pricing mode 納入 unload 啟用門檻：token-based 預設可評估，by-request 預設保守。

### OUT

- 直接改寫 message history compaction 或 shared-context V2 contract。
- 一次重構所有 prompt block 類型。
- 修改 provider transport、模型 API 或 prompt caching 底層協議。
- 以 fallback 方式偷偷保留舊 skill 注入，掩蓋 lifecycle state 錯誤。

## Assumptions

- 現行 runtime 已是 per-round tool resolve/inject 與 system prompt rebuild，因此 idle unload 的主切點應該是「下一輪不再重注入」，而不是去修改已存在的歷史 message。
- `packages/opencode/src/session/llm.ts` 已是 system part assembly authority，適合作為 managed layer assembler 的主要掛載點。
- `packages/opencode/src/tool/skill.ts` 現在只會把 `<skill_content>` 輸出放進對話歷史，尚未有 session-owned skill lifecycle state，可在此補 runtime metadata。
- `packages/opencode/src/session/resolve-tools.ts` 的 on-demand MCP idle disconnect 是可借鏡的 lifecycle 模式，但不能直接複製到 skill layer；skill unload 需要保留 residue 與 prompt-cache-aware ordering。
- skill 是否已被 AI 轉成 working memory 並不是 runtime 可直接觀測的事實；runtime 能治理的是 prompt resident layer，而不是模型內部已吸收後的不固定記憶形狀。
- by-request provider（例如 GitHub Copilot 類型）可能因 unload/reload 增加 request 成本，因此不能套用 token-based 的同一套積極策略。
- provider pricing mode 應由模型管理員中的 provider-level 設定提供 SSOT；runtime 在早期讀取該值並帶入 execution context，而不是在各模組臨時猜測。
- provider billing mode 的 key 應對齊 canonical provider key，避免 family/model 粒度混淆。
- pin 的 v1 contract 採 session scope，避免 topic 邊界判斷把 pin 語義變得不穩定。
- skill layer 的手動控制 UI 在 v1 採 `Status Tab` card，而不是新增 skill market / catalog surface。

## Stop Gates

- 若方案需要讓 `core_system_prompt`、`critical_boundary_separator`、identity reinforcement 變成可卸載內容，必須停止並重新確認安全邊界。
- 若 unload policy 需要依賴模型自己記住「剛才載入過哪個 skill」而沒有 runtime-owned state，必須停止；這會造成不可觀測漂移。
- 若 skill unload 只能靠修改舊 message 或刪除 transcript 來實現，必須停止；本案以 prompt injection lifecycle 為主，不觸碰歷史真相。
- 若設計會破壞 stable prefix/cache 命中，必須回到 planning 重新排序 layer bucket 與 residue 位置。
- 若 provider pricing mode 無法判定，必須停在保守模式，而不是預設開啟 aggressive unload。
- 若 pricing mode 需要透過多個模組臨時推論才知道，必須回到 planning 先建立單一 authority 欄位，避免後續漂移。
- 若模型管理員尚未持有 provider billing mode 設定，應以產品預設值填入，但保存後仍以該設定值為 SSOT。

## Critical Files

- `packages/opencode/src/session/llm.ts`
- `packages/opencode/src/session/prompt.ts`
- `packages/opencode/src/session/system.ts`
- `packages/opencode/src/tool/skill.ts`
- `packages/opencode/src/session/resolve-tools.ts`
- `packages/opencode/src/session/preloaded-context.ts`
- `specs/architecture.md`
- `docs/events/event_20260409_unload_idle_context_planning.md`

## Structured Execution Phases

- Phase 1 (Slice A — Authority + Plumbing): add provider billing mode SSOT in model manager, resolve it into runtime execution context, and introduce a no-behavior-change skill-layer registry/telemetry seam.
- Phase 2 (Slice B — Managed Skill Injection): migrate skill loading from transcript-dependent full prompt residency to runtime-managed skill layers with AI desired-state output (`full | summary | absent`) and session-scoped pin semantics.
- Phase 3 (Slice C — Operator Control Surface): add `Status Tab` → `Skill Layers` card showing state/pin/reason and supporting manual pin/unpin, promote, demote, and unload actions.
- Phase 4 (Slice D — Validation + Hardening): verify token-based vs by-request behavior, conservative `unknown` handling, prompt-cache impact, continuity/regression evidence, and decide whether lazy tool catalog should become the next managed layer family.

## Validation

- Verify the plan against current code evidence in `llm.ts`, `prompt.ts`, `skill.ts`, and `resolve-tools.ts`.
- Ensure every unload path is runtime-observable: layer state, last-used evidence, injected/skipped token telemetry, and explicit residue content。
- Ensure the design keeps `always-on` safety/system contract outside managed unload scope.
- Ensure Slice A can land without rewriting compaction/history contracts.
- Ensure the migration plan is incremental: skill layer first, no mandatory big-bang rewrite.
- Ensure provider pricing mode is part of the decision path so by-request providers stay conservative by default.
- Ensure `summary` residue stays fixed-width and does not regress into a second full skill prompt.
- Ensure each slice is independently shippable and leaves the runtime in a valid state.

## Handoff

- Build agent must read this spec first.
- Build agent must read `proposal.md`, `spec.md`, `design.md`, and `tasks.md` before coding.
- Build agent must materialize runtime todo from `tasks.md` before coding.
- Conversation memory is supporting context only, not the execution source of truth.
- Same-workstream changes stay inside `plans/dynamic-context-layer/` unless the user explicitly approves a new plan root.
