# Event: kill-switch CLI operator entry

Date: 2026-03-16

Summary

- Added a new top-level CLI operator command: `opencode killswitch`.
- Implemented subcommands: `status`, `trigger`, and `cancel`.
- Trigger flow now prints MFA challenge response fields (`mfa_required`, `request_id`) explicitly for operator follow-up.

Implementation notes

- Endpoint contract is unchanged and still targets existing server routes under `/api/v2/admin/kill-switch/*`.
- No fallback behavior was added; non-2xx HTTP responses fail fast with explicit status + server error fields.
- Supports both local in-process runtime path and remote attach mode via `--attach`.

Validation

- Added basic CLI helper tests for trigger challenge formatting and explicit error formatting.
- Ran package-scoped tests/typecheck for `packages/opencode`.
