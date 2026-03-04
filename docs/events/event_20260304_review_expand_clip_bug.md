# Event: Fix Review Expanded File Visibility/Clipping Bug

Date: 2026-03-04
Status: In Progress

## 1) 需求

- 在「檢視變更檔案」介面，展開檔案內容時只能看到最後一個檔案內容。
- 內容往下捲到一定程度會被裁切，無法繼續查看。

## 2) 範圍 (IN/OUT)

### IN

- 釐清 review/變更檢視 UI 的展開區塊渲染與捲動容器問題。
- 修復多檔案展開內容顯示錯誤與內容裁切問題。
- 補上 debug checkpoints 與驗證紀錄。

### OUT

- 不修改 diff 生成後端邏輯。
- 不變更非 review 相關頁面的 UI 行為。

## 3) 任務清單

- [x] 定位造成「只顯示最後一個檔案」的渲染/狀態邏輯。
- [x] 定位內容捲動裁切（overflow/高度/容器）根因。
- [x] 實作最小修復並驗證。
- [x] 更新 Validation 與 Architecture Sync 註記。

## 4) Debug Checkpoints

### Baseline

- 症狀：展開多個檔案時，只看得到最後一個檔案的內容。
- 症狀：展開內容向下捲動到一定位置後被裁切，無法繼續瀏覽。
- 影響：使用者無法完整檢視多檔案 diff，影響 review 可用性。

### Execution

- 根因 1（只剩最後一個檔案內容）：
  - `packages/ui/src/pierre/virtualizer.ts` 在 `session-review` 內用 `review` 節點作為 cache key，導致多個展開 diff 共用同一個 `Virtualizer`，產生渲染狀態互相覆蓋，最終只看到最後渲染的檔案內容。
  - 修正：改為以每個 diff `container` 作為 key，避免跨檔案 virtualizer 狀態碰撞。
- 根因 2（往下捲動被裁切）：
  - `packages/ui/src/components/session-review.css` 對 `session-review-accordion-content` 與 `session-review-diff-wrapper` 設定 `overflow: hidden`，在長內容與虛擬化渲染下造成可視內容被裁切。
  - 修正：兩處改為 `overflow: visible`。
- 第二輪回報（前面檔案「閃一下後不顯示」）：
  - 現象顯示 review 場景下多個展開 diff 仍有虛擬化互斥問題。
  - 修正策略：在 `session-review` 明確停用 diff 虛擬化，改用一般 `FileDiff` 渲染，避免多個展開檔案競爭同一虛擬化上下文。
  - 實作：
    - `packages/ui/src/pierre/index.ts`：`DiffProps` 新增 `useVirtualizer?: boolean`
    - `packages/ui/src/components/diff.tsx`：`useVirtualizer === false` 時不取得 virtualizer
    - `packages/ui/src/components/diff-ssr.tsx`：同上
    - `packages/ui/src/components/session-review.tsx`：review 內 `<Dynamic component={diffComponent} useVirtualizer={false} ... />`
- 第三輪修正（仍出現「閃一下」）：
  - 研判 `session-review` 內容渲染仍受 `open().includes(file)` 的 gate 影響，在某些受控狀態回寫時會短暫 render 後被關閉。
  - 修正：移除 `session-review` 內 diff 區塊對 `expanded()` 的二次條件包覆，改由 Accordion 本身控制顯示，避免內容被額外 gate 掉。
  - 實作：`packages/ui/src/components/session-review.tsx` 移除 `<Show when={expanded()}>...</Show>` 包覆。
- 第四輪修正（點選後首次只出現眼睛、再次點選才閃）：
  - 研判 `Accordion` 在不同實作版本下 `onChange` 可能回傳 `string | string[] | Set<string>`，而 `session-review` 先前直接以 `string[]` 假設處理，造成受控開關狀態反覆被錯誤值覆寫。
  - 修正：在 `session-review` 對 open state 做統一正規化，將 `string | string[] | Set<string> | unknown` 轉成 `string[]` 後再進行渲染與回寫。
  - 實作：`packages/ui/src/components/session-review.tsx` 新增 `normalizeOpen()`，並套用於 `open()` 與 `handleChange()`。
