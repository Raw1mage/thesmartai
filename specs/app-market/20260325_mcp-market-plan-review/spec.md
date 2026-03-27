# Spec

## Purpose
- Define the app-market UX behavior so the MCP market dialog is usable on mobile while still serving as the unified product surface for managed apps and standard MCP servers.

## Requirements

### Requirement: App market dialog must be responsive
The system SHALL render the app market dialog in a way that remains usable on narrow/mobile viewports.

#### Scenario: narrow viewport card layout
- **GIVEN** the user opens the app market on a narrow/mobile viewport
- **WHEN** the dialog renders the market cards
- **THEN** the card grid fits within the viewport without overflowing horizontally and cards remain readable/actionable

### Requirement: App market must unify managed apps and MCP servers
The system SHALL present both managed apps and standard MCP servers within one market surface.

#### Scenario: mixed market list
- **GIVEN** the market contains managed apps and standard MCP servers
- **WHEN** the dialog loads
- **THEN** both appear in one searchable list with status-aware actions

### Requirement: Dialog interaction must remain discoverable
The system SHALL keep app-market interaction and dismissal discoverable from the visible UI.

#### Scenario: user needs to act or dismiss on mobile
- **GIVEN** a user is interacting with app market on mobile
- **WHEN** they need to search, enable/disable/connect, or dismiss the dialog
- **THEN** the visible shell provides clear enough affordances to complete those actions without relying on hidden desktop-only behavior

## Acceptance Checks
- App market renders without horizontal overflow on mobile/narrow layouts.
- Managed apps and MCP servers coexist in one market UI.
- Search and primary actions remain usable on mobile.
- Desktop layout still renders correctly after responsive fixes.
