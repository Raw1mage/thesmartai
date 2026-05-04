# Account Management Specs

Canonical feature root for account, provider, and identity-management behavior.

## Current State Summary

This root currently contains both a **target architecture contract** and **live implementation reality**.

### Canonical target
- `proposal.md` and `spec.md` define the desired 3-tier model:
  1. `Account` as strict storage
  2. `Auth` as the unified identity/service layer
  3. CLI/TUI/Web as thin presentation clients

### Current implementation reality
- `Auth` already owns substantial smart-layer behavior:
  - OAuth/API deduplication
  - token-based account reconciliation
  - collision handling for many add/update flows
- `Account` still retains compatibility and provider-adjacent responsibilities:
  - provider/family compatibility aliases
  - known provider universe assembly
  - storage normalization and migration logic
- The promoted slice `slices/20260327_provider-llmgateway-bug/` extends this domain into provider-registry / provider-SSOT behavior.

## How to Read This Root

- Treat `proposal.md` / `spec.md` as the canonical target architecture.
- Treat `packages/opencode/src/auth/index.ts` and `packages/opencode/src/account/index.ts` as the current implementation truth.
- Treat `slices/20260327_provider-llmgateway-bug/` as an implementation slice that broadened this root from pure account CRUD into account/provider universe management.
