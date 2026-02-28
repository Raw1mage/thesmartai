# Event: add web-dev to cms merge checklist

Date: 2026-02-27
Status: Completed

## Decision

- Introduce a standardized handoff checklist for merging web-dev work back into `cms`.
- Keep runtime isolation rules explicitly scoped to web debugging only.

## Artifact

- Added: `docs/handoff/web-dev-to-cms-merge-checklist.md`

## Why

- Prevent cross-user runtime contamination during web debug (`pkcs12` vs `betaman`).
- Ensure merge quality via consistent parity, validation, and event logging gates.
