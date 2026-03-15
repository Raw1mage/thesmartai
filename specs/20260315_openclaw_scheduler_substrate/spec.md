# Spec: openclaw scheduler substrate

## Purpose

- 定義 opencode runner 的第一階段 scheduler substrate 改造需求，讓後續 build 可在不重寫整個 daemon 的前提下，先完成 trigger 與 queue 抽象化。

## Requirements

### Requirement: Runner accepts multiple trigger sources

The runner SHALL model execution sources through an explicit trigger abstraction rather than hardcoding mission continuation as the only authority.

#### Scenario: current mission continuation still works

- **GIVEN** an approved mission with actionable todos
- **WHEN** the runner evaluates the next run
- **THEN** it must continue to work as before, but through the generic trigger contract

#### Scenario: trigger taxonomy is explicit

- **GIVEN** future heartbeat / scheduled / manual resume work
- **WHEN** build mode extends the runner
- **THEN** the trigger model must already provide stable typed entrypoints

### Requirement: Queue substrate becomes lane-aware

The runner SHALL use lane-aware queue semantics that preserve per-session serialization while allowing explicit global concurrency control.

#### Scenario: same session receives multiple runnable events

- **GIVEN** multiple runs target the same session lane
- **WHEN** they are enqueued
- **THEN** they must serialize deterministically and avoid session races

#### Scenario: global concurrency is bounded

- **GIVEN** multiple session lanes are runnable
- **WHEN** the queue drains
- **THEN** the runner must respect an explicit global concurrency boundary

### Requirement: Existing stop gates stay authoritative

The scheduler substrate SHALL preserve existing approval / decision / blocker / wait-subagent behavior.

#### Scenario: generic trigger does not bypass approval

- **GIVEN** a trigger resolves to a run that still requires approval
- **WHEN** the runner evaluates it
- **THEN** it must stop explicitly rather than auto-running through the gate
