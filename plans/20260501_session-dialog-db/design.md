# Session Dialog DB Tool Refactor Design

## Context

The runtime session message stream has moved to DB-backed storage. The system-manager MCP package exposes external tools that still need to inspect session dialogs/transcripts. These tools must use the runtime DB access boundary rather than stale file-oriented assumptions.

## Decisions

- **DD-1** Treat DB session/message APIs as the authoritative dialog source.
- **DD-2** Preserve existing tool output budgeting and pagination semantics while changing only the data source.
- **DD-3** Do not add fallback to legacy storage; missing DB data should surface as explicit absence/error.

## Critical Files

- `packages/mcp/system-manager/src/index.ts`
- session storage / message DB modules discovered during reconnaissance
- related tests under `packages/*/test/**`

## Risks

- system-manager is a separate package and may not be allowed to import runtime internals directly.
- Tool output slicing depends on message IDs/order; DB API must expose equivalent cursor semantics.
