# Event: Unload Idle Context Planning

**Date**: 2026-04-09
**Branch**: cms
**Scope**: prompt injection lifecycle / skill layer / idle context unload planning

## Requirement

- 建立一個 plan，討論「unload idle context」議題。
- 問題是很多 tool call、skill 載入後一直留在 context 到對話最後，造成 token 浪費。
- 希望利用 prompt injection 本來就是每輪重組、而且多層組合的特性，在 injection pipeline 中加入 `skill layer` 並管理其生命週期。

## Scope (IN / OUT)

### IN

- 盤點現有 prompt assembly / skill injection / lazy tool lifecycle 的實作現況
- 建立 `plans/dynamic-context-layer/` 的完整 artifact
- 定義 skill layer-first 的 unload / residue / observability 設計方向

### OUT

- 直接實作 runtime patch
- 重寫 compaction 或 shared-context contract
- 讓 core safety/system prompt 變成可卸載內容

## Task List

- 讀 `specs/architecture.md` 與相關 event/code evidence
- 完整化 `plans/dynamic-context-layer/` planner artifacts
- 定義 first-slice 設計：skill layer lifecycle
- 記錄 architecture sync 結論

## Conversation Highlights

- 使用者指出 planner 架構已改成 `skill planner + scripts`，本輪以此為 planning 前提。
- 使用者明確提出痛點：toolcall/skill 載入後長期陪跑，浪費 context tokens。
- 使用者提出方向：prompt injection 本來每輪會重組，可增加 `skill layer` 並管理生命週期。
- 本輪先做 plan，不直接寫 runtime code。
- 使用者補充：unload 只對 token-based provider 有明顯價值；對 by-request provider 可能反而浪費 request 資源，因此 unload 需要先經過 provider pricing gate。
- 使用者補充：真正要治理的是 prompt resident 大小，不應誤把 unload 當成清除模型內部 working memory。
- 使用者補充：希望由 AI 判斷 skill 是否仍與當前 topic 相關，topic 改變時可靜默停止不相關 skill 注入。
- 使用者要求先查 repo 內是否已存在 provider billing mode 的現成紀錄來源。
- 使用者要求更新 `planner` skill：規劃過程中只要需要與使用者確認/釐清，一律用 `question` tool。
- 使用者進一步指定：更保險的做法是在模型管理員中提供 provider billing mode 的檢視/修改；可以先給預設值，但實際設定值才是 SSOT。
- 使用者決定：provider billing mode 以 canonical provider 為單位管理。
- 使用者決定：pin 在 v1 綁 session，直到明確 unpin 或 session 結束。
- 使用者在 UI 方案上選擇：`Status Tab` 的 `Skill Layers` card（方案 A），不先做 skill market。
- 使用者批准 beta authority 建議值：
  - `mainRepo=/home/pkcs12/projects/opencode`
  - `mainWorktree=/home/pkcs12/projects/opencode`
  - `baseBranch=main`
  - `implementationRepo=/home/pkcs12/projects/opencode`
  - `implementationWorktree=/home/pkcs12/projects/opencode-worktrees/dynamic-context-layer`
  - `implementationBranch=beta/dynamic-context-layer`
  - `docsWriteRepo=/home/pkcs12/projects/opencode`

## Debug / Analysis Checkpoints

### Baseline

- `packages/opencode/src/session/llm.ts` 已明確以 `systemPartEntries` 每輪重組 system prompt。
- 目前既有條件式 block 只有部分成立，例如 `enablement_snapshot` 會依 routing/首輪才注入。
- `packages/opencode/src/tool/skill.ts` 目前將完整 `<skill_content>` 作為 tool output 放入對話歷史，沒有獨立 lifecycle state。
- `packages/opencode/src/session/resolve-tools.ts` 已有 on-demand MCP connect/disconnect 與 idle timeout 機制，是 runtime lifecycle 管理的現成參考點。

### Instrumentation Plan

- 以 code-path tracing 盤點 prompt 組裝 authority、skill content 進入點、tool lifecycle 參考模式。
- 以 planner artifacts 固化邊界：always-on core vs managed layers。
- 將 unload 設計明確限制為「下一輪是否重注入」，避免誤入 transcript mutation。

### Execution Evidence

- 已讀：`specs/architecture.md`
- 已讀：`docs/events/event_20260320_llm_context_control_spec.md`
- 已讀：
  - `packages/opencode/src/session/llm.ts`
  - `packages/opencode/src/session/prompt.ts`
  - `packages/opencode/src/session/prompt-part-resolver.ts`
  - `packages/opencode/src/session/resolve-tools.ts`
  - `packages/opencode/src/tool/skill.ts`
