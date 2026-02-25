# Event: origin/dev refactor round52 (app behavior batch)

Date: 2026-02-26
Status: In Progress

## 1) Goal

Classify upstream app-side behavioral fixes that target `packages/app` UX/runtime paths outside current cms CLI/TUI/provider refactor focus.

## 2) Candidate(s)

- `81ca2df6ad57085b895caafc386e4ac4ab9098a6` (`fix(app): guard randomUUID in insecure browser contexts`)
- `0771e3a8bee1b099468f3c95e19bd78699f62b12` (`fix(app): preserve undo history for plain-text paste`)
- `ff0abacf4bcc78a1464f54eec2424f234c1723c9` (`fix(app): project icons unloading`)
- `958320f9c1572841c6c4b7aeba4559a79693002d` (`fix(app): remote http server connections`)
- `50f208d69f9a3b418290f01f96117308842d9e9d` (`fix(app): suggestion active state broken`)
- `0303c29e3ff4f45aff4176e496ecb3f5fa5b611a` (`fix(app): failed to create store`)
- `ff3b174c423d89b39ee8154863840e48c8aac371` (`fix(app): normalize oauth error messages`)
- `4e0f509e7b7d84395a541bdfa658f6c98f588221` (`feat(app): option to turn off sound effects`)

## 3) Decision + rationale

- Decision: **Skipped** (all)
- Rationale:
  - These are app/web client-side interaction fixes and feature toggles, not opencode runtime core paths currently being synchronized in cms rounds.
  - Porting them now would broaden scope away from ongoing origin/dev -> cms behavioral parity track for core runtime.

## 4) File scope reviewed

- `packages/app/src/**`
- `packages/app/e2e/**` (where applicable)

## 5) Validation plan / result

- Validation method: commit scope classification by package boundary and runtime impact.
- Result: skipped for current stream.

## Architecture gate

- Checked `docs/ARCHITECTURE.md` before decision.
- No architecture change applied.
