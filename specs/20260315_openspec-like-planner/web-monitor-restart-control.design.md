# Design: Web monitor + controlled restart control

## Context

This slice spans three related concerns that were handled too informally in-session:

1. sidebar/work monitor information architecture
2. controlled restart operator flow in Web settings
3. planner/todo continuity so replans do not erase visible progress truth

## Goals

- Make execution status understandable from the Web sidebar
- Represent Runner as a concrete orchestration unit
- Allow user-triggered restart with automatic recovery reload
- Prevent session todo truth from being overwritten by overlapping replans
- Re-anchor future work in planner artifacts under `specs/...`

## Non-goals

- Full planner graph engine
- Replacing current todo persistence format
- Permanent live reload channels (SSE/WebSocket auto-refresh)

## Decisions

### D1. Runner is a front-end synthesized card

Current monitor APIs do not provide a native `runner` level. Instead of blocking on backend schema changes, the UI synthesizes `[R]` by combining:

- session workflow summary
- autonomous health
- current todo/current step
- monitor entries
- tool metadata traces

This is acceptable because the goal is user-facing execution clarity, not storage-level ontology purity.

### D2. Controlled restart uses explicit action + health recovery probe

The restart flow is not a generic always-on auto-refresh system.

It is:

1. user clicks `Restart Web`
2. frontend calls `POST /api/v2/global/web/restart`
3. backend invokes configured control script
4. frontend polls `/api/v2/global/health`
5. reload occurs after recovery

This preserves user intent and avoids surprise refreshes.

### D3. Runtime control script path moves to host contract

To decouple runtime control from the repo checkout, backend restart control resolves the script path from runtime contract (`OPENCODE_WEBCTL_PATH`, default `/etc/opencode/webctl.sh`).

### D4. Todo persistence gains overlap-preserving merge semantics

`todowrite` remains a full-list write interface, but persistence now protects progress truth when the new list overlaps the same work.

Preserved states:

- `completed`
- `cancelled`
- `in_progress`

This is a targeted integrity fix, not yet a full branching planner model.

## Risks / trade-offs

### R1. Front-end synthesized runner card may diverge from future backend-native runner model

Mitigation: treat `[R]` as a presentation-layer aggregation contract for now and revisit if backend later exposes a first-class runner entity.

### R2. Overlap-preserving todo merge may keep stale items longer than desired

Mitigation: only preserve progress on overlapping items; non-overlapping lists still replace. Future planner branching should supersede this heuristic.

### R3. Restart control depends on host runtime path correctness

Mitigation: document `/etc/opencode/webctl.sh` + `OPENCODE_WEBCTL_PATH`; surface errors explicitly when missing.

## Critical files

- `packages/app/src/pages/session/session-side-panel.tsx`
- `packages/app/src/pages/session/tool-page.tsx`
- `packages/app/src/pages/session/monitor-helper.ts`
- `packages/app/src/pages/session/status-todo-list.tsx`
- `packages/app/src/components/settings-general.tsx`
- `packages/opencode/src/server/routes/global.ts`
- `packages/opencode/src/session/todo.ts`
- `templates/system/opencode.cfg`
- `install.sh`