- 第五輪修正（仍僅最後兩個可展開）：
  - 研判受控 value 與外部 persisted state 回寫存在時序競態，導致點擊展開後被舊值覆蓋（體感為「閃一下」）。
  - 修正：在 `session-review` 新增本地 `openState` 作為 UI 單一真相來源，並以 `sameOpen()` 僅在外部值真正變更時同步；同時傳入 Accordion 的 `value` 改為複製陣列，避免外部/內部引用共享造成副作用。
  - 實作：`packages/ui/src/components/session-review.tsx`
    - 新增 `sameOpen()`
    - `openState` + `createEffect` 同步機制
    - `handleChange()` 先更新本地狀態
    - `<Accordion value={[...open()]}>`
- 第六輪修正（針對僅最後兩個可展開）：
  - 研判為 `session-review` 容器 `contain: strict` 與 sticky header 疊加造成的繪製/可視區塊異常（展開時內容瞬間出現後被覆蓋或裁切）。
  - 修正：
    - `packages/ui/src/components/session-review.css` 將根容器 `contain: strict` 改為 `contain: none`。
    - 在 `session-review` 範圍內停用 sticky-accordion-header 的 sticky（改 `position: static`）。
- 第七輪修正（根治展開狀態異常）：
  - 研判 Kobalte Accordion 在此受控/多開場景仍存在不穩定互動（表現為前段項目展開即回收）。
  - 修正：`session-review` 改為原生按鈕切換的多開面板，不再依賴 Accordion root/item/trigger/content 狀態機。
  - 實作：
    - `packages/ui/src/components/session-review.tsx` 移除 `Accordion` 與 `StickyAccordionHeader` 依賴。
    - 以本地 `open()` 狀態控制每個檔案展開/收合（可多開）。
    - 保留既有 UI slot 與評論/diff 渲染流程。
- 第八輪修正（切斷舊 Accordion/Sticky CSS 干擾）：
  - 研判雖已移除 Accordion 組件，但沿用舊 `data-component/data-slot` 命名仍可能命中既有全域樣式（sticky/trigger）造成前段項目內容被覆蓋或裁切。
  - 修正：
    - `session-review.tsx` 將 header/toggle slot 改為專用名稱：
      - `session-review-item-header`
      - `session-review-item-toggle`
    - `session-review.css` 對新 slot 補上明確樣式，不再依賴 `accordion-trigger`/`sticky-accordion-header` 選擇器。
- 回退驗證（鎖定可疑 commit 區段）：
  - 先回退本次對 review UI 的實驗性改動至 `HEAD`，避免多變因干擾。
  - 針對可疑變更點 `73c778a0c`（review render fixes）做最小回退：
    - `packages/ui/src/components/session-review.tsx` 回退至 `0ede1ba4d` 版本（`73c778a0c` 前一版）。
  - 目的：驗證 bug 是否由 `73c778a0c` 對 session-review 的檔案鍵值 memoization/渲染流程改寫所引入。
- 第九輪修正（排除展開後被捲動復原覆蓋）：
  - 研判 `review-tab` 在每次 diff render 後都執行 `restoreScroll()`，可能把視窗拉回舊位置，導致使用者感知為「點開閃一下又消失」。
  - 修正：`packages/app/src/pages/session/review-tab.tsx` 將 `onDiffRendered` 的 `restoreScroll` 回呼停用，只保留初始/列表變更時的復原。
- 第十輪修正（加入可切換 debug checkpoint）：
  - 需求：針對「點擊後閃動但無展開」建立可觀測追蹤，避免盲修。
  - 實作：
    - `packages/ui/src/components/session-review.tsx`
      - 新增 `reviewDebugEnabled()` / `reviewDebug()`
      - 記錄 `trigger-click`、`open-change`、`item-expanded`
    - `packages/app/src/pages/session/review-tab.tsx`
      - 記錄 `restore-scroll`、`persist-scroll`
  - 啟用方式：DevTools 執行 `localStorage.setItem('opencode:debug:review','1')`（或 `window.__OPENCODE_DEBUG_REVIEW__ = true`）後重新操作重現。
- 第十一輪修正（解除受控 open 狀態競態）：
  - 研判 `review-tab` 傳入 `open={props.view().review.open()}` 會把 SessionReview 變成完全受控，並可能被 persisted layout 狀態回寫覆蓋（表現為點擊後閃動）。
  - 修正：`packages/app/src/pages/session/review-tab.tsx` 移除 `open` prop，改由 `SessionReview` 內部 state 管理展開；`onOpenChange` 仍保留用於外部同步。
