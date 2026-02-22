# Event: Single Memory MCP Surface

Date: 2026-02-23
Status: Done

## Decision

- Stop auto-expanding `memory` into `memory-project` and `memory-global` MCP entries.
- Keep only one visible/configured memory MCP entry: `memory`.

## Why

- Reduce MCP status/tool surface noise.
- Match user workflow: call one memory MCP and express scope in natural language.

## Changes

- Updated `/home/pkcs12/projects/opencode/packages/opencode/src/config/config.ts`
  - Replaced layered memory expansion with single-entry normalization.
  - `memory` still defaults to repo-scoped path: `.opencode/memory/project.jsonl`.
- Synced skill docs:
  - `/home/pkcs12/projects/opencode/.opencode/skills/graphrag-memory/SKILL.md`
  - `/home/pkcs12/projects/opencode/templates/skills/graphrag-memory/SKILL.md`

## Notes

- Scope semantics (`project` vs `global`) should now be carried by agent policy/metadata rather than separate MCP server names.
