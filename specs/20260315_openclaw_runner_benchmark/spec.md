# Spec: openclaw runner benchmark

## Purpose

- 定義 OpenClaw 對標研究應產出的可觀測結果，讓後續 runner 改進有可執行依據。

## Requirements

### Requirement: Benchmark captures concrete control-plane patterns

The research SHALL identify concrete OpenClaw control-plane patterns for long-running autonomous execution.

#### Scenario: benchmark completes architecture capture

- **GIVEN** public OpenClaw materials are available
- **WHEN** the benchmark is written
- **THEN** it must describe execution loop, scheduler, persistence, recovery, stop gates, and observability in concrete terms

### Requirement: Gap analysis distinguishes portable and non-portable ideas

The benchmark SHALL separate what can be adopted into opencode from what should remain rejected or deferred.

#### Scenario: comparison against current workflow-runner

- **GIVEN** current autorunner architecture is documented
- **WHEN** OpenClaw patterns are compared
- **THEN** the result must classify ideas as already present, portable next, substrate-heavy, or incompatible

### Requirement: Benchmark produces an implementation-oriented next plan

The benchmark SHALL end in an implementation-oriented runner evolution plan rather than a pure research note.

#### Scenario: planning handoff is prepared

- **GIVEN** the benchmark conclusions are stable
- **WHEN** companion artifacts are updated
- **THEN** they must include proposed phases, validation strategy, and explicit stop gates for build mode

### Requirement: The next plan must preserve opencode's fail-fast boundaries

The benchmark SHALL reject portability proposals that rely on hidden fallback or ambiguous runtime authority.

#### Scenario: imported pattern conflicts with local policy

- **GIVEN** an OpenClaw pattern depends on product-specific fallback or implicit authority recovery
- **WHEN** portability is assessed
- **THEN** the plan must classify it as incompatible or require explicit approval before adoption

### Requirement: The next plan must identify a lowest-risk build entry slice

The benchmark SHALL identify a first implementation slice that improves runner substrate without immediately requiring a full daemon rewrite.

#### Scenario: build-mode planning starts

- **GIVEN** the user wants concrete implementation next
- **WHEN** the benchmark handoff is produced
- **THEN** it must nominate a lowest-risk entry slice and separate it from substrate-heavy later phases
