# Event: RCA — Webapp gemini-cli connect dialog missing account name textbox

## Incident Summary

- **User-visible symptom**: 在 webapp「連線 gemini-cli」對話框中只看到 API key 欄位，未看到 account name textbox。
- **Impact**: 使用者無法在連線當下指定帳號名稱，容易誤判修復失敗，並影響多帳號可辨識性。
- **Status**: 已修復（功能本身已存在於程式碼，主要阻塞在部署同步失敗與錯誤路徑判斷）。

## Scope (IN / OUT)

- **IN**:
  - 調查 `packages/app` connect dialog 實際程式碼與執行中的前端 bundle 差異。
  - 修正 `webctl.sh dev-refresh` 的前端同步前置載入（`load_server_cfg`）以使用 SSOT 路徑。
  - 確認同步失敗根因（frontend target 目錄權限）。
- **OUT**:
  - 不新增 fallback 機制（遵守 fail-fast），僅補強正確路徑與操作流程。
  - 不變更 provider auth domain model（本次非資料模型缺陷）。

## Timeline (Condensed)

1. 先前修復誤判為 console BYOK 路徑（`packages/console/.../provider-section.tsx`），但使用者截圖顯示實際在 `packages/app` 連線對話框。
2. 重新核對 `packages/app/src/components/dialog-connect-provider.tsx`，確認 `ApiAuthView` 已有 `accountName` TextField。
3. 啟動層檢查發現 runtime frontend 來源為 `/usr/local/share/opencode/frontend`（`/etc/opencode/opencode.cfg`）。
4. `dev-refresh` 後 UI 仍舊版，進一步檢查發現部署目錄時間戳未更新（仍停在舊版）。
5. 讀取 refresh log 證實 `rsync` 大量 `Permission denied`，導致新 bundle 無法覆蓋目標目錄。
6. 補 `webctl.sh`：`do_dev_refresh()` 先 `load_server_cfg`，確保 sync 使用 SSOT 前端路徑。
7. 最終採用權限修正 + refresh，使用者回報「終於修好了」。

## Evidence

- App code 已包含 account name input：
  - `packages/app/src/components/dialog-connect-provider.tsx`
    - `ApiAuthView` 內 `TextField name="accountName"`
    - `auth.set` payload 含 `name: accountName?.trim() || undefined`
- Runtime path 由 config 指向：
  - `/etc/opencode/opencode.cfg` -> `OPENCODE_FRONTEND_PATH="/usr/local/share/opencode/frontend"`
- 失敗證據：
  - refresh log 內 `rsync ... Permission denied` / `delete_file ... failed` / `mkstemp ... failed`
  - 目標目錄時間戳維持舊版（未更新）。

## Root Cause Analysis

### Primary Root Cause

- **Deploy-time frontend sync failure**：`/usr/local/share/opencode/frontend` 權限不允許目前執行者覆寫，`rsync` 在 `dev-refresh` 期間失敗，導致服務繼續讀取舊 bundle。

### Contributing Factors

1. **Path/context mismatch in diagnosis**：最初把問題歸到 console BYOK 路徑，與使用者實際畫面不一致，延後了正確修復。
2. **`dev-refresh` pre-sync config load gap**：在修正前，`do_dev_refresh` 未先 `load_server_cfg`，可能造成 sync/路徑上下文不一致（已補）。
3. **Insufficient immediate deploy verification**：第一次 refresh 後未立刻核對 target bundle mtime + sync log，讓「看似重啟成功」掩蓋了「前端未更新」。

### Not Root Cause

- `packages/app` 的 connect dialog 本身缺少欄位：**否**（程式碼已有）。
- provider auth API 不支援 `name`：**否**（payload 已送 `name`）。

## Fix Applied

1. **webctl 修正（已套用）**
   - 檔案：`webctl.sh`
   - 變更：`do_dev_refresh()` 開頭加入 `load_server_cfg`，確保遵循 `/etc/opencode/opencode.cfg` 的 SSOT 路徑再進行 sync。

2. **操作修正（已執行）**
   - 修復 `/usr/local/share/opencode/frontend` 寫入權限，讓 `rsync` 可完成覆蓋。
   - 重新執行 refresh / restart 流程，使用者端驗證通過。

## Validation

- 讀取 connect dialog 實作確認 accountName 欄位存在。
- 讀取 `webctl.sh` 確認 `do_dev_refresh` 已先 `load_server_cfg`。
- 檢查 refresh 輸出與錯誤 log，定位並驗證權限問題。
- 使用者最終回覆：**「終於修好了」**。

## Preventive Actions

1. **Deploy gate (recommended)**
   - `dev-refresh` 後自動檢查 target bundle mtime/hash 是否更新；未更新即 fail-fast。
2. **Post-refresh assert (recommended)**
   - 在 status 中增加最近一次 frontend sync 結果摘要（success/fail + path + timestamp）。
3. **RCA discipline**
   - UI 問題先以截圖路徑對應具體 component，再落實修補，避免跨產品面誤修。

## Architecture Sync

- `specs/architecture.md`: **Verified (No doc changes)**
  - 本次為部署流程與運維驗證改善，未變更核心模組邊界/資料流。

## Cross-Reference / 分流註記

- 本事件為 **App Connect Dialog（`packages/app`）+ webctl deploy/sync** 的 RCA。
- 先前獨立完成的 **Console BYOK（`packages/console`）** 帳號名稱欄位實作記錄如下：
  - `docs/events/event_20260318_console_byok_account_name_input.md`
- 後續若要做「新舊雙軌制（app vs console）」的大重構，應以兩份事件合併建 backlog 與新 branch 執行。
