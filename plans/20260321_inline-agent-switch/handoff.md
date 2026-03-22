# Handoff: Inline Agent Switch

## Key Files

| File | Role |
|------|------|
| `packages/opencode/src/tool/task.ts` | Add inline mode alongside child session path |
| `packages/opencode/src/session/prompt.ts` | Agent switch detection, return handling |
| `packages/opencode/src/session/resolve-tools.ts` | Verify dynamic permission reload (likely no change) |
| `packages/opencode/src/tool/plan.ts` | Existing precedent — plan_enter/plan_exit pattern |
| `packages/app/src/pages/session/components/message-tool-invocation.tsx` | Remove SubagentActivityCard, add switch indicator |
| `packages/opencode/src/session/processor.ts` | Compaction waypoint marking |

## Precedent Code

`plan_exit` in plan.ts (lines 1026-1230) is the reference implementation:
- Creates synthetic user message with new agent ID
- Appends instructions as text part
- Next prompt loop iteration loads new agent config
- No session creation

## Risk

- **Context growth**: Shared context fills faster. Mitigation: Phase 3 compaction optimization.
- **Role confusion**: Model might mix Orchestrator and Worker behaviors. Mitigation: Clear role boundary markers in synthetic messages.
- **Regression**: Existing child session path must remain functional during migration. Mitigation: Phase 1 keeps fallback.

## Dependencies

- None external. All changes are internal to the session/prompt/tool layer.
- No API surface changes needed.
