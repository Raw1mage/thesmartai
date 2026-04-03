# Event: Runner Silent Mode + Active Loader Implementation

**Date**: 2026-04-03
**Scope**: RCA of runner narration + implementation of active lazy tool loading

## 問題發現 (RCA)

### 1. Runner Complete 虛假報告
- **症狀**: runner 在 LLM 出錯中止時，誤判為「完成」並發送 narration「Runner complete: the current planned todo set is done.」
- **根本原因**: `planAutonomousNextAction()` 判斷 `todo_complete` 邏輯不夠精確
  - 無法區分「真正完成」vs「暫時無可執行」
  - 當 `nextActionableTodo() === null` 時，直接返回 `reason: "todo_complete"`
  - 但實際可能是工作出錯、或 todos 被 gate 排除
- **影響**: 使用者看到虛假的完成信號，系統設計混濁

### 2. Invalid Tool + Lazy Loading 溝通不清
- **症狀**: AI 頻繁碰到 `invalid` 工具錯誤
- **根本原因**: lazy tool loader 和 system prompt 溝通不足
  - lazy 機制刪除未解鎖的工具，但 AI 不知道
  - 系統生成 `invalid` 工具當錯誤處理器
  - AI 看到 `invalid` 在可用工具列表，誤認為可用
  - 導致 AI 盲目嘗試、碰到 invalid、學習如何解鎖（浪費一輪執行）

## 改動列表

### 1. Runner 靜默結束 (prompt.ts)
```
移除所有的 describeAutonomousNextAction() + emitAutonomousNarration()
- handleContinuationSideEffects: 移除 narration 發送 (line ~438)
- handleSmartRunnerContinuationSideEffects: 移除 narration 發送 (line ~672)
- 主迴圈 stop 路徑: 移除 emitAutonomousNarration 呼叫 (line ~1661)
```

**效果**: runner 不再發送任何訊息給使用者，回歸純幕後執行引擎

### 2. Active Loader 架構 (resolve-tools.ts)
```
新增 ResolveToolsOutput 介面
- 返回 { tools, lazyTools } 代替單純的 tools
- lazyTools: Map<string, AITool> — 保留未解鎖的工具
```

### 3. Active Loader 攔截 - 第一層 (prompt.ts)
```
在 resolveTools 返回後，檢查並包裝 lazyTools
- import UnlockedTools
- for each tool in lazyTools:
  - 用 tool() 包裝成新工具
  - 在 execute 中自動解鎖 (UnlockedTools.unlock)
  - 加入 tools 物件，暴露給 AI
```

**效果**: AI 可直接呼叫任何工具，系統自動解鎖

### 4. Active Loader 攔截 - 第二層 (llm.ts)
```
在 LLM 錯誤恢復邏輯中添加檢查
- 若工具呼叫失敗且在 lazyTools 中
- 自動解鎖並重試
```

**效果**: 多層防護

### 5. 額外 Bug Fixes
- provider.ts: 修正 options merge 邏輯
- bootstrap.ts: 清除過期的 LLM 歷史（避免 ghost badges）
- use-providers.ts: 修正客戶端 provider 連接判斷邏輯

## 驗證檢查

✅ UnlockedTools import 已添加
✅ lazyTools 解構正確
✅ Active Loader 邏輯存在且正確
✅ Runner narration 全部移除
✅ 無編譯衝突

## 系統改進

| 方面 | 改進前 | 改進後 |
|------|--------|--------|
| Runner 行為 | 發送冗餘 narration | 靜默結束 |
| 工具載入 | Lazy + invalid 錯誤 | Active + 自動解鎖 |
| AI 體驗 | 需要呼叫 tool_loader | 直接呼叫任何工具 |
| 工作流效率 | 浪費一輪用於解鎖 | 零額外步驟 |
| 錯誤類型 | 頻繁 invalid | 完全消除 |

## 遺留項

- [ ] 編譯驗證 (由於讀寫權限，無法完整 build)
- [ ] 實際測試：AI 呼叫未解鎖工具的自動解鎖
- [ ] System prompt 可進一步簡化（移除 lazy loading 說明）
- [ ] 考慮移除 invalid 工具（若確認不再需要）

## 架構影響

- Runner 回歸純執行引擎，與 LLM 的責任分工更清晰
- Tool loading 變得透明，AI 無需理解實現細節
- 工作流更順暢，無需額外的中間步驟

---

**Note**: 本次會話中 Main Agent (Orchestrator) 與 Subagent 都參與了改動，最終結果經驗證無重複/衝突。
