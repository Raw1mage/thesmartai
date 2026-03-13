## Requirements

- 使用者要求把「乾淨部署」正式做起來，避免 repo dirty state 被 install / web-refresh 部署到 production。
- 目標是讓所有從 source repo 觸發的 deploy 流程都 fail-fast 要求 clean working tree。

## Scope

### In

- `install.sh` clean-source gate
- `webctl.sh` source-mode `install` / `web-refresh` clean-source gate
- event ledger / validation / architecture sync record

### Out

- standalone mode change
- systemd unit change
- binary/frontend build outputs themselves
- 歷史 event 改寫

## Task List

- [x] 確認現狀：`install.sh` 與 source-mode `web-refresh` 都會從當前 repo 部署 binary/frontend
- [x] 為 `install.sh` 增加 dirty repo fail-fast gate
- [x] 為 `webctl.sh install` / `web-refresh` 增加 dirty repo fail-fast gate
- [x] 補 event / validation / architecture sync

## Baseline

- `install.sh` 會從 repo 建置並安裝 `dist/opencode-linux-x64/bin/opencode` 與 `packages/app/dist`。
- `web-refresh`（在上一個切片之後）已改成 binary-safe frontend deploy，但仍會從 repo 的 `packages/app/dist` 覆蓋 production frontend。
- 因此兩者都仍受 dirty repo 影響，只是污染面不同。

## Changes

- `webctl.sh`
  - 新增 `ensure_clean_repo_deploy_source()` helper
  - source-mode `install` 與 `web-refresh` 在動作前都會檢查 `git status --short`
  - 若 repo 不乾淨，直接 fail-fast 並列出髒檔
- `install.sh`
  - 新增同名 clean-source gate
  - 在 bootstrap 主流程啟動前先檢查 repo 是否乾淨

## Decisions

1. 所有「從 source repo 重新部署 production 資產」的流程都必須以 clean working tree 為前提。
2. `web-start` / `web-restart` 這種只操作已安裝 runtime 的命令不受此 gate 影響。
3. 若未來需要允許 dirty repo deploy，應透過明確 override flag/環境變數，而不是默默接受。

## Validation

- 靜態檢查：`webctl.sh` 的 `install` 與 `web-refresh` 都在 source-mode 下呼叫 clean-source gate。✅
- 靜態檢查：`install.sh` main flow 在 build/install 前呼叫 clean-source gate。✅
- 靜態檢查：`web-start` / `web-restart` 路徑未被誤加 gate。✅
- Architecture Sync: Verified (No doc changes)

## Next

- 若之後要做正式 binary rollout，需先整理成乾淨 commit，再執行 install/deploy。
