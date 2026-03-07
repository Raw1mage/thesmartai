# Event: Session Page Deduplication

Date: 2026-03-08
Status: Done

## 需求

- 處理 `session.tsx` 與 `session/index.tsx` 的混淆。
- 消除重複 session page 實作，避免之後再修到錯檔案。
- 建立單一 canonical session page 實作路徑。

## 範圍

IN:

- `/home/pkcs12/projects/opencode/packages/app/src/pages/session.tsx`
- `/home/pkcs12/projects/opencode/packages/app/src/pages/session/index.tsx`
- `/home/pkcs12/projects/opencode/docs/events/event_20260308_session_page_dedup.md`

OUT:

- session 子模組（`pages/session/**`）的大規模重寫
- UI/interaction 行為額外修改
- router framework 轉換

## 任務清單

- [x] 確認實際活躍的 session page 路徑
- [x] 取消重複 session page 實作
- [x] 建立單一 canonical session page 入口
- [x] 驗證 build / runtime，並完成 Architecture Sync 記錄

## Debug Checkpoints

### Baseline

- `packages/app/src/pages/session.tsx` 與 `packages/app/src/pages/session/index.tsx` 都存在完整 session page 實作。
- 實際除錯過程已證實活路徑為 `packages/app/src/pages/session.tsx`。
- `session/index.tsx` 的存在會導致維護時誤判活路徑，已在本次 sidebar 修正中多次造成誤修。

### Execution

- 確認目前實際活路徑為 `packages/app/src/pages/session.tsx`。
- 將 `packages/app/src/pages/session/index.tsx` 從完整重複實作改為薄轉發：`export { default } from "../session"`。
- 以最低風險方式先消除雙實作，保留既有 file-based route 命名結構，但將 session page 的單一真相來源收斂到 `session.tsx`。

### Validation

- `bun run build`（workdir: `packages/app`）
  - 通過，前端可成功建置。
- `./webctl.sh dev-refresh && ./webctl.sh status`
  - 通過，runtime health 為 `{"healthy":true,"version":"local"}`。
- Architecture Sync: Updated
  - 已更新 `docs/ARCHITECTURE.md`：
    - `packages/app` 的 canonical session page 改為 `pages/session.tsx`
    - `pages/session/index.tsx` 記錄為 thin forwarding compatibility module
