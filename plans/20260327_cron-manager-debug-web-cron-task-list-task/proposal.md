# Proposal

## Why

- 使用者可進入 child session 觀察 subagent，但目前 UI 把它呈現成近似一般對話 session，導致產品邊界混亂。
- 現況允許 child session 顯示對話輸入框，與 subagent 作為非對話互動式 worker process 的定義衝突。
- 當 child 沒有持續文字輸出時，操作者難以判斷它是否仍在執行；這放大了先前 stale projection / sync lag 問題的可感知性。

## Original Requirement Wording (Baseline)

- "理論上不應該允許 subsession 有對話輸入框。subagent 的定義是非對話互動式的 process 不是嗎。"
- "是否能在 subsession 中用 kill switch 來表示執行狀態？執行中的時候就亮出 kill switch。"

## Requirement Revision History

- 2026-03-27: 由單一 bug debug 擴充為 child session 產品 contract 收斂，涵蓋同步失真、輸入框邊界、running indicator 與 kill switch。
- 2026-03-27: 使用者決策為「顯示唯讀佔位」而非完全隱藏輸入區；running child 需顯示 kill switch。

## Effective Requirement Description

1. child session 必須是 subagent 的觀測面，不是可持續對話的入口。
2. child session 應顯示唯讀輸入區佔位，明示該頁不可對 subagent 對話。
3. child session 在執行中時，應以 kill switch 明確表達 running 狀態並提供停止入口。
4. child transcript、status bar、session list 對 running child 的顯示必須和 authoritative active-child state 一致。

## Scope

### IN

- child session prompt dock contract 調整
- child session running indicator / kill switch surface
- stop action 與 active-child 狀態收斂
- 子頁觀測面與 session list / status bar 一致性驗證

### OUT

- 不支援 child session 內的人工接管聊天
- 不新增 child session multi-operator collaboration
- 不擴充為通用 workflow stop center

## Non-Goals

- 不重做 subagent lifecycle
- 不改寫 task worker transport / bridge protocol
- 不引入 fallback 讓 child session 在特定狀況下仍可對話

## Constraints

- 不可新增 fallback mechanism
- 必須沿用既有 active-child / terminateActiveChild 能力，避免重複造輪子
- UI 需清楚區分 parent session（可對話）與 child session（觀測/停止）

## What Changes

- session prompt dock 需辨識 child session，改為唯讀佔位而非可提交 PromptInput
- child session header 或 dock 需顯示執行中 kill switch
- active-child state 需成為 child 頁面、status bar、session list 的共同可見性 authority

## Capabilities

### New Capabilities

- Child session kill control: 操作者可直接在 child 頁面中止正在執行的 subagent
- Child session running affordance: 沒有文字流時也能看出該 child 仍在執行

### Modified Capabilities

- Child session prompt dock: 從可互動輸入框改為唯讀佔位說明
- Child session observability: 從被動看 transcript 改為可結合 running 狀態與 kill control 的觀測面

## Impact

- packages/app session 頁面 UI/UX
- active-child state 的前端消費方式
- session route 的 child stop action 入口
- event log / regression 測試與後續文件