# Terminal Popout 架構盤點 / RCA / 修復計畫

Date: 2026-02-28
Status: Draft (for alignment before next implementation round)
Scope: `packages/app/src/components/terminal.tsx`, `packages/app/src/pages/session/terminal-panel.tsx`, `packages/app/src/context/terminal.tsx`

---

## 1) 現況架構盤點（As-Is）

### 1.1 元件與責任

1. `TerminalPanel` (`pages/session/terminal-panel.tsx`)
   - 管理 terminal tabs UI、active tab、new/close tab 互動。
   - 目前同時承擔 popout window 建立、theme 複製、selection policy、Portal mount 管理。

2. `Terminal` (`components/terminal.tsx`)
   - 建立 Ghostty terminal instance。
   - 綁定 copy/paste/pointer/link/resize/websocket 等事件。
   - 負責 local buffer restore、size sync、persist。
   - 目前新增了 `skipRestore`、`disableMouseSelection`，使組件同時承擔「渲染 + popout 特例策略」。

3. `useTerminal` (`context/terminal.tsx`)
   - 管理 workspace-scope PTY 列表與 active 狀態。
   - 新 tab 的 metadata（id/title/titleNumber）與 close/move/clone。
   - persist 的 `buffer/cursor/rows/cols/scrollY` 由 `Terminal` cleanup 回寫。

### 1.2 畫面與資料流

1. Inline 模式：
   - `TerminalPanel` 直接 render `<Terminal ...>` 到主頁面 DOM。

2. Popout 模式（當前）：
   - `window.open("", "opencode-terminal-popout", ...)` 開 `about:blank`。
   - 複製主頁 `style/link` 到新視窗 head。
   - 在新視窗 body 建 root div。
   - 透過 `Portal` 把 `<Terminal ...>` mount 到新視窗 root。

---

## 2) 為何近期修補容易失效（Root Causes）

### RCA-A：責任混疊（UI + Window lifecycle + Interaction policy）

- `TerminalPanel` 同時處理 tabs 與 popout 視窗細節，導致每次修一個症狀（selection/theme/restore）都可能牽動其他路徑。

### RCA-B：about:blank + Portal 是高耦合方案

- 渲染是跨 document portal，事件與 selection 既受 terminal renderer 影響，也受 browser document 選取機制影響。
- 結果是「容器層修補」和「文件層修補」容易互相打架：
  - click 行為
  - drag selection
  - copy shortcut
  - ghost frame

### RCA-C：Restore/Replay 策略被特例分裂

- `skipRestore` + websocket `cursor` 策略在 inline/popout/new-tab 間行為不一致。
- 每加一個條件分支，風險面與測試矩陣都倍增。

### RCA-D：目前 bug 表現（你回報的症狀）

1. click 就黏著 selection（不符合預期）
2. drag 選取後 copy 失敗（選取沒價值）
3. popout 返回 inline 後畫面亂（renderer/frame 污染）

---

## 3) 「到底改到哪」盤點（最近風險熱區）

### High-risk touched files

1. `packages/app/src/components/terminal.tsx`
   - 新增：`skipRestore`, `disableMouseSelection`, pointer policy, copy shortcut override, container reset。

2. `packages/app/src/pages/session/terminal-panel.tsx`
   - 新增：popout window 建立、theme 同步、document-level selection policy、Portal mount。

3. `packages/app/src/context/terminal.tsx`
   - 與本輪核心問題直接關聯較低，但是 terminal persistence 的來源；任何 restore 策略變更都需回看此處。

---

## 4) 修復策略（先穩定再優化）

### Phase 0：Freeze

- 先停止在現有 popout 邏輯上持續打補丁。
- 凍結需求目標（acceptance criteria）如下：
  1. click-only 不進入 selection mode
  2. drag-select 可用且可 copy
  3. popout/inline 來回不亂畫面

### Phase 1：簡化互動策略（最小可驗證）

- 把 selection policy 收斂到單一路徑（**只在一層做**）：
  - 優先選 document-level policy（popout window）
  - 移除 Terminal component 內與 selection 相關的重複/競爭邏輯
- copy 行為改為唯一規則：
  - 有 selection -> copy
  - 無 selection -> 透傳 Ctrl+C 到 PTY

### Phase 2：分離 popout 容器責任（建議）

- 將 popout 從 `about:blank + Portal` 演進為「專用 route/window」：
  - 建立 `session terminal popout route`（獨立 app shell）
  - 避免跨-document portal 的樣式與事件交纏
- 讓主題同步變成 app 狀態同步，而非 DOM style clone。

### Phase 3：回歸測試矩陣

- 手動 + 自動化檢查至少包含：
  1. inline click/drag/copy
  2. popout click/drag/copy
  3. popout <-> inline 切回
  4. new terminal 畫面乾淨
  5. theme 切換後可讀性

---

## 5) 下一輪實作邊界（避免再擴散）

1. 不改 `context/terminal.tsx` 的資料結構（除非必要）
2. 先在 `terminal-panel.tsx` 做單層策略收斂
3. `terminal.tsx` 回歸「純 renderer + pty bridge」，移除多餘 popout 特例
4. 每一步都先可回滾（小 commit、可定位）

---

## 6) 驗收標準（Definition of Done）

1. click-only 不再觸發粘滯選取
2. drag-select 文字可複製（Ctrl+C）
3. popout/inline 切換後 terminal 畫面不出現疊影或亂序
4. 不新增新的 terminal 交互副作用
