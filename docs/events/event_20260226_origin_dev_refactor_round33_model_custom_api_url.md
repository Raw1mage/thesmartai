# Event: origin/dev refactor round33 (model custom api url)

Date: 2026-02-26
Status: In Progress

## 1) Goal

Evaluate upstream support for per-model custom API URL under current cms provider/runtime constraints.

## 2) Candidate

- Upstream commit: `ad2087094d84cb9255f08c787f8ffbe0f78fdba0`
- Subject: `support custom api url per model`

## 3) Decision + rationale

- Decision: **Skipped**
- Rationale:
  - Feature is useful, but this round is skipped to avoid accidental broad formatting drift in a highly volatile provider file.
  - Deferring to a dedicated provider-focused round with isolated formatting controls and targeted tests.

## 4) File scope reviewed

- `packages/opencode/src/provider/models.ts`
- `packages/opencode/src/provider/provider.ts`

## 5) Validation

- `bun run typecheck` (packages/opencode) → only known baseline antigravity noise (non-blocking)
- `bun run packages/opencode/src/index.ts models list` ✅

## Architecture gate

- Checked `docs/ARCHITECTURE.md` before execution.
- No architecture boundary change; no architecture doc update required.
