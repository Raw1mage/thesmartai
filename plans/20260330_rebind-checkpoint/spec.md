# Spec

## Purpose

- Define observable requirements for a shadow checkpoint mechanism that keeps a compact rebind base ready on disk, without disrupting the live conversation's prompt cache.

## Requirements

### Requirement: Background Checkpoint Save

The system SHALL produce a compaction checkpoint in the background when estimated context size exceeds a threshold, without modifying the live message chain.

#### Scenario: Context exceeds checkpoint threshold

- **GIVEN** a main session where the last finished response has token count exceeding 80K
- **WHEN** the current round completes
- **THEN** the system SHALL save a checkpoint file to disk containing the SharedContext snapshot and a message boundary marker, in a fire-and-forget manner that does not block the conversation

#### Scenario: Checkpoint does not disrupt cache

- **GIVEN** a session with 97% prompt cache hit rate
- **WHEN** a background checkpoint is saved
- **THEN** the live message chain SHALL remain unmodified and the next request SHALL achieve the same cache hit rate as before the checkpoint

### Requirement: Checkpoint Tracks Message Boundary

The system SHALL record which message ID the checkpoint covers, so the rebind path knows which messages are "new" vs "already in checkpoint".

#### Scenario: Checkpoint with boundary marker

- **GIVEN** a checkpoint saved after round N
- **WHEN** the checkpoint file is read
- **THEN** it SHALL contain a `lastMessageId` field indicating the most recent message included in the snapshot

### Requirement: Rebind Uses Checkpoint as Input Base

The system SHALL use the checkpoint as the input base on rebind, including only post-checkpoint messages as new input.

#### Scenario: Restart and rebind with checkpoint

- **GIVEN** a session with a checkpoint covering messages 1-90
- **AND** messages 91-100 have been added since the checkpoint
- **WHEN** daemon restarts and continuation is invalidated
- **THEN** the rebind payload SHALL be assembled from: checkpoint content + messages 91-100, NOT from all messages 1-100

#### Scenario: Rebind without checkpoint falls back to full context

- **GIVEN** a session with no checkpoint on disk
- **WHEN** daemon restarts and continuation is invalidated
- **THEN** the system SHALL fall back to the existing full-context rebind behavior

### Requirement: Checkpoint Cleanup

The system SHALL clean up stale checkpoint files when they are no longer needed.

#### Scenario: Checkpoint consumed on rebind

- **GIVEN** a checkpoint file exists for a session
- **WHEN** the checkpoint is successfully used for rebind and a new continuation is established
- **THEN** the old checkpoint file SHALL be deleted (a new one will be saved on the next threshold crossing)

## Acceptance Checks

- Background checkpoint save produces a file at `{state}/rebind-checkpoint-{sessionId}.json` without modifying any message in session storage.
- Checkpoint file contains `snapshot`, `lastMessageId`, and `timestamp` fields.
- Rebind payload size with checkpoint is measurably smaller than without (< 200KB vs 850KB+ baseline).
- Prompt cache hit rate remains stable during normal operation when checkpoints are being saved in background.
- Stale checkpoint files are removed after successful rebind.
