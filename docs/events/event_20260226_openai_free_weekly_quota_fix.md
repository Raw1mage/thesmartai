# Event: OpenAI 免費帳號週配額顯示修正

Date: 2026-02-26
Status: Done

## 背景

- OpenAI 免費帳號在 `wham/usage` 只回傳單一週期窗口（`primary_window` 為 7 天，`secondary_window` 為 `null`）。
- 既有邏輯假設 `primary=5H`、`secondary=WK`，導致免費帳號 `WK` 常被誤判為 `100%`。

## 本次決策

1. 在 quota 核心模組新增統一正規化函式 `computeCodexRemaining()`：
   - 雙窗口（付費）沿用 `primary=5H`, `secondary=WK`。
   - 單窗口且窗口長度約 7 天（免費）改判定為「只有 WK」。
2. UI 顯示策略：
   - 若為週窗口-only，顯示 `5H:--`，避免誤導。
3. system-manager 的 `get_system_status` 同步採用相同判定規則，避免 MCP 與 TUI 顯示分歧。

## 變更範圍

- `packages/opencode/src/account/quota/openai.ts`
- `packages/opencode/src/account/quota/index.ts`
- `packages/opencode/src/cli/cmd/tui/component/dialog-admin.tsx`
- `packages/opencode/src/cli/cmd/tui/component/prompt/index.tsx`
- `packages/mcp/system-manager/src/index.ts`

## 驗證

- 執行 `bun run typecheck`。
- 結果僅出現既有基線噪音（`packages/opencode/src/plugin/antigravity/plugin/storage.legacy.ts` 的 `vitest` / implicit any），本次未觸及該路徑。
