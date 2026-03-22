# Spec: autorunner

## Purpose

- 定義 autorunner 的 canonical behavioral contract，整合 approved-plan authority、mission consumption、delegated execution baseline 與最小 runtime evidence substrate。

## Requirements

### Requirement: Runner SHALL only execute approved compiled plans

runner 的自主執行權來源必須是已批准且已完整編譯的 OpenSpec-style 計畫文件，而不是未批准的對話或模糊 todo 狀態。

#### Scenario: runner starts autonomous work

- **GIVEN** session 持有 approved mission contract
- **AND** mission artifact set 完整可讀
- **WHEN** runner 準備繼續 execution
- **THEN** 它只能依該 mission 的 scope / tasks / stop gates / validation contract 推進

### Requirement: Runner SHALL consume approved mission artifacts as execution input

runner 不得只依賴殘留 todo metadata；它必須讀取 approved mission 的核心 artifacts 作為 execution input。

#### Scenario: continuation reads approved mission artifacts

- **GIVEN** approved mission 指向完整 artifact set
- **WHEN** runtime 準備建立下一步 continuation
- **THEN** runtime 必須至少消費 `implementation-spec.md`、`tasks.md`、`handoff.md`
- **AND** 保留 consumption trace

### Requirement: Runner SHALL derive bounded delegated execution roles

當 mission consumption 成功且 evidence 足夠時，runtime 應產生受限的 execution role hint，而不是維持完全 generic 的 continuation。

#### Scenario: mission and todo imply execution role

- **GIVEN** approved mission 已成功被消費
- **AND** actionable todo 具備足夠 evidence
- **WHEN** runtime 產生 synthetic continuation
- **THEN** role 必須落在 `coding`、`testing`、`docs`、`review`、`generic` 之內
- **AND** continuation metadata 必須保留 role derivation trace

### Requirement: Runtime SHALL fail fast on non-consumable mission state

mission artifact 缺漏、不可讀、或與 session mission 不一致時，runtime 必須停止並留下顯式 evidence。

#### Scenario: approved mission points to missing or invalid artifacts

- **GIVEN** session 中仍可能存在 todos
- **WHEN** approved mission artifacts 不可消費
- **THEN** runtime 必須停止 autonomous continuation
- **AND** 不得回退成純 todo-driven silent fallback

### Requirement: Runtime SHALL record explicit anomaly evidence

autonomous workflow 中的重要 mismatch 狀態必須被記錄成結構化 runtime event。

#### Scenario: stale wait_subagent loses worker/process truth

- **GIVEN** parent workflow 仍停在 `wait_subagent` 類語義
- **AND** 已無 active subtask 或 process truth 支撐
- **WHEN** runtime 重新評估 continuation
- **THEN** 系統必須留下 explicit anomaly evidence，例如 `unreconciled_wait_subagent`

### Requirement: Bootstrap and runner contracts SHALL remain delegation-first and gate-driven

planner/bootstrap/prompt contracts 必須讓 delegation、integration、validation 成為預設執行路徑，而不是把 narration 誤當成 user handoff。

#### Scenario: autonomous build-mode continuation advances work

- **GIVEN** approved mission 與 planner-derived execution context 都已就緒
- **WHEN** runner 繼續工作
- **THEN** 它應優先推進當前 actionable step 或下一個 dependency-ready delegated step
- **AND** 只有 stop gate、approval gate、product decision 或 blocker 才能結束執行

## Acceptance Checks

- `specs/autorunner/` contains the canonical six files.
- Supporting mission/delegation slices exist under the same canonical root.
- The canonical contract preserves approved-plan authority, mission consumption trace, bounded delegated roles, and explicit anomaly evidence.
- No automatic silent fallback from mission failure to generic todo-driven autonomy is introduced.
