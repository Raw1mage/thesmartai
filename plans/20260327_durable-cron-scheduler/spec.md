# Spec

## Purpose

- 定義一個可跨 daemon restart 恢復的 app-native cron scheduler MVP，確保 schedule 能被持續接手，而不因 runtime 重啟失效。

## Requirements

### Requirement: Scheduler Recovers On Daemon Restart

The system SHALL recover persisted cron scheduling state when the daemon starts and resume future execution without relying on OS cron.

#### Scenario: Restart resumes future scheduling
- **GIVEN** a cron job exists in persistent store before daemon restart
- **WHEN** the daemon starts again
- **THEN** the scheduler reconciles persisted state
- **AND** the job keeps its future schedule ownership inside the daemon runtime
- **AND** the next eligible future slot can still execute automatically

### Requirement: Missed Runs Are Skipped In MVP

The system SHALL skip missed schedule windows that occurred while the daemon was offline, and resume from the next future slot.

#### Scenario: Missed slot during downtime is not replayed
- **GIVEN** a recurring cron job had one or more scheduled windows while the daemon was offline
- **WHEN** the daemon restarts
- **THEN** the scheduler does not replay all missed windows
- **AND** it computes the next future slot after restart time

### Requirement: Durable Scheduler State Must Survive Restart

The system SHALL persist enough scheduler state to reconcile execution after restart instead of depending solely on an in-memory heartbeat interval.

#### Scenario: Persisted state guides reconciliation
- **GIVEN** a cron job was created and had scheduler metadata written before restart
- **WHEN** the daemon restarts
- **THEN** reconciliation reads persisted scheduler state
- **AND** derives the next future run decision from persisted data plus current time

## Acceptance Checks

- Restarting the daemon does not make existing cron jobs disappear or stop scheduling forever
- Missed runs during downtime are skipped, not replayed, in MVP
- A future due slot after restart produces a new run log automatically
- Scheduler recovery does not require Linux system cron