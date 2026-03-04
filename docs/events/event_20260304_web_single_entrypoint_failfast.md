# Event: Enforce Single Web Entrypoint + No Silent Fallback

Date: 2026-03-04
Status: Done

## 1) 需求

- 使用者要求：repo 內不得存在多版本/多啟動方式造成行為漂移。
- 原則：嚴禁靜默 fallback；任何回歸 legacy 路徑都必須 fail-fast。

## 2) 範圍 (IN/OUT)

### IN

- 將 web runtime 啟動入口收斂為 `webctl.sh dev-start`。
- 建立 repo 級單一設定檔作為 web runtime 啟動真相來源。
- 關閉 server 前端路由的 CDN proxy 靜默 fallback。
- 補齊 AGENTS 與 templates/AGENTS 規範。

### OUT

- 不處理外部反向代理（nginx/caddy）配置。
- 不調整非 web runtime 的 provider fallback 策略。

## 3) 任務清單

- [x] `webctl.sh` 注入明確啟動標記環境變數。
- [x] `opencode web` 直接啟動加守門，僅允許 `webctl`/`systemd` 標記啟動。
- [x] server frontend catch-all 移除 CDN proxy fallback，改為顯式 4xx/5xx。
- [x] 建立 `/etc/opencode/opencode.cfg` 單一設定來源（由 template 產生）並改由 `webctl.sh`/`install.sh` 讀取。
- [x] 同步更新 `AGENTS.md` 與 `templates/AGENTS.md`。

## 4) Debug Checkpoints

### Baseline

- 症狀：使用不同啟動方式（手動 bun vs webctl）可能導致前端 bundle 不一致與舊行為回歸。
- 風險：問題重現與修復驗證失去單一真相來源。

### Execution

- `webctl.sh`
  - 新增必填設定檔：`/etc/opencode/opencode.cfg`（不存在即 fail-fast，並提示先執行 `./webctl.sh install --yes`）。
  - 設定檔讀取改為啟動階段載入（避免 `install` 指令本身被缺檔阻擋）。
  - `dev-start` 啟動命令新增 `OPENCODE_LAUNCH_MODE=webctl`。
  - 由 cfg 載入 port/hostname/public url/frontend 路徑與 auth 提示設定。
- `packages/opencode/src/cli/cmd/web.ts`
  - 僅允許 `OPENCODE_LAUNCH_MODE in {webctl, systemd}`，其餘直接 fail-fast。
- `install.sh`
  - 佈署 `templates/system/opencode.cfg` 至 `/etc/opencode/opencode.cfg`（若已存在則保留）。
  - systemd unit 只讀 `EnvironmentFile=/etc/opencode/opencode.cfg` 並注入 `OPENCODE_LAUNCH_MODE=systemd`。
- `packages/opencode/src/server/app.ts`
  - 前端 catch-all 移除 proxy `https://app.opencode.ai` fallback。
  - 缺少 frontend bundle / index / asset 時回傳顯式錯誤 JSON（503/404/400）。
- `AGENTS.md` / `templates/AGENTS.md`
  - 新增「Web Runtime 單一啟動入口（Fail-Fast）」規範。

### Validation

- `bun x tsc -p /home/pkcs12/projects/opencode/packages/opencode/tsconfig.json --noEmit` ✅
- `bun x tsc -p /home/pkcs12/projects/opencode/packages/app/tsconfig.json --noEmit` ✅
- `bun x tsc -p /home/pkcs12/projects/opencode/packages/ui/tsconfig.json --noEmit` ✅
- `./webctl.sh dev-start` 啟動成功，且環境固定為 `OPENCODE_FRONTEND_PATH=<repo>/packages/app/dist`。
- 已確認 `./webctl.sh install` 在缺少 `/etc/opencode/opencode.cfg` 時不會被前置讀檔阻擋（讀取改為啟動階段）。
- Architecture Sync: Updated
  - 已同步更新 `docs/ARCHITECTURE.md`（Frontend Serving & Runtime Config / Cross-Surface Comparison / Key Files），反映 `/etc/opencode/opencode.cfg` 單一設定來源與 fail-fast 無 CDN fallback。
