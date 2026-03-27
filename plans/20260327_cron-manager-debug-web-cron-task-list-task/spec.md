# Spec

## Purpose

- 將 child session 明確定義為 subagent 觀測與停止介面，而非可互動對話介面，並讓執行中狀態對操作者保持可見。

## Requirements

### Requirement: Child Session Is Read-Only For Conversation

The system SHALL prevent users from sending conversational input from a child session.

#### Scenario: Child session shows read-only prompt placeholder
- **GIVEN** the user opens a session whose `parentID` is set
- **WHEN** the session page renders the prompt dock
- **THEN** the page shows a read-only placeholder explaining that subagent sessions are not conversational entry points
- **AND** no submit-capable prompt input is rendered

### Requirement: Running Child Session Exposes Kill Switch

The system SHALL expose a kill switch when the opened child session is the authoritative active child of its parent and is still running.

#### Scenario: Running child shows kill switch
- **GIVEN** the opened session is a child session and matches the parent session's authoritative active child
- **WHEN** the subagent is still running
- **THEN** the child session UI shows a visible kill switch
- **AND** the same UI state indicates the child is currently active even if no new text is streaming

#### Scenario: Completed child hides kill switch
- **GIVEN** the opened child session is no longer running or is no longer the authoritative active child
- **WHEN** the prompt dock refreshes
- **THEN** the kill switch is hidden or disabled
- **AND** the child session no longer appears as actively running solely from stale local transcript state

### Requirement: Stop Action Uses Existing Active-Child Contract

The system SHALL terminate child execution through the existing active-child termination contract rather than inventing a new child-local control path.

#### Scenario: Kill switch stops the child session
- **GIVEN** a running child session shows the kill switch
- **WHEN** the operator clicks the kill switch
- **THEN** the system invokes the existing active-child termination path for the parent session
- **AND** child page, status bar, and session list converge away from running state after the stop completes

## Acceptance Checks

- Child session pages never render a submit-capable `PromptInput`
- Child session pages render a read-only placeholder explaining the non-conversational contract
- A running authoritative child shows a kill switch even when no text output is streaming
- Stopping from child session clears running affordances across child page, bottom status, and session list
- Non-active or completed child sessions do not keep showing running affordances from stale state