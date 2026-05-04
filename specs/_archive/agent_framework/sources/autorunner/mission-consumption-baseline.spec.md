# Spec

## Purpose

- 定義 autorunner 在取得 approved OpenSpec mission 之後，如何最小且可驗證地消費該 mission artifact set。

## Requirements

### Requirement: Runner SHALL consume approved mission artifacts as execution input

當 session 已持有 approved OpenSpec mission contract 時，runner 不得只依賴既有 todo metadata；它必須能從 mission artifact set 讀取最小 execution input。

#### Scenario: autonomous continuation reads approved mission artifacts

- **GIVEN** session 已持有 `openspec_compiled_plan + implementation_spec + executionReady=true` 的 approved mission
- **AND** `artifactPaths` 指向完整 artifact set
- **WHEN** runtime 準備產生下一個 autonomous continuation step
- **THEN** runtime 必須能讀取至少 `implementation-spec.md`、`tasks.md`、`handoff.md`
- **AND** 將其轉成最小 mission execution input，而不是只依賴先前殘留的對話狀態

### Requirement: Runtime SHALL fail fast when approved mission artifacts are not consumable

若 session.mission 與實際 artifact set 不可讀、缺漏或不一致，runtime 必須停下並保留顯式證據。

#### Scenario: approved mission points to missing artifact

- **GIVEN** session 帶有 approved mission contract
- **AND** artifact path 指向的必要檔案不存在、為空、或缺少必要章節
- **WHEN** runtime 嘗試消費 mission
- **THEN** runtime 必須停止 autonomous continuation
- **AND** 不得只憑舊 todo graph 繼續執行
- **AND** 必須留下可觀測的 stop/anomaly evidence
