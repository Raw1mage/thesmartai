# Event: system prompt checkpoint narration rule

Date: 2026-03-10
Status: In Progress

## 需求

- 將「長時間工具執行前先對使用者做一句 checkpoint narration」上升為 `SYSTEM.md` 層級規範。
- 避免 agent 在讀檔、RCA、驗證或多工具回合期間長時間靜默，讓使用者誤以為 agent 消失。

## 範圍 (IN / OUT)

### IN

- `/home/pkcs12/projects/opencode/templates/prompts/SYSTEM.md`
- `/home/pkcs12/.config/opencode/prompts/SYSTEM.md`
- 必要 event / validation / architecture sync 記錄

### OUT

- 不改工具層實作
- 不改模型或 session 管理機制

## 任務清單

- [x] 確認 repo template 與 runtime 對應 `SYSTEM.md` 路徑
- [ ] 補上 checkpoint narration 規則文字
- [ ] 驗證 template / runtime 已同步
- [ ] 記錄 architecture sync 結論

## Checkpoints

### Baseline

- 目前 `SYSTEM.md` 已定義 MSR、Read-Before-Write、Framework-Docs-First、Reasoning Visibility 等底層規範。
- 但尚未明確要求：當 agent 即將進入較長的讀檔 / 偵查 / 驗證 / 多工具 round 時，必須先對使用者輸出一句簡短進度 checkpoint。
- 使用者明確指出：長達約一分鐘的靜默會造成不良體驗，應在 `SYSTEM.md` 層處理，而不是只靠 session 臨時約定。

### Execution

- 已確認 repo 內交付模板位於：`/home/pkcs12/projects/opencode/templates/prompts/SYSTEM.md`
- 已確認本機 runtime 對應檔位於：`/home/pkcs12/.config/opencode/prompts/SYSTEM.md`
- 兩邊同步新增規則：`Checkpoint Narration Principle`
  - 內容要求：在可能讓使用者明顯等待的長讀檔 / 偵查 / 驗證 / 多工具執行前，先輸出一句簡短進度說明。
  - 目標：避免 agent 長時間靜默，提升可觀測性與信任感。

### Validation

- 驗證方式：比對 template 與 runtime 兩份 `SYSTEM.md` 的新增條文。
- 結果：passed
- Architecture Sync: Verified (No doc changes)
  - 依據：本次變更屬 prompt / operator contract，同步的是 `SYSTEM.md` 規範，而非 runtime 模組邊界或資料流架構。
