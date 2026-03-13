# Event: planner sync from autorunner

Date: 2026-03-13
Status: Completed
Branch: cms
Workspace: /home/pkcs12/projects/opencode

## 需求

- 將 `/home/pkcs12/projects/opencode-runner`（`autorunner`）中已完成的 planner reactivation / OpenSpec-grade contract 變更同步到 CMS repo（`/home/pkcs12/projects/opencode`，`cms`）。
- 同步完成後，於 runner 與 cms 各自建立 commit。
- CMS commit 需包含使用者先前已同意一併提交的既有文件變更：
  - `docs/events/event_20260310_webapp_scroll_ownership_refactor.md`
  - `docs/events/event_20260313_add_openspec_submodule.md`

## 範圍 (IN / OUT)

### IN

- planner runtime 與 prompt routing 相關程式檔
- planner tests
- planner specs/events 文件
- runner / cms 兩邊各自 commit

### OUT

- 非 planner 領域的額外功能開發
- 新增 fallback 機制
- push / PR

## 任務清單

- [x] 讀取 runner/cms 架構文件與本次相關事件
- [x] 確認 runner planner 變更集合與 CMS 現況差異
- [x] 套用 runner planner 變更到 CMS
- [x] 跑 runner/cms 目標測試並修正
- [x] 完成 runner commit
- [x] 完成 CMS commit（含指定既有 docs 變更）

## Debug Checkpoints

### Baseline

- runner 端已存在完整 planner 強化變更（plan artifacts + gating + auto-plan routing + tests）。
- 先前一次 subagent 回報「已同步 CMS」經主代理直接查核後證實為未落地，CMS 檔案仍為舊版。
- 因此本輪採「主代理直接檔案比對 + 直接落地 + 直接驗證」避免假陽性同步。

### Instrumentation Plan

- 以 runner 變更檔清單為準，逐一對照 CMS 同路徑檔案。
- 針對高風險檔（`plan.ts`, `prompt.ts`, `session/index.ts`, `registry.ts`, tests）做實際內容覆寫後再用 targeted tests 驗證。
- 以 `git status --short`、`git diff --name-only`、測試結果、以及 event 記錄作為完成證據。

### Execution

- 先以主代理直接比對 runner / cms 同路徑檔案，確認前一次「已同步」回報存在假陽性。
- 之後以 runner 為來源，將 planner runtime / prompt / registry / tests / specs / events 同步到 CMS。
- 針對高風險檔案（`packages/opencode/src/tool/plan.ts`、`packages/opencode/src/session/prompt.ts`、`packages/opencode/src/session/index.ts`、`packages/opencode/src/tool/registry.ts`、`packages/opencode/test/tool/registry.test.ts`）再次做直接內容核對。
- CMS 額外保留並納入使用者預先批准的既有 event 變更：
  - `docs/events/event_20260310_webapp_scroll_ownership_refactor.md`
  - `docs/events/event_20260313_add_openspec_submodule.md`
- runner 與 cms 皆完成 targeted planner 測試後，分別建立 local commit。

### Root Cause

- 本輪的實際根因不是 planner 程式本身故障，而是先前同步流程缺少「主代理直接落地驗證」：subagent 曾回報 CMS 已同步，但主代理直接查核後發現同路徑檔案仍為舊版。
- 造成假完成的關鍵鏈條為：
  1. 以 subagent 成功訊息取代檔案真實狀態檢查
  2. 未在 CMS 端直接比對高風險 planner 檔案內容
  3. 若直接進入 commit，會把「runner 已更新、CMS 未實際落地」誤判成同步完成
- 修正策略是改採 evidence-first：主代理直接比對、直接同步、直接跑 CMS 測試，再進 commit。

### Validation

- CMS targeted planner validation：
  - `bun test "/home/pkcs12/projects/opencode/packages/opencode/test/session/planner-reactivation.test.ts" "/home/pkcs12/projects/opencode/packages/opencode/test/tool/registry.test.ts" "/home/pkcs12/projects/opencode/packages/opencode/src/session/todo.test.ts"`
  - 結果：26 pass / 0 fail ✅
- runner targeted planner validation：
  - `bun test "/home/pkcs12/projects/opencode-runner/packages/opencode/test/session/planner-reactivation.test.ts" "/home/pkcs12/projects/opencode-runner/packages/opencode/test/tool/registry.test.ts" "/home/pkcs12/projects/opencode-runner/packages/opencode/src/session/todo.test.ts"`
  - 結果：pass ✅
- `git status --short --branch` 已確認 runner / cms 都只剩本輪 planner / docs / submodule 相關待提交變更。✅
- 本 event 對應 commit 完成後，runner 與 cms 均各自具備本輪 planner sync 的獨立提交證據。✅

## Architecture Sync

- Architecture Sync: Verified (No doc changes)
- 比對依據：本輪 CMS 主要變更為把 runner 已存在的 planner reactivation / OpenSpec-grade artifact contract 同步進來，未新增新的系統邊界、daemon 拓撲、provider/account 資料流或 web runtime contract；`docs/ARCHITECTURE.md` 既有 capability registry / session workflow 描述仍可覆蓋本次同步結果。
