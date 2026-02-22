# Event: origin/dev refactor item - GitHub variant support

Date: 2026-02-23
Status: Integrated (no code delta)

## Source

- `241059302` fix(github): support variant in github action and opencode github run

## Analysis

- cms current state already includes equivalent variant flow:
  - `github/action.yml` defines optional `inputs.variant` and forwards `VARIANT` env to runtime.
  - `packages/opencode/src/cli/cmd/github.ts` reads `process.env["VARIANT"]` and passes `variant` into both primary and summary `SessionPrompt.prompt(...)` calls.

## Decision

- Marked as already integrated.
- No additional code change required for this refactor item.
