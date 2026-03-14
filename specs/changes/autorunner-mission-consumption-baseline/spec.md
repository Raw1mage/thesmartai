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

### Requirement: Mission consumption SHALL preserve artifact role boundaries

runtime 消費 mission 時，不得把所有 artifact 混成一段自由文字；必須保留最小的角色分工。

#### Scenario: runtime derives mission execution input

- **GIVEN** approved mission artifacts 可讀
- **WHEN** runtime 建立 mission execution input
- **THEN** `implementation-spec.md` 提供 goal / scope / stop gates / validation baseline
- **AND** `tasks.md` 提供 execution ordering / checklist seed
- **AND** `handoff.md` 提供 executor required reads / stop gates / execution-ready hints

### Requirement: Mission-derived execution input SHALL be traceable in continuation flow

mission consumption 產出的 execution input 必須能回流到 autonomous continuation surface，讓後續調試能知道 runner 是根據哪組 mission content 前進。

#### Scenario: continuation metadata references consumed mission

- **GIVEN** runtime 已成功消費 approved mission
- **WHEN** 產生下一個 synthetic continuation
- **THEN** continuation metadata 或等價 runtime surface 必須能指出 mission 是由哪些 artifact 讀得
- **AND** 至少保留 implementation spec / tasks / handoff 的 consumption evidence

### Requirement: First mission consumption slice SHALL avoid implicit fallback

mission consumption 失敗時，不得偷偷回退成純 todo-driven autonomy。

#### Scenario: mission read fails but todos still exist

- **GIVEN** session 中仍有可執行 todos
- **AND** approved mission artifacts 讀取或驗證失敗
- **WHEN** runtime 做 continuation decision
- **THEN** 系統必須停下並回報 mission consumption failure
- **AND** 不得以「反正 todos 還在」作為靜默 fallback 依據

## Acceptance Checks

- 至少新增一組測試，驗證 runtime 可從 approved mission artifacts 讀出最小 execution input。
- 至少新增一組測試，驗證 mission artifact 缺漏時會 fail-fast 而不是只靠 todos 繼續。
- 至少新增一組測試，驗證 continuation surface 保留 mission consumption trace。
