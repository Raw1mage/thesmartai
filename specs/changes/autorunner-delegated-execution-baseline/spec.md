# Spec

## Purpose

- 定義 autorunner 如何從 approved mission consumption baseline 前進到最小 delegated execution baseline。

## Requirements

### Requirement: Runner SHALL derive a bounded execution role from approved mission input

當 runtime 已成功消費 approved mission 時，下一個 autonomous continuation 不應只有 generic continue text；它應能產生最小且受限的 execution role hint。

#### Scenario: mission and actionable todo imply coding execution

- **GIVEN** approved mission 已成功被消費
- **AND** 當前 actionable todo 屬於實作/修改程式類工作
- **WHEN** runtime 產生下一個 continuation
- **THEN** continuation 應帶出 `coding` role hint
- **AND** 保留它是由 mission + todo 推導出的 evidence

### Requirement: Delegated execution baseline SHALL remain bounded to approved role set

第一輪 delegated execution 不得開放任意角色推導；只允許受限且可測試的角色集合。

#### Scenario: runtime selects a role for continuation

- **GIVEN** approved mission consumption 成功
- **WHEN** runtime 推導 execution role
- **THEN** 角色必須落在受支持集合內
- **AND** 第一輪至少支援 `coding`、`testing`、`docs`、`review`

### Requirement: Runtime SHALL fail soft-to-stop when delegation role cannot be derived safely

若 mission/todo 不足以安全推導角色，runtime 不得憑空亂猜更寬鬆的委派。

#### Scenario: actionable todo is too ambiguous for role derivation

- **GIVEN** mission consumption 成功
- **AND** 當前 actionable todo 沒有足夠 evidence 支撐 role 推導
- **WHEN** runtime 嘗試建立 delegated continuation
- **THEN** runtime 必須停在顯式 decision/blocker surface，或使用受限的 generic in-process continue contract
- **AND** 不得冒充已得到明確的 multi-agent delegation authority

### Requirement: Delegation evidence SHALL remain traceable in continuation metadata

#### Scenario: continuation carries delegated role metadata

- **GIVEN** runtime 已成功推導 execution role
- **WHEN** synthetic continuation 被建立
- **THEN** continuation metadata 必須保留：
  - derived role
  - role derivation source
  - 對應 todo id / content

## Acceptance Checks

- 至少新增一組測試，驗證 runtime 能從 mission + todo 推導受限 role。
- 至少新增一組測試，驗證 continuation metadata 帶有 role derivation trace。
- 至少新增一組測試，驗證模糊 todo 不會被升格成無證據的 delegation role。
