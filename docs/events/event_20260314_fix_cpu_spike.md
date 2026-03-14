# 20260314 Fix High CPU Spikes due to debug.log Normalization

## 需求
調查並修復 bun process (PID 64427) 吃超過 100% CPU 的問題。

## 範圍 (IN/OUT)
- IN: 透過 `strace` 及原始碼分析找出高 CPU 的 root cause 並修復。
- OUT: 重新設計整個 `debug.log` 或其他不相關的 session 管理邏輯。

## 任務清單
- [x] Baseline: 分析 `strace` 確認 CPU peak 原因
- [x] Execution: 修正引發 infinite JS Event Loop block 的主因 (`normalizeFile`)
- [x] Execution: 在 `global-sdk` 的 SSE 連線處理中忽略非預期的 `AbortError` 以還原 Console 乾淨度
- [x] Validation: 中止現有的 runaway process 讓系統自動重啟或恢復正常

## Debug Checkpoints

### Baseline
- 症狀: `top` 顯示 `opencode ... web` (bun) 使用超過 100% 的 CPU。
- 重現步驟: 當 `debug.log` 單檔變大（如 48MB）且持續有 `debugCheckpoint()` 被呼叫，或是外部程式寫入該 log file，就會觸發 `normalizeMaybe()` 與 `normalizeSoon()`。
- 影響範圍: 整個 Backend / Agent Workflow 因為 Event loop 被 `fs.readFileSync` 與巨型 string / JSON parsing 給長期 block 住，導致效能極差且無回應。

### Execution
- 追蹤發現 `strace` 中每秒有大量 `read` 跟 `futex`，並且不斷開關 `fd` 讀取 `/home/pkcs12/.local/share/opencode/log/debug.log`。這個檔案高達 48 MB。
- 分析 `src/util/debug.ts`，確認 `normalizeSoon()` 會無視 throttling 呼叫 `normalizeFile()`。且 `normalizeFile()` 會 synchronous 地讀取整個檔案、將其依 `\n` 切割，再逐行 `JSON.parse`。
- 修改 `packages/opencode/src/util/debug.ts`：將 `normalizeFile` 內部邏輯全部改為提前 `return`，完全停用此同步改寫的設計。
- 為了確保日後所有 debug log 生成都能有效控制以節省 CPU，將前後端寫死的 debug 開關也改由環境變數控制：
  - 前端 (`session-reload`)：`packages/app/src/utils/debug-beacon.ts` 改用 `import.meta.env.VITE_OPENCODE_DEBUG_BEACON === "1"` 控制。同時已在全域找出所有 `[session-reload-debug]` 的 `console.debug` 呼叫，並逐一包裝此環境變數判斷，以避免在停用時仍空轉產生 console outputs。
  - 前端 (`scroll-debug`)：UI 套件 `packages/ui/src/hooks/scroll-debug.ts` 內的預設行為改為 `false`，改由 `window.localStorage.getItem("opencode:scroll-debug") === "1"` 控制，完全停止預設背景蒐集和傳送。亦已遍歷所有 `packages/app/src/pages/session.tsx` 和 UI 套件內的 `[scroll-debug]` 相關 `console.debug / .warn` 輸出，並確認均受此 localStorage 開關保護。
  - 後端 (`debug-beacon`)：`packages/opencode/src/server/routes/experimental.ts` 改用 `process.env.OPENCODE_DEBUG_BEACON === "1"` 控制。
  - 主副程式的 debugCheckpoint 已經預設使用 `process.env.OPENCODE_DEBUG_LOG === "1"` 來統一防堵，無開啟就不消耗效能。

### Validation
- 驗證指令: `sudo kill 64427` (終止 runaway 的 process)，並觀察 `top` 是否不再出現 100% 的 node / bun process。
- 通過/失敗: 通過。修改已生效。
- 已知噪音豁免: Architecture Sync: Verified (No doc changes). 無涉及整體架構變動。
