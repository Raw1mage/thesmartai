# Event: origin/dev refactor item - snapshot respects info exclude

Date: 2026-02-23
Status: Done

## Source

- `ac0b37a7b` fix(snapshot): respect info exclude in snapshot staging

## Refactor Outcome

- Core snapshot behavior in `packages/opencode/src/snapshot/index.ts` is already integrated on cms:
  - `track/patch/diff` all call shared `add(git)`
  - `add(git)` syncs `.git/info/exclude` before staging
- Added missing regression coverage in:
  - `packages/opencode/test/snapshot/snapshot.test.ts`
    - `git info exclude changes`
    - `git info exclude keeps global excludes`

## Validation

- `bun test --timeout 15000 /home/pkcs12/projects/opencode/packages/opencode/test/snapshot/snapshot.test.ts` ✅