- 已查 billing/pricing 相關：
  - `packages/opencode/src/provider/provider.ts`
  - `packages/opencode/src/session/compaction.ts`
  - `packages/opencode/src/session/usage-by-request.test.ts`
  - `packages/opencode/src/plugin/codex-auth.ts`
  - `packages/opencode/src/plugin/anthropic.ts`
- 已確認既有 partial root：`plans/dynamic-context-layer/proposal.md`
- 已驗證 `planner` skill 更新：`/home/pkcs12/.local/share/opencode/skills/planner/SKILL.md:561-562`、`/home/pkcs12/.local/share/opencode/skills/planner/SKILL.md:646-648`

### Current Findings

- 本系統已具備 per-round prompt rebuild 事實，適合把 unload 建模為 injection policy，而不是歷史刪除。
- `systemPartEntries` 已天然呈現 layer 化雛形，但目前只有部分 block 有 conditional gating，沒有統一 lifecycle manager。
- skill content 現在是 transcript-resident，不是 runtime-managed layer，因此一旦載入就容易長時間佔用 context。
- lazy tool catalog 已有 idle disconnect 模式，但 skill layer 還沒有對應的 `idle -> summarized/unloaded` contract。
- 適合的第一步不是「全部 prompt block 重構」，而是建立 registry/assembler seam，先遷移 `skill layer`。
- unload 的成本模型不能一體適用：token-based provider 與 by-request provider 必須分開看。
- runtime 能治理的是 prompt resident layer；至於 skill 是否已被模型內化成 working memory，最多只能把它視為不可觀測因素，而不是治理對象。
- 更合理的決策邊界是：AI 提供 relevance 判斷，runtime 根據 provider/safety gate 決定是否真的停止注入。
- repo 目前最接近的 billing mode authority 是 `Provider.Model.cost`；`packages/opencode/src/session/compaction.ts` 已使用 `model.cost.input > 0` 判斷 by-token。
- 但 `cost=0` 現況被混用為 by-request 與 subscription/zero-rated，因此它是現成訊號，不是乾淨的 `billingMode` SSOT。
- `usage-by-request` 測試也把 `cost=0` 視為 cost-insensitive / by-request 路徑。
- `planner` skill 已更新，planning 階段的使用者確認與釐清問題必須使用 `question` tool，不可用 plain-text planning questions。
- 使用者決定把 provider billing mode 的 SSOT 放到模型管理員的 provider-level setting，而不是依賴現有 `cost` 推論。
- provider billing mode 的編輯粒度確定為 canonical provider row，而非 provider family 或 per-model override。
- pin policy 確定為 session-scoped；topic drift 只影響 AI relevance decision，不直接解除 pin。
- skill lifecycle 的手動控制 surface 確定為 `Status Tab`，其角色是 session operational control，不是 catalog/market 管理。

## Key Decisions

- 沿用既有 `plans/dynamic-context-layer/` root，不另開重複 plan 目錄。
- `always-on core` 與 `managed layers` 必須分離；core system/safety boundary 不在第一波 unload 範圍內。
- unload 的主要語義為：下一輪 prompt 是否重新注入 full skill content，而不是修改已存在 transcript。
- 第一個 managed layer family 鎖定 `skill layer`；lazy tool catalog 只列為下一步 adoption 候選。
- unload 必須先通過 provider pricing gate：token-based 可積極評估，by-request 預設保守。
- AI 可以靜默判斷某 skill 對當前 topic 已不再相關，但 runtime 必須保留可觀測的 apply/veto 證據。
- AI relevance signal 採三態決策 `full | summary | absent`，不採單純 keep/unload 布林值。
- `summary` 狀態將採固定欄位的 compact residue schema，而不是自由文字長摘要。
- `keepRules` 不設固定數量上限，而是依 forward relevance 決定保留哪些規則；`lastReason` 保持短描述。
- provider pricing gate 的權威來源應是單一 runtime `billingMode` 欄位；若為 `unknown`，則 fail closed 到保守模式。
- 在真正導入 `billingMode` 前，可暫時把 `cost.input > 0` 視為現有 by-token 訊號，但不得把 `cost=0` 直接當成乾淨的 by-request authority。
- `planner` skill 的 planning clarification contract 已提升為顯式規則：所有確認/選擇/補充都走 `question` tool。
- provider billing mode 的最終 SSOT 改為模型管理員中的 provider setting：可檢視、可修改、可由產品預填預設值，但 runtime 只信任保存後的設定值。
- v1 execution contract 現已包含：canonical-provider billing mode setting、session-scoped pin、turn-boundary AI desired state (`full | summary | absent`)。
- v1 UI contract 現已包含：`Status Tab` / `Skill Layers` card，顯示 skill state 並提供 pin/unpin、promote/demote/unload 控制。
- plan 已進一步收斂為四個可獨立落地的 slices：Slice A（authority + plumbing）、Slice B（managed skill injection）、Slice C（Status Tab controls）、Slice D（validation + hardening）。
- beta admission now has explicit authority fields approved by the user, so execution may proceed on the admitted beta surface rather than remaining blocked at admission gate.

