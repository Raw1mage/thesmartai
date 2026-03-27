# Google Auth Integration Specs

Canonical feature root for Linux↔Google identity integration and shared Google OAuth boundary rules.

## Current State Summary

This root currently contains both a **policy boundary** and **implemented integration behavior**.

### Canonical policy
- Linux PAM remains the primary daemon identity source.
- Google identity may only act as a compatibility path when it is explicitly bound to a Linux user.
- Unbound Google identity must fail fast rather than silently routing to another daemon identity.

### Current implementation reality
- Shared Google OAuth token handling already exists in MCP routes.
- Gmail/Calendar managed apps already share Google OAuth infrastructure and merged scopes.
- MCP OAuth callback already performs best-effort Google identity binding piggyback via `GoogleBinding.bind(...)`.
- The promoted slice `slices/20260325_linux-pam-per-user-daemon/` contains the implementation-specific planning/validation package for the Linux↔Google bridge work.

## How to Read This Root

- Treat `proposal.md` as the canonical policy and identity-boundary contract.
- Treat `packages/opencode/src/server/routes/mcp.ts` plus the slice under `slices/` as the current implementation truth.
- Do not read this root as "policy only, no implementation" anymore.
