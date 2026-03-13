## Requirements

- 使用者要求：`web-refresh` 不可再動到已安裝的 production binary。
- 目標是讓 production/systemd refresh 僅更新 web 相關部署資產，而不是重新執行完整 install/binary 覆寫。

## Scope

### In

- `webctl.sh` 的 `do_web_refresh()` 行為調整
- event ledger / validation / architecture sync record

### Out

- `install.sh` 一次性 bootstrap 行為變更
- systemd unit / binary build script 重構
- 任意 web restart/start 實際執行

## Task List

- [x] 確認現狀：`web-refresh` 在 source repo 中會呼叫 `do_install`
- [x] 確認風險：`do_install` 會安裝 `/usr/local/bin/opencode` 與 frontend，造成 binary 被 repo 當前狀態覆寫
- [x] 改為 binary-safe `web-refresh`
- [x] 補 event 與 validation 記錄

## Baseline

- production systemd service 實際執行 `/usr/local/bin/opencode`，本身不直接讀 repo source。
- 但 source repo 模式下的 `web-refresh` 會呼叫 `do_install --yes [--skip-system]`，這會重新安裝 production binary 與 frontend，等同用當前 repo 狀態覆蓋已安裝版本。

## Changes

- `webctl.sh`
  - `do_web_refresh()` 不再呼叫 `do_install`
  - 改為：
    1. `load_server_cfg`
    2. `do_build_frontend`
    3. 以 sudo 將 `packages/app/dist` 同步到 `OPENCODE_FRONTEND_PATH`
    4. `do_web_restart`
  - 新行為明確宣告為 `binary-safe deploy`

## Decisions

1. `install` 仍保留一次性 bootstrap / binary 安裝職責。
2. `web-refresh` 重新定義為 production frontend refresh，而非重新安裝 production binary。
3. 若未來需要「重建並替換 production binary」，應走明確的 install/deploy 流程，而不是藏在 `web-refresh` 裡。

## Validation

- 靜態檢查 `webctl.sh`：`do_web_refresh()` 已不再呼叫 `do_install`。✅
- 靜態檢查 `webctl.sh`：refresh 路徑僅包含 frontend build/deploy + production restart。✅
- Architecture Sync: Verified (No doc changes)

## Next

- 後續若需要 production binary rollout，應新增明確命名的 deploy/binary-refresh 流程，避免與 frontend refresh 混淆。
