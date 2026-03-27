# Google Auth Integration Specs

Canonical feature root for Linux↔Google identity integration and shared Google OAuth boundary rules.

## Current State
- Root `proposal.md` documents the policy boundary: Linux PAM remains the primary daemon identity source, and Google identity can only act as a compatibility path when explicitly bound.
- Current repo runtime already includes implementation surfaces beyond policy-only planning:
  - shared Google OAuth token handling in `packages/opencode/src/server/routes/mcp.ts`
  - merged Gmail/Calendar OAuth scopes for managed apps
  - best-effort `GoogleBinding.bind(...)` piggyback during MCP OAuth callback
- The promoted implementation slice lives under `slices/20260325_linux-pam-per-user-daemon/`.
