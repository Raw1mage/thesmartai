# Event: origin/dev refactor round45 (json migration path-id test)

Date: 2026-02-26
Status: In Progress

## 1) Goal

Evaluate upstream json-migration path-derived ID regression test for applicability to cms test layout.

## 2) Candidate

- Upstream commit: `b5c8bd3421e4b89cf9dabc6ccf019a82eefc64a5`
- Subject: `test: add tests for path-derived IDs in json migration`

## 3) Decision + rationale

- Decision: **Skipped**
- Rationale:
  - Upstream test targets sqlite/json migration track and test path (`packages/opencode/test/storage/json-migration.test.ts`) not present in current cms test topology.
  - Adding this test in isolation without the related migration stack would create non-actionable coverage drift.

## 4) File scope reviewed

- Upstream path: `packages/opencode/test/storage/json-migration.test.ts`
- Current cms check: no `packages/opencode/test/storage/` test suite present.

## 5) Validation plan / result

- Validation method: test tree presence check and migration-stack dependency review.
- Result: skipped for current stream.

## Architecture gate

- Checked `docs/ARCHITECTURE.md` before decision.
- No architecture change applied.
