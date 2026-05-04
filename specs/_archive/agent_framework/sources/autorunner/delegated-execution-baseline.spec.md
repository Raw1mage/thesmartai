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
