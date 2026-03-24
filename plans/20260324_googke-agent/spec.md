# Spec

## Purpose

- 把 MCP 型擴充能力升級為 opencode 內建治理的 app market，並以 Google Calendar 驗證這條架構路徑可行。

## Requirements

### Requirement: Managed App Market

The system SHALL provide a managed app market that treats installable MCP-powered capabilities as first-class runtime entities.

#### Scenario: List installable apps

- **GIVEN** operator opens app management surface in Web or TUI
- **WHEN** the system loads the app catalog
- **THEN** it shows available apps, install state, enabled state, required permissions, and configuration status from a single backend authority

#### Scenario: Install and enable an app

- **GIVEN** an app exists in the built-in catalog and is not installed
- **WHEN** operator installs and enables the app
- **THEN** the runtime materializes the app, persists install state, and exposes its tools/capabilities without requiring manual server wiring

### Requirement: Fail-Fast App Lifecycle

The system SHALL fail fast when an app is misconfigured, unauthenticated, or incompatible, instead of silently falling back.

#### Scenario: App missing required configuration

- **GIVEN** an installed app lacks mandatory credentials or settings
- **WHEN** operator or LLM attempts to use the app
- **THEN** the system returns an explicit app-specific error state and preserves evidence for remediation

### Requirement: Google Calendar As Managed App

The system SHALL support Google Calendar as a managed app that exposes calendar operations through LLM-compatible tool contracts.

#### Scenario: Natural-language calendar request

- **GIVEN** Google Calendar app is installed, enabled, and authenticated
- **WHEN** a user asks to create, update, search, or delete calendar events using natural language
- **THEN** the model can resolve the intent through the app's tool surface and execute the corresponding Google Calendar operation

#### Scenario: Google account authorization required

- **GIVEN** Google Calendar app is enabled but not yet authorized
- **WHEN** a user issues a calendar command
- **THEN** the system does not guess or fallback, and instead surfaces an explicit authorization-required state with the proper next step

### Requirement: Unified Identity Ownership

The system SHALL keep app-specific credentials and OAuth sessions under the existing unified account/auth authority.

#### Scenario: App requests OAuth-based account connection

- **GIVEN** Google Calendar app requires OAuth
- **WHEN** operator starts the connect flow
- **THEN** the resulting account identity and token lifecycle are managed through the canonical auth/account surfaces rather than an app-local account store

## Acceptance Checks

- Plan artifacts explicitly define app catalog authority, install lifecycle, and runtime ownership.
- Google Calendar app plan explicitly defines auth, config, tool surface, and error boundaries.
- No requirement text depends on fallback defaults, global implicit account selection, or external server assumptions.
- Validation command contract is explicit about what is runnable now versus planned build-slice commands that must be added before MVP acceptance.
- Operator-visible acceptance checks cover install, configure completeness, authorization-required gating, enable/disable state transitions, runtime-ready status, and fail-fast error states.
- Acceptance remains blocked unless Google Calendar is exposed as a managed registry app under a single backend authority, with no silent fallback to alternate accounts, providers, or external MCP wiring.
- Acceptance remains blocked until doc sync verification passes: `docs/events` must record the shipped install/auth/config/runtime/operator/error behavior and `specs/architecture.md` must record the durable managed-app architecture boundaries introduced by this MVP.
