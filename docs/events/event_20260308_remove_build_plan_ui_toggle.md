# Event: Remove Build Plan UI Toggle

Date: 2026-03-08
Status: Done

## 需求

- 移除 Build / Plan 的 UI toggle。
- 範圍包含 webapp（desktop / mobile）與 TUI。
- 預設使用 Build，不主動暴露底層 mode/agent 切換 UI。

## 範圍

IN:

- `/home/pkcs12/projects/opencode/packages/app/src/components/prompt-input.tsx`
- `/home/pkcs12/projects/opencode/packages/opencode/src/cli/cmd/tui/component/prompt/index.tsx`
- `/home/pkcs12/projects/opencode/packages/opencode/src/cli/cmd/tui/component/tips.tsx`
- `/home/pkcs12/projects/opencode/docs/events/event_20260308_remove_build_plan_ui_toggle.md`

OUT:

- 底層 agent/mode routing 邏輯重寫
- slash command / keybind 移除
- 專用 agent 系統改版

## 任務清單

- [x] 盤點 Build / Plan UI 顯示位置
- [x] 移除 webapp Build / Plan agent toggle UI
- [x] 移除 TUI Build / Plan agent toggle UI 與誤導 tips
- [x] 驗證 build / runtime 與 Architecture Sync 記錄

## Debug Checkpoints

### Baseline

- webapp `prompt-input.tsx` 在 prompt footer 左側顯示 agent `Select`，目前即為 Build / Plan 的主要 UI 入口。
- TUI `component/prompt/index.tsx` footer 顯示目前 agent 名稱；`tips.tsx` 仍有 Build / Plan 切換提示。
- 目前需求僅移除 UI，不修改底層 agent 切換能力。

### Execution

- webapp `prompt-input.tsx` 移除 agent `Select`，且不再以任何 `Build` 文案佔用 footer 空間。
- TUI `component/prompt/index.tsx` footer 不再顯示當前 agent 名稱切換；normal mode 不再顯示 `Build` 文案，僅 shell mode 顯示 `Shell`。
- TUI `tips.tsx` 移除兩條 Build / Plan 切換提示，避免持續暗示使用者存在 UI mode toggle。
- 底層 agent routing / commands / keybind 未移除，只是從主要 UI surface 隱藏。

### Validation

- `bun run build`（workdir: `packages/app`）
  - 通過。
- `bun run build`（workdir: `packages/opencode`）
  - 通過。
- `./webctl.sh dev-refresh && ./webctl.sh status`
  - 通過，health 為 `{"healthy":true,"version":"local"}`。
- Architecture Sync: Verified (No doc changes)
  - 依據：本次只移除 Build / Plan 的 UI surface，不改變 session shell、routing、agent runtime contract 或系統拓撲。
