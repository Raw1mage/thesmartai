# Spec: Subagent IO Visibility

## Purpose

解決 subagent（子代理）委派後使用者完全無法觀測子代理工作內容的問題。
建立 inline 子代理活動視窗，使 subagent 的 tool calls、文字輸出在主 session 中即時可見。

---

## Problem Statement

當 orchestrator 透過 `task()` 委派工作給 subagent 時：

1. **無 UI 回饋**：主 session 只顯示 "思考 - xxx · N分鐘"，使用者看不到子代理正在做什麼
2. **並行超載**：同時派出多個 subagent 導致 worker pool 飽和、全部 timeout（600s）
3. **錯誤黑洞**：subagent error/timeout 只顯示一行紅色文字，無法追溯子代理做了什麼

## Requirements

### R1: Inline Subagent Activity Card

task tool 的 tool call 部分必須顯示子代理的即時活動。

#### Scenario: subagent is running

- **GIVEN** orchestrator 發出 `task()` call，子 session 已建立
- **WHEN** 子代理在子 session 中執行 tool calls（grep, read, bash 等）
- **THEN** 主 session UI 中對應的 task tool card 即時顯示子代理的 tool call 列表（含狀態 icon）

#### Scenario: subagent completes

- **GIVEN** 子代理完成工作並回報
- **WHEN** task tool 進入 completed 狀態
- **THEN** card 顯示最終文字輸出，tool call 列表顯示所有已完成的步驟

#### Scenario: subagent errors or times out

- **GIVEN** 子代理執行失敗（error 或 timeout）
- **WHEN** task tool 進入 error 狀態
- **THEN** card 在活動列表上方顯示 error banner，已完成的步驟仍然可見

### R2: Sequential Delegation

orchestrator 必須一次只派出一個 subagent。

#### Scenario: orchestrator delegates work

- **GIVEN** 有多個待辦任務需要 subagent 處理
- **WHEN** orchestrator 排程委派
- **THEN** 一次只發出一個 `task()` call，等待回報後再派下一個

#### Scenario: parallel dispatch attempt

- **GIVEN** SYSTEM.md §2.3 明確禁止並行 task()
- **WHEN** LLM 嘗試同時發出多個 task() calls
- **THEN** prompt 層級的規則應引導 LLM 避免此行為（soft enforcement）

---

## Non-Requirements (OUT)

- Hard runtime enforcement of sequential dispatch（目前為 prompt-level soft enforcement）
- 子代理 permission dialog forwarding to parent UI
- 子 session 的完整 rich content rendering（只做 tool call 列表 + text summary）
- Worker pool size adjustment（維持 WORKER_POOL_MAX = 3）
