# Spec

## Purpose

- 將高成本但非永久必要的 prompt blocks 從 append-only context 轉為 runtime-governed managed layers，先解決 skill prompt 用完後持續陪跑直到對話結束的 token 浪費問題。

## Requirements

### Requirement: Preserve immutable core prompt boundary

The system SHALL keep safety, role, and operational-boundary prompt blocks outside the unloadable skill layer lifecycle.

#### Scenario: Build next-round prompt after a skill was used earlier

- **GIVEN** core system prompt blocks and a previously loaded skill
- **WHEN** the next round prompt is assembled and the skill is no longer active
- **THEN** the core prompt blocks remain injected unchanged
- **AND** the prior skill full body is not automatically re-injected
- **AND** a smaller residue/summary may remain only if lifecycle policy says it is needed

### Requirement: Runtime-owned skill lifecycle state

The system SHALL store skill-layer lifecycle state as runtime-owned metadata rather than relying on the model to remember previously loaded skills.

#### Scenario: Skill is loaded in round N and becomes idle by round N+2

- **GIVEN** a skill was loaded and recorded by the runtime
- **WHEN** later rounds no longer require that skill
- **THEN** the runtime can mark the skill layer idle or unloaded based on policy
- **AND** the next prompt assembly uses runtime state to decide injection
- **AND** no transcript deletion or hidden fallback occurs

### Requirement: Provider-aware unload gate

The system SHALL gate unload behavior by provider pricing mode before applying token-reduction policy.

The provider pricing mode SHALL be read from a provider-level setting in the model manager, which is the single source of truth.

The setting SHALL be keyed by canonical provider key.

#### Scenario: Current session runs on a by-request provider

- **GIVEN** the active provider charges by request instead of token volume
- **WHEN** the runtime evaluates whether to unload an idle skill layer
- **THEN** aggressive unload is not enabled by default
- **AND** the system prefers prompt stability unless separate evidence shows unload is beneficial

#### Scenario: Pricing mode is unknown

- **GIVEN** the runtime cannot resolve a trusted pricing mode for the active execution surface
- **WHEN** unload policy is evaluated
- **THEN** aggressive unload is not enabled
- **AND** the system treats the session as conservative until pricing metadata is explicit

### Requirement: Provider billing mode is operator-visible and editable

The system SHALL expose provider billing mode in the model manager so the operator can review and modify the value that runtime uses as the SSOT.

#### Scenario: Runtime ships with a default value for a provider

- **GIVEN** the product provides a default billing mode for a provider
- **WHEN** the operator reviews that provider in the model manager
- **THEN** the current billing mode is visible
- **AND** the operator can change it
- **AND** the saved value becomes the authority used by unload policy

### Requirement: Unload only governs prompt-resident layers

The system SHALL treat unload as governance over prompt-resident content, not as proof about the model's internal working memory.

#### Scenario: A skill was previously injected and the model may already have absorbed some of it

- **GIVEN** prior rounds exposed the model to a skill prompt
- **WHEN** the runtime unloads the skill layer from future prompt injection
- **THEN** the runtime only claims that future prompt payload is smaller
- **AND** it does not assume or assert that all skill influence has been erased from model working state

### Requirement: Observable unload policy

The system SHALL make unload decisions inspectable through telemetry or explicit layer-state evidence.

#### Scenario: A skill layer is skipped from the next prompt

- **GIVEN** the layer registry marks a skill as unloadable and currently idle
- **WHEN** prompt telemetry is emitted for the next model call
- **THEN** telemetry records that the skill layer was skipped or summarized
- **AND** the decision includes enough evidence to explain why it was not injected

### Requirement: AI-guided unload decision

The system SHALL allow the AI/runtime to decide when a skill is no longer relevant to the current topic, subject to provider and safety gates.

#### Scenario: Topic changes and a previously loaded skill becomes irrelevant

- **GIVEN** the user has shifted to a different topic
- **WHEN** the AI judges the previously loaded skill is no longer needed for upcoming rounds
- **THEN** the runtime may silently stop re-injecting that skill layer
- **AND** the decision remains observable through lifecycle state and telemetry
- **AND** provider pricing mode can still veto aggressive unload behavior

### Requirement: Session-scoped pin

The system SHALL treat v1 pin as session-scoped, not topic-scoped.

#### Scenario: Operator pins a skill layer

- **GIVEN** a skill layer has been pinned during the current session
- **WHEN** later rounds would otherwise demote or unload that layer
- **THEN** the runtime keeps the layer in `full` state
- **AND** it remains so until explicit unpin or session end

### Requirement: Status Tab skill control surface

The system SHALL expose v1 manual skill-layer controls in `Status Tab` through a `Skill Layers` card.

#### Scenario: Operator reviews current skill layer lifecycle

- **GIVEN** one or more skill layers exist for the current session
- **WHEN** the operator opens `Status Tab`
- **THEN** the `Skill Layers` card shows each skill's current state and pin status
- **AND** the operator can trigger manual actions such as pin/unpin, promote, demote, or unload

### Requirement: Fixed-width summary residue

The system SHALL represent `summary` state with a compact structured residue instead of a freeform long-form summary.

#### Scenario: Runtime demotes a skill from `full` to `summary`

- **GIVEN** a skill layer is no longer worth full injection
- **WHEN** the runtime chooses `summary`
- **THEN** the injected residue contains only the minimal structured fields needed for continuity
- **AND** the residue does not expand into an unbounded prose block

### Requirement: Relevance-driven keepRules retention

The system SHALL retain `keepRules` based on whether those rules are still needed for future rounds, not by an arbitrary numeric cap.

#### Scenario: A summarized skill still has multiple forward-relevant constraints

- **GIVEN** a skill has been demoted to `summary`
- **WHEN** several rules remain relevant to upcoming work
- **THEN** the runtime may keep all still-relevant rules in `keepRules`
- **AND** `lastReason` remains a short description rather than a long explanation

### Requirement: Incremental rollout

The system SHALL support adopting lifecycle management one layer family at a time.

#### Scenario: First rollout only covers skill layer

- **GIVEN** lazy tool catalog and other optional blocks still use existing logic
- **WHEN** the first build slice lands
- **THEN** skill prompt lifecycle is managed by the new layer mechanism
- **AND** other layer families continue to work without requiring a big-bang migration

## Acceptance Checks

- A plan reviewer can point to a concrete boundary between `always-on core` and `managed layers`.
- A build agent can implement skill lifecycle state without deleting old messages.
- Idle skill unload is explainable by runtime evidence, not assistant memory.
- The first implementation slice does not require rewriting compaction or provider transport.
