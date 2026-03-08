# Event: README refresh after runtime cleanup

Date: 2026-03-08
Status: Done

## 需求

- 根據最新 repo 狀態更新 `README.md`。
- 反映已完成的 antigravity runtime removal、canonical provider family 現況、以及 runtime secrets 不再回寫 repo 的規範。
- 避免 README 繼續描述過時的 provider/runtime data 路徑。

## 範圍

### IN

- `/home/pkcs12/projects/opencode/README.md`
- `/home/pkcs12/projects/opencode/docs/ARCHITECTURE.md`
- 相關 event 作為最新狀態依據

### OUT

- 不修改程式碼
- 不重寫完整文件架構，僅更新 README 使其與現況一致

## 任務清單

- [x] 比對 README 與最新 architecture/event 狀態
- [x] 更新 README 過時敘述
- [x] 驗證內容一致性並記錄完成

## Debug Checkpoints

### Baseline

- 近期已完成 antigravity runtime removal、web sync SSOT 收斂、legacy runtime data cleanup、history secret rewrite 等變更。
- README 目前可能仍停留在較早期的 cms branch 說明，未反映 runtime secret handling 與 provider current state。

### Execution

- README 已同步以下最新狀態：
  - `accounts.json` 的 canonical runtime 路徑為 `~/.config/opencode/accounts.json`。
  - runtime secrets（如 `accounts.json`, `mcp-auth.json`）保留於 XDG/user-home 或部署端 volume，不追蹤 repo mirror。
  - canonical Google family 現況只保留 `gemini-cli` 與 `google-api`；`antigravity` 已自 current runtime / UI / templates 移除。
  - 補充 Web sync 的單一有效狀態原則：高互動資源逐步收斂為 shared action/store + selector layer，避免 stale refresh / full bootstrap 抖動。
  - 在 README 的開發/驗證段落補充 runtime secrets 不應同步回 repo 的操作提醒。

### Validation

- `git diff -- README.md` ✅
- README 與以下最新狀態已對齊：
  - `docs/events/event_20260308_antigravity_runtime_removal_plan.md`
  - `docs/events/event_20260308_web_sync_ssot_refactor_plan.md`
  - `docs/events/event_20260308_legacy_runtime_data_cleanup.md`
- Architecture Sync: Verified (No doc changes)
  - 依據：本輪僅同步 README 敘述，使其反映既有 architecture/runtime 現況，未改變 `docs/ARCHITECTURE.md` 的結構與內容。