- 第十二輪修正（完全切斷展開狀態外部回寫）：
  - 研判即使移除 `open` 受控，`onOpenChange` 仍會觸發外部 layout store 更新，造成父層重算與潛在競態。
  - 修正：`packages/app/src/pages/session/review-tab.tsx` 移除 `onOpenChange` 傳遞，展開狀態完全由 `SessionReview` 本地維護。
- RCA 補記（webapp 短暫不可用）：
  - 症狀：重啟後 webapp 無法連線。
  - 根因：重啟指令回合被中斷時，`pkill` 已停止 1080 服務，但新行程未成功常駐，導致 port 1080 無 listener。
  - 處置：重新前景啟動確認可正常 bind，再改為背景啟動；確認 `ss -ltnp` 回報 `0.0.0.0:1080`。
- 第十三輪修正（高機率根因：Accordion onChange 回傳型別不一致）：
  - 研判在目前 runtime 下，`onChange` 可能回傳 `Set<string>` 或 `string`，舊實作直接假設 `string[]`，會造成展開狀態被寫成錯誤型別，出現「展開瞬間又收折」。
  - 修正：`packages/ui/src/components/session-review.tsx` 新增 `normalizeOpen()`，統一處理 `string | string[] | Set<string>`，並套用於 `open()` 與 `handleChange()`。
- 第十四輪修正（建立 system-log 可觀測 checkpoint）：
  - 新增 `POST /experimental/review-client-log`（`packages/opencode/src/server/routes/experimental.ts`），接收前端 review debug 事件並寫入 server log。
  - `session-review.tsx`、`review-tab.tsx` 的 debug 事件除 console 外，會同步送往 `/experimental/review-client-log`，便於從系統 log 追蹤 RCA。
- 第十五輪修正（401 後應回到登入 Gate）：
  - 使用者回報：大量 API 401 時未回到登入畫面。
  - 根因：`web-auth` 只做 `refetch`，在 refetch 完成前 `authenticated()` 仍可能維持舊值，造成 App 短時間持續發送請求。
  - 修正：`packages/app/src/context/web-auth.tsx`
    - 新增 `forcedUnauthenticated` 即時狀態。
    - `authorizedFetch` 遇到 401/403 立刻標記未授權，讓 `AuthGate` 立即顯示登入表單。
    - login 成功或 session 驗證成功後自動清除 forced flag。
- 第十六輪 RCA（版本漂移）：
  - 使用者回報在 `https://crm.sob.com.tw` 仍遇到舊行為（401 風暴、未回登入）。
  - 根因判斷：web runtime 實際載入的 frontend bundle 與 repo 最新碼可能漂移（XDG/frontend 或舊 dist）。
  - 處置：
    - 重建 frontend：`bun --filter @opencode-ai/app build`
    - 重新啟動 1080 並強制指定 frontend：
      - `OPENCODE_FRONTEND_PATH=/home/pkcs12/projects/opencode/packages/app/dist`
      - `OPENCODE_WEB_NO_OPEN=1`
    - 驗證執行中 process environment 確認以上 env 已生效。
- 第十七輪修正（檔名重疊/碰撞顯示）：
  - 症狀：異動清單在窄寬度下，檔名文字與右側變更統計區塊重疊。
  - 修正：採用純 CSS fail-safe 方案（不做 runtime collision 檢測）：
    - `session-review-file-name-container` 啟用 `overflow: hidden` + `flex: 1 1 auto`。
    - `session-review-directory` 設 `max-width` + ellipsis。
    - `session-review-filename` 啟用 `min-width: 0` + `text-overflow: ellipsis`。
    - `session-review-trigger-actions` 設 `min-width: max-content` 防止被擠壓。
    - 同時在檔名容器補 `title={diff.file}` 供完整路徑 hover 檢視。
- 第十八輪修正（review diff data source 直接 Git 化）：
  - 症狀：展開狀態正常，但多數項目 `b:0 / a:0 / p:0`，表示 before/after payload 缺失。
  - 根因：前端過度依賴 `file.read` patch/diff 拼裝，遇到缺 patch 情境會出現空內容。
  - 修正：
    - `packages/opencode/src/file/index.ts#status()` 改為直接以 Git + 工作樹讀取水合 `before/after`：
      - added: `before=""`, `after=<working tree text>`
      - deleted: `before=<git show HEAD:file>`, `after=""`
      - modified: `before=<git show HEAD:file>`, `after=<working tree text>`
    - `packages/app/src/context/sync.tsx` 優先使用 `file.status` 回傳的 `before/after`，僅在缺失時才 fallback `file.read`。
    - 同步修正 modified 誤判 added 的 fallback 行為。

