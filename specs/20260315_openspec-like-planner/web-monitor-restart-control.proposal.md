# Proposal: Web monitor + controlled restart control

Date: 2026-03-15
Status: Draft
Branch: cms
Workspace: /home/pkcs12/projects/opencode

## Intent

Turn the Web session sidebar into a simpler, execution-centered control surface, and add a controlled Web restart flow that can safely recover the page after runtime restart.

## Why this exists

- The old sidebar accumulated Smart Runner-oriented cards and summary fragments that were hard to understand.
- Runner state was not shown as a meaningful execution unit.
- Web restart required manual shell work and manual browser reload.
- The current session exposed a planner/process gap: implementation drifted ahead of a durable plan artifact.

## Scope

### In

- Session sidebar / tool-page work monitor simplification
- Runner card as a first-class execution card
- Todo presentation cleanup
- Controlled Web restart API + Web settings entry
- Planner retrofit for this session so future work continues from artifacts, not ad hoc chat memory

### Out

- Full planner runtime redesign
- Production/system install automation beyond documented runtime path contract
- New backend workflow runner semantics

## Constraints

- No silent fallback mechanisms
- Must preserve fail-fast runtime behavior
- Web runtime remains controlled by `webctl.sh` contract, not direct arbitrary restart calls
- Planner artifacts must become the source of truth for continued work in this session

## Non-goals

- Replacing todo with a full graph planner in this slice
- Redesigning all settings UI categories
- Introducing always-on live auto-refresh
