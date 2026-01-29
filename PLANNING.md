# Planning: raw -> cms feature migration

## Goal
Migrate all custom functionality from `raw` into `cms` while preserving `origin/dev` architecture and minimizing future merge friction.

## Scope (user confirmed)
- All custom features from `raw` branch.
- Includes CLI, TUI/slash handlers, auth/account flows, provider/model changes, and plugin integrations.

## Constraints
- Prefer compatibility with current `cms` architecture.
- Avoid destructive changes; preserve existing behavior unless necessary for parity with `raw`.

## Plan
1. **Inventory & diff (include ranked list)**
   - Produce a **complete diff list** of changes unique to `raw` vs `cms`.
   - Rank by impact (High/Medium/Low) and user-facing risk.
   - Categorize by area: auth/accounts, handlers/commands, providers/models, plugins, UI/TUI.
2. **Map dependencies & conflicts**
   - Identify conflicts with `cms` structure and required refactors.
   - Note missing files, renamed modules, or upstream interface changes.
3. **Migrate by category (highest impact first)**
   - Auth/accounts (multi-account switching, Google multi-client simulation).
   - Handlers/commands (`/model-check`, `/accounts`, `/models`, etc.).
   - Provider/model transforms and health checks.
   - Plugin-specific behavior and storage schema changes.
4. **Verify parity**
   - Ensure CLI vs slash outputs match (model-check, accounts, models).
   - Run targeted tests + smoke checks for user-visible flows.
5. **Stabilize & document**
   - Update debuglog with migration notes.
   - Record any behavioral differences that cannot be reconciled.

## Handoff Notes
- Use `git diff cms..raw` and compare with `packages/opencode` focus first.
- Maintain a checklist of migrated features and validation steps.