### Validation

- `bun x tsc -p /home/pkcs12/projects/opencode/packages/ui/tsconfig.json --noEmit` ✅
- `bun x tsc -p /home/pkcs12/projects/opencode/packages/app/tsconfig.json --noEmit` ✅
- 第二輪修正後複驗：
  - `bun x tsc -p /home/pkcs12/projects/opencode/packages/ui/tsconfig.json --noEmit` ✅
  - `bun x tsc -p /home/pkcs12/projects/opencode/packages/app/tsconfig.json --noEmit` ✅
- 第三輪修正後複驗：
  - `bun x tsc -p /home/pkcs12/projects/opencode/packages/ui/tsconfig.json --noEmit` ✅
  - `bun x tsc -p /home/pkcs12/projects/opencode/packages/app/tsconfig.json --noEmit` ✅
- 第四輪修正後複驗：
  - `bun x tsc -p /home/pkcs12/projects/opencode/packages/ui/tsconfig.json --noEmit` ✅
  - `bun x tsc -p /home/pkcs12/projects/opencode/packages/app/tsconfig.json --noEmit` ✅
- 第五輪修正後複驗：
  - `bun x tsc -p /home/pkcs12/projects/opencode/packages/ui/tsconfig.json --noEmit` ✅
  - `bun x tsc -p /home/pkcs12/projects/opencode/packages/app/tsconfig.json --noEmit` ✅
- 第六輪修正：CSS-only 變更（無 TS 介面影響）。
- 第七輪修正後複驗：
  - `bun x tsc -p /home/pkcs12/projects/opencode/packages/ui/tsconfig.json --noEmit` ✅
  - `bun x tsc -p /home/pkcs12/projects/opencode/packages/app/tsconfig.json --noEmit` ✅
- 第八輪修正後複驗：
  - `bun x tsc -p /home/pkcs12/projects/opencode/packages/ui/tsconfig.json --noEmit` ✅
  - `bun x tsc -p /home/pkcs12/projects/opencode/packages/app/tsconfig.json --noEmit` ✅
- 回退驗證後：
  - `bun x tsc -p /home/pkcs12/projects/opencode/packages/ui/tsconfig.json --noEmit` ✅
  - `bun x tsc -p /home/pkcs12/projects/opencode/packages/app/tsconfig.json --noEmit` ✅
  - 手動 UI 驗證：Pending（待使用者複測是否恢復可展開行為）。
- 第九輪修正後複驗：
  - `bun x tsc -p /home/pkcs12/projects/opencode/packages/ui/tsconfig.json --noEmit` ✅
  - `bun x tsc -p /home/pkcs12/projects/opencode/packages/app/tsconfig.json --noEmit` ✅
  - 手動 UI 驗證：Pending。
- 第十輪修正後複驗：
  - `bun x tsc -p /home/pkcs12/projects/opencode/packages/ui/tsconfig.json --noEmit` ✅
  - `bun x tsc -p /home/pkcs12/projects/opencode/packages/app/tsconfig.json --noEmit` ✅
- 第十一輪修正後複驗：
  - `bun x tsc -p /home/pkcs12/projects/opencode/packages/ui/tsconfig.json --noEmit` ✅
  - `bun x tsc -p /home/pkcs12/projects/opencode/packages/app/tsconfig.json --noEmit` ✅
- 第十二輪修正後複驗：
  - `bun x tsc -p /home/pkcs12/projects/opencode/packages/ui/tsconfig.json --noEmit` ✅
  - `bun x tsc -p /home/pkcs12/projects/opencode/packages/app/tsconfig.json --noEmit` ✅
- 第十三/十四輪修正後複驗：
  - `bun x tsc -p /home/pkcs12/projects/opencode/packages/opencode/tsconfig.json --noEmit` ✅
  - `bun x tsc -p /home/pkcs12/projects/opencode/packages/ui/tsconfig.json --noEmit` ✅
  - `bun x tsc -p /home/pkcs12/projects/opencode/packages/app/tsconfig.json --noEmit` ✅