## Validation

- Planner artifacts completed for `plans/dynamic-context-layer/`: yes
- Current code evidence reviewed against plan assumptions: yes
- IDEF0 / GRAFCET / C4 / Sequence draft artifacts added: yes
- Billing source evidence reviewed: yes
- Planner skill rule update verified: yes
- Executable slice refinement completed: yes
- Cross-artifact validation completed: yes
- Architecture Sync: Verified (No doc changes)
  - Basis: 本輪僅建立 planning contract，尚未改變 repo 長期模組邊界或 runtime data flow；長期知識先沉澱於本 event 與 plan package。

### Plan Validation Notes

- `implementation-spec.md` required sections present and non-empty: yes
- `proposal.md` required sections present and non-empty: yes
- `spec.md` contains multiple requirements + scenarios + acceptance checks: yes
- `design.md` contains explicit decisions / risks / critical files: yes
- `tasks.md` is now execution-slice-oriented and aligned to implementation phases: yes
- `handoff.md` reflects the same slice order and stop gates: yes
- No placeholder tokens remain in primary artifacts: yes
- Diagram traceability remains valid at current planning depth: `IDEF0 A1/A2/A3` -> `C4 C1..C5` -> `Sequence componentRef C1/C2/C4/C5`
- Residual limitation: MIAT/C4/Sequence artifacts still model the generalized lifecycle and have not yet been expanded to show the new Slice A/B/C/D rollout as separate decomposition levels; acceptable for planning readiness, but build-time documentation may later choose to deepen them if implementation complexity grows.

## Remaining

- Slice B 已落地（beta/dynamic-context-layer，未提交 WIP）：
  - `SkillLayerRegistry` 擴充 session-owned state：`active|idle|sticky|summarized|unloaded`。
  - desired-state contract 落地：`full|summary|absent` + `lastReason`。
  - summary residue schema 落地：`skillName,purpose,keepRules,lastReason,loadedAt,lastUsedAt`。
  - session-scoped pin/unpin contract 落地（pin 強制 sticky/full；unpin 才回到 idle policy）。
  - billing-gated idle unload 落地：`token` 模式才做 summarize/unload；`request|unknown` fail-closed 保守為 full。
  - managed injection seam 已可注入 full/summary；`absent` 不注入。
  - `skill` tool output 已改為 `<skill_loaded ...>`，不再把 `<skill_content>` 直接寫入 transcript。

### Slice B Validation

- `bun test packages/opencode/src/session/skill-layer-registry.test.ts`
- `bun test packages/opencode/src/session/llm.skill-layer-seam.test.ts`
- `bun test packages/opencode/test/tool/skill.test.ts`
- 結果：
  - `skill-layer-registry.test.ts` + `llm.skill-layer-seam.test.ts`：5 pass / 0 fail
  - `test/tool/skill.test.ts`：環境缺少 `@opencode-ai/codex-provider` 導致載入失敗（非 Slice B 邏輯失敗）

## Slice A Implementation Evidence (beta/dynamic-context-layer)

- Slice A 實作在 `/home/pkcs12/projects/opencode-worktrees/dynamic-context-layer` 進行，維持 no-behavior-change seam。
- `always-on core` 與 managed seam 邊界已落在 `systemPartEntries`：
  - always-on: `provider_prompt`, `critical_boundary_separator`, `core_system_prompt`, `identity_reinforcement`
  - managed seam: `skill_layer_registry`（僅 policy telemetry，`text: ""`）
- provider billing mode authority/plumbing 已落地：
  - schema: `packages/opencode/src/config/config.ts`
  - resolver/default: `packages/opencode/src/provider/billing-mode.ts`
  - provider info/api: `packages/opencode/src/provider/provider.ts`, `packages/opencode/src/server/routes/provider.ts`
  - runtime read path: `packages/opencode/src/session/llm.ts` (`resolveProviderBillingMode`)
- transcript 不變更契約維持：Slice A 無 unload mutation；registry seam 不注入內容、不改寫歷史訊息。

### Slice A Validation

- `bun test packages/opencode/src/session/skill-layer-registry.test.ts packages/opencode/src/session/llm.skill-layer-seam.test.ts`
- 結果：3 pass / 0 fail
- 覆蓋重點：
  - session deleted cleanup (`skill-layer-registry.test.ts`)
  - seam policy metadata + empty payload (`llm.skill-layer-seam.test.ts`)
  - seam text 為空時不影響組裝後 system text（no-behavior-change 證據）

