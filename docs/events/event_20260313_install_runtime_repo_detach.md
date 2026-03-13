## Requirements

- 使用者要求的「乾淨部署」真正含義是：install 完之後，runtime 必須脫離 repo 依賴，而不只是 deploy source 要乾淨。
- 要修掉 production/systemd runtime 仍可能透過 `/etc/opencode/opencode.cfg` 指向 repo frontend 路徑的問題。

## Scope

### In

- `templates/system/opencode.cfg`
- `install.sh` runtime config normalization
- `docs/ARCHITECTURE.md` deployment/runtime consistency sync
- event ledger / validation

### Out

- dev-start source workflow 改寫
- binary format / systemd unit 主結構變更
- MCP runtime packaging overhaul

## Task List

- [x] 確認 install 後仍存在 repo 依賴點
- [x] 修正 template config 的 frontend 路徑預設值
- [x] 修正 install 時對既有 `/etc/opencode/opencode.cfg` 的 normalize 行為
- [x] 更新 architecture / event / validation

## Baseline

- systemd production service 執行的是 `/usr/local/bin/opencode`，binary 本身已脫離 repo source。
- 但 `templates/system/opencode.cfg` 仍將 `OPENCODE_FRONTEND_PATH` 預設為 repo 路徑 `/home/pkcs12/projects/opencode/packages/app/dist`。
- `install.sh` 對既有 `/etc/opencode/opencode.cfg` 採「keep existing config」策略，意味著舊 repo 路徑可能永久殘留，讓 installed runtime 仍依賴 repo frontend。

## Changes

- `templates/system/opencode.cfg`
  - 將 `OPENCODE_FRONTEND_PATH` 預設改為 `/usr/local/share/opencode/frontend`
- `install.sh`
  - 安裝時不再單純保留既有 `opencode.cfg` 原樣
  - 會顯式把 `OPENCODE_FRONTEND_PATH` normalize 成 `/usr/local/share/opencode/frontend`
  - 若欄位不存在則補寫；若已存在則覆寫成 installed frontend path
- `docs/ARCHITECTURE.md`
  - 補充 production install 會將 runtime frontend path 正規化到 installed bundle，避免 systemd/web runtime 依賴 repo `packages/app/dist`

## Decisions

1. 「install 後脫離 repo」的最低必要條件之一，是 runtime config 不再指向 repo frontend 路徑。
2. install 有責任修正既有 config 中的舊 repo path，而不是永遠保留舊值。
3. dev/source workflow 仍可使用 repo `packages/app/dist`；production/install workflow 則必須指向 installed frontend bundle。

## Validation

- 靜態檢查：`templates/system/opencode.cfg` 的 frontend path 已改為 `/usr/local/share/opencode/frontend`。✅
- 靜態檢查：`install.sh` 會在安裝時 normalize 現有 `/etc/opencode/opencode.cfg` 的 `OPENCODE_FRONTEND_PATH`。✅
- Architecture Sync: Verified (Doc updated)

## Next

- 若還有其他 installed runtime config/template 仍殘留 repo path，應以同樣方式逐步清除。