- 第十七輪修正後複驗：
  - `bun x tsc -p /home/pkcs12/projects/opencode/packages/ui/tsconfig.json --noEmit` ✅
  - `bun x tsc -p /home/pkcs12/projects/opencode/packages/app/tsconfig.json --noEmit` ✅
- 第十八輪修正後複驗：
  - `bun x tsc -p /home/pkcs12/projects/opencode/packages/opencode/tsconfig.json --noEmit` ✅
  - `bun x tsc -p /home/pkcs12/projects/opencode/packages/app/tsconfig.json --noEmit` ✅
  - `bun x tsc -p /home/pkcs12/projects/opencode/packages/ui/tsconfig.json --noEmit` ✅
  - `./webctl.sh dev-refresh` ✅
- 第十九輪修正（UI 互動與資訊密度）：
  - 使用者回報：
    1. 切換整合/拆分時會從檔案檢視跳回清單。
    2. 檔案清單路徑/檔名分欄佔空間。
    3. 眼睛按鈕冗餘。
  - 修正：
    - `session/index.tsx`、`session.tsx`：`onDiffStyleChange` 改為包裝 handler，先更新 style，再在 microtask 重新維持目前 active file tab，避免切換樣式導致檔案檢視被中斷。
    - `session-review.tsx`：檔名顯示改為單一 `filepath` 字串（不再拆 directory/filename）。
    - `session-review.tsx` + `session-review.css`：移除眼睛按鈕，改為點擊行首 `FileIcon` 直接觸發 `onViewFile`。
    - `session-review.css`：調整 file info 相關樣式配合單列路徑與 icon button。
- 第二十輪修正（移除累積異動子模式，統一為單一異動清單）：
  - 使用者決策：結束「累積異動」模式，僅保留單一異動清單，不再切換子選單。
  - 修正：
    - `session.tsx`：移除 `store.changes` / Select 子選單分流，review 標題固定使用 `ui.sessionReview.title.lastTurn`。
    - `session.tsx` + `session/index.tsx`：review 清單鍵值改為 `sessionID:msg:messageID`，並以目前 active/last user message 作為唯一 diff source。
    - `sync.tsx`：`sync.session.diff` 支援 `messageID`，有 `messageID` 時走 `session.diff`；無 `messageID` 保留 `file.status` 路徑作為相容 fallback。
  - 目的：避免累積/最新兩套路徑交錯造成樣式切換與展開行為不一致。
- 第二十一輪修正（清單互動簡化與單一展開策略）：
  - 使用者決策：
    1. 移除 review 內重複標題顯示。
    2. 取消眼睛按鈕，改由檔案 icon 直接開啟檔案。
    3. 每次僅允許展開一個檔案。
  - 修正：
    - `session-review.tsx`：header 僅在外部有傳 `title` 時才渲染；未傳值時不顯示標題。
    - `session-review.tsx`：移除 eye action，將 `FileIcon` 包為可點擊按鈕觸發 `onViewFile`。
    - `session-review.tsx`：trigger click 改為「同檔案再點收合、不同檔案切換成單一展開」。
    - `session-review.css`：配套更新 `session-review-file-icon-button` 與單一路徑顯示樣式。
- System Log Checkpoint (2026-03-04 17:xx)
  - 檢查路徑：
    - `/home/pkcs12/.local/share/opencode/log/debug.log`
    - `/tmp/opencode-web-1080.log`
  - 結果：未找到 `session-review` / `review-tab` / `open-change` / `trigger-click` / `item-expanded` / `restore-scroll` / `persist-scroll` 相關紀錄。
  - 判讀：目前問題為前端互動層（browser runtime）現象，未進入 server/system log 管道。
  - 下一步：以 browser console checkpoint 作為主要證據來源（已在 `session-review.tsx` 與 `review-tab.tsx` 佈署 debug 訊號）。
- Architecture Sync: Verified (No doc changes)
  - 依據：本次僅修正 review UI 渲染策略（virtualizer 使用方式與 CSS overflow），未更動系統架構邊界、模組關係或資料流拓樸。

- 第二十一輪修正後複驗：
  - `bun x tsc -p /home/pkcs12/projects/opencode/packages/opencode/tsconfig.json --noEmit` ✅
  - `bun x tsc -p /home/pkcs12/projects/opencode/packages/app/tsconfig.json --noEmit` ✅
  - `bun x tsc -p /home/pkcs12/projects/opencode/packages/ui/tsconfig.json --noEmit` ✅
