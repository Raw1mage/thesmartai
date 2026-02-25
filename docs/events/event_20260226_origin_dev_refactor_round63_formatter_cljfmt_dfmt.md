# Event: origin/dev refactor round63 (formatter support: cljfmt + dfmt)

Date: 2026-02-26
Status: In Progress

## 1) Goal

Port lightweight formatter capability additions from upstream for Clojure and D language files.

## 2) Candidate(s)

- `9b23130ac47442a216d84eace4032369620e548a` (`add cljfmt formatter support`)
- `160ba295a88462844457342ca74fa036f19ecede` (`add dfmt formatter support`)

## 3) Decision + rationale

- Decision: **Ported (rewrite-only)**
- Rationale:
  - Small, low-risk additive change in formatter registry.
  - No architecture impact; directly improves formatter coverage.

## 4) File scope

- `packages/opencode/src/format/formatter.ts`
  - added `cljfmt` formatter entry for `.clj/.cljs/.cljc/.edn`
  - added `dfmt` formatter entry for `.d`

## 5) Validation

- `bun run typecheck` (packages/opencode): known baseline antigravity noise only (non-blocking)
- `bun run packages/opencode/src/index.ts admin --help` ✅

## Architecture gate

- Checked `docs/ARCHITECTURE.md` before commit.
- No architecture boundary/semantic change; no architecture doc update required.
