# Event: MCP Residency Rationalization

Date: 2026-02-23
Status: Done

## 1. Decision Summary

- Adopted **minimal resident MCP set** for daily usage: `system-manager`, `memory`, `fetch`.
- Converted other configured MCP servers to **on-demand** mode (`enabled: false`).
- Confirmed `memory-global` and `memory-project` are **not separate configured MCP entries** in current `~/.config/opencode/opencode.json`.

## 2. Applied Changes

- Updated global config: `/home/pkcs12/.config/opencode/opencode.json`
  - `fetch.enabled = true`
  - `memory.enabled = true`
  - `system-manager.enabled = true`
  - `filesystem.enabled = false`
  - `sequential-thinking.enabled = false`
  - `refacting-merger.enabled = false`

## 3. Rationale

- Reduce baseline runtime overhead and tool-surface complexity.
- Lower accidental tool selection risk.
- Keep common operations available while preserving capability to toggle specialized tools when needed.

## 4. Notes / Follow-up

- `memory-global` / `memory-project` should be treated as namespace-level memory routing behavior, not necessarily independent MCP entries in current config.
- If needed, next step is to codify routing policy (project-first, global-only-when-cross-project) in AGENTS/SYSTEM guidance.
