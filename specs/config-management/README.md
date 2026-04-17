# Config Management Specs

Canonical feature root for how the daemon loads, merges, snapshots, and surfaces errors from user configuration.

## What lives here

- **Three-file split layout** (post-2026-04-17):
  - `~/.config/opencode/opencode.json` — boot-critical keys (`$schema`, `plugin`, `permissionMode`, etc.)
  - `~/.config/opencode/providers.json` — provider overrides + `disabled_providers`
  - `~/.config/opencode/mcp.json` — MCP server definitions
  - Legacy all-in-one `opencode.json` remains fully supported; the split files are optional additive overlays.
- **Error isolation contract**: `Config.JsonError`, `Config.InvalidError`, `Config.ConfigDirectoryTypoError` → HTTP 503 with structured body. Raw config text is never returned to the webapp.
- **Last-known-good snapshot** at `$XDG_STATE_HOME/opencode/config-lkg.json`. Atomic write on every successful `createState()`; `log.warn` on fallback identifies the failed path, line, and snapshot age.
- **ProviderAvailability API** — `enabled | disabled | no-account` derived from `accounts.json` + `disabled_providers` override. Runtime `isProviderAllowed` semantics unchanged (see `design.md` DD-8).
- **Operator-invoked migrations**:
  - `scripts/migrate-disabled-providers.ts` — prunes redundant entries (109 → 6 in the original incident).
  - `scripts/migrate-config-split.ts` — splits a legacy opencode.json into the three-file layout.

## How to read this root

- `proposal.md` — why this root exists (the 2026-04-17 raw-config-leak incident) and the effective requirement description.
- `spec.md` — GIVEN/WHEN/THEN behavioral requirements (parse-failure defense, section isolation, webapp never renders raw text, provider availability derivation, backwards compatibility, AGENTS.md rule #1 compliance).
- `design.md` — DD-1 through DD-8 capturing the decisions made and trade-offs rejected. DD-8 in particular explains why Phase 2 did NOT change `isProviderAllowed` runtime behavior.
- `implementation-spec.md` — execution contract that drove the phased delivery.
- `tasks.md` — execution checklist with all three phases marked done.
- `handoff.md` — final state record after fetch-back + merge.
- `idef0.json` / `grafcet.json` / `c4.json` / `sequence.json` — formal models (produced by `miatdiagram` skill) covering functional decomposition, state transitions, component structure, and runtime flows.
- `plan.md` — original pre-artifact draft kept for historical context; superseded by the structured artifacts above.

## Authority and relationship to other specs

- `specs/architecture.md` "Config Resolution Boundary" section carries the condensed canonical summary and the split-file + crash-defense contract. When this subsystem changes materially, keep the two in sync.
- Provider availability derivation is logically adjacent to `specs/account-management/` (accounts drive availability) but the authority for the *derivation logic itself* (`packages/opencode/src/provider/availability.ts`) lives under this root because the trigger is config loading, not account storage.
- MCP subsystem (`specs/mcp_subsystem/`) consumes `mcp.json` but owns its own lifecycle contracts. This root only documents how `mcp.json` is loaded and isolated.

## Implementation truth

- `packages/opencode/src/config/config.ts` — `JsonError`, `buildJsoncParsePayload`, `createState` wrapper with LKG, `loadSectionFile` helper, split-file merge inside `createStateInner`.
- `packages/opencode/src/server/app.ts` — `onError` mapping to 503 for config errors.
- `packages/opencode/src/provider/availability.ts` — availability API.
- `packages/app/src/utils/server-errors.ts` — webapp formatting + truncate guard.
- `scripts/migrate-*.ts` — operator migration tools.
- `templates/opencode.json` / `templates/providers.json` / `templates/mcp.json` + `templates/manifest.json` — fresh-install scaffolding.

## Incident trail

- `docs/events/event_2026-04-17_config_crash.md` — the precipitating incident and Phase 1 remediation.

## Completion status

Phases 1+2+3 merged into `main` on 2026-04-17 as a single bundled merge (plus the unrelated pre-flight-cooldown hotfix, which lives under `specs/account-management/` / the rotation subsystem territory rather than here).