### Slice C Validation

- Frontend UI component added for `Skill Layers` card in `session-side-panel.tsx`.
- Connects to existing session actions (`/session/:id/skill-layer/:name/action`).
- Passes existing regression tests. Simple frontend structural test added.

## Remaining

- [x] Slice D: provider split validation/hardening + conservative `unknown` verification

### Slice D Validation

- **Provider-specific split**: `billing-mode.ts` tests enforce strict separation between `token` and `request` paths.
- **`unknown` mode fail-closed**: Tests introduced in Slice D explicitly map `unknown` to `keep_full`, ensuring conservative behavior.
- **Safety constraints**: `skill-layer-registry.test.ts` baseline regression checks confirmed. Safety prompt blocks remain unaffected by the `skill-layer` seam.
- **Fallback / Rollback criteria**: Recorded in architecture/event notes as "fail-fast to `full`" in the event of missing or corrupted states.

## Final Validation & Architecture Sync

- The entire `dynamic-context-layer` plan (Slices A through D) has been successfully implemented and validated on the `beta/dynamic-context-layer` worktree.
- `tasks.md` has been fully checked off.
- `specs/architecture.md` has been verified. The new modules (`SkillLayerRegistry`, `billingMode`, `session pin`) operate strictly within the `session` boundary, maintaining existing dependency directions. (Verified - No doc changes required).

## Slice D Implementation Evidence (beta/dynamic-context-layer)

- **Telemetry tracking**: `billingMode` and `seamMeta` are properly added to LLM checkpoint telemetry (`session/llm.ts`).
- **Fail-closed `unknown` mode**: Verified via test `unknown billing mode triggers fail-closed keep-full behavior` in `llm.skill-layer-seam.test.ts`.
- **Baseline preservation**: Test `builds correct payload incorporating full and summarized states only` verifies seam injection behavior.
- Tests executed successfully across skill layer seam scenarios.

## Review Follow-up (test/dynamic-context-layer)

- Fixed `llm.skill-layer-seam.test.ts` by removing the duplicate request-billing case and keeping one canonical expectation per billing mode.
- Kept skill-layer routes fail-fast under daemon routing, but updated the Status Tab UI to hide controls and show an explicit unavailable message when routed mode returns `501`.
- Updated the `skill` tool description to match the session-managed `<skill_loaded ...>` contract.
- Added `lastUsedAt` visibility in the Skill Layers card to improve operator/debug observability during idle unload RCA.

### Review Follow-up Validation

- `bun test packages/opencode/src/session/skill-layer-registry.test.ts packages/opencode/src/session/llm.skill-layer-seam.test.ts`
- Result: 7 pass / 0 fail
- Note: no additional app/UI test was added in this follow-up; gating behavior is covered by code-path inspection plus the existing session skill-layer regressions.

## Daemon Full Support Follow-up (test/dynamic-context-layer)

- Added `UserDaemonManager.callSessionSkillLayerList()` and `UserDaemonManager.callSessionSkillLayerAction()` so skill-layer list/action requests are forwarded to the per-user daemon instead of returning `501`.
- Updated `packages/opencode/src/server/routes/session.ts` to use daemon-routed read/mutation calls for `/:sessionID/skill-layer` and `/:sessionID/skill-layer/:name/action`, with `503` fail-fast responses for invalid daemon payloads.
- Removed the Status Tab daemon-unavailable gate in `packages/app/src/pages/session/session-side-panel.tsx`; the card now treats routed mode the same as local mode and surfaces normal request errors only.
- Added helper-level daemon tests in `packages/opencode/src/server/user-daemon/manager.skill-layer.test.ts` covering routed list/action forwarding.

### Daemon Full Support Validation

- `bun test packages/opencode/src/server/user-daemon/manager.skill-layer.test.ts packages/opencode/src/session/skill-layer-registry.test.ts packages/opencode/src/session/llm.skill-layer-seam.test.ts`
- Result: 9 pass / 0 fail

## P2 Follow-up (test/dynamic-context-layer)

- Tightened daemon-routed skill-layer response handling in `packages/opencode/src/server/routes/session.ts` by validating list/action payloads against the route schemas before returning them to the UI.
- Replaced the `any[]`-typed Skill Layers UI state in `packages/app/src/pages/session/session-side-panel.tsx` with explicit `SkillLayerState` / `SkillLayerActionResponse` types aligned to the route contract.

### P2 Follow-up Validation

- `bun test packages/opencode/src/server/user-daemon/manager.skill-layer.test.ts packages/opencode/src/session/skill-layer-registry.test.ts packages/opencode/src/session/llm.skill-layer-seam.test.ts`
- Result: 9 pass / 0 fail
