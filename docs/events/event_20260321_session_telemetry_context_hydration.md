# Event: Session Telemetry Context Hydration

**Date**: 2026-03-21
**Scope**: `packages/app` session telemetry UI

## Change

- Added shared session telemetry hydration so projection refresh is no longer gated on status-mode entry.
- Context-first surfaces now hydrate telemetry from existing session/message state, then enrich with monitor data when status is opened.
- Unified account label resolution for telemetry cards and context telemetry summary.

## Files

- `/home/pkcs12/projects/opencode/packages/app/src/pages/session/session-telemetry-ui.ts`
- `/home/pkcs12/projects/opencode/packages/app/src/pages/session/tool-page.tsx`
- `/home/pkcs12/projects/opencode/packages/app/src/pages/session/session-side-panel.tsx`
- `/home/pkcs12/projects/opencode/packages/app/src/components/session/session-context-tab.tsx`

## Validation

- Targeted `@opencode-ai/app` typecheck/build after changes.
