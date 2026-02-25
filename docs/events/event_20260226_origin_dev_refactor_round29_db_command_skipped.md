# Event: origin/dev refactor round29 (db command)

Date: 2026-02-26
Status: In Progress

## 1) Goal

Evaluate upstream DB inspection command feature for rewrite-only adoption in cms without violating current storage/runtime boundaries.

## 2) Candidate

- Upstream commit: `45f0050372a1bc035164a5953b1fdb46df106d4a`
- Subject: `core: add db command for database inspection and querying`

## 3) Decision + rationale

- Decision: **Skipped**
- Rationale:
  - Upstream change depends on sqlite DB module layout (`packages/opencode/src/storage/db.ts`, `Database.Path`) and direct sqlite shell/query exposure.
  - Current cms storage architecture is file/index based under `storage/storage.ts` and does not ship the referenced `storage/db.ts` runtime surface.
  - Porting this feature would introduce a new architecture boundary instead of a localized behavior refactor, so it is out-of-scope for current rewrite-only delta rounds.

## 4) File scope reviewed

- Upstream touched:
  - `packages/opencode/src/cli/cmd/db.ts`
  - `packages/opencode/src/index.ts`
  - `packages/opencode/src/storage/db.ts`
- Current cms check:
  - `packages/opencode/src/storage/db.ts` absent
  - storage behavior centralized in `packages/opencode/src/storage/storage.ts`

## 5) Validation plan / result

- Validation method: upstream diff inspection + current tree capability check.
- Result: skipped as architecture-mismatch (non-local feature introduction).

## Architecture gate

- Checked `docs/ARCHITECTURE.md` before decision.
- No architecture change applied in this round.
