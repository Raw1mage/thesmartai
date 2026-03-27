# Design

## Context
- App market is surfaced as a dialog from the main layout and already acts as the product entry point for managed MCP apps plus standard MCP servers.
- The UX problem was not missing backend capability but weak dialog ergonomics on mobile/narrow screens.

## Goals / Non-Goals
**Goals:**
- Make app market mobile-usable without abandoning the existing dialog architecture.
- Preserve one unified market surface for managed apps and MCP servers.

**Non-Goals:**
- Redesigning the managed app registry backend.
- Rewriting the global dialog framework for unrelated screens.

## Decisions
- Keep app market as a dialog-based surface instead of moving it to a separate page.
- Use responsive CSS and grid behavior changes rather than introducing a separate mobile-only market implementation.
- Preserve one market component that renders both managed apps and MCP servers with status-aware actions.

## Data / State / Control Flow
- `DialogAppMarket` fetches the market list from `/api/v2/mcp/market`.
- UI state is filtered client-side and action dispatch routes to managed-app or standard MCP-server handlers.
- OAuth connect and managed app enable/disable remain integrated into the same dialog state machine.

## Risks / Trade-offs
- Responsive dialog fixes may regress desktop sizing -> mitigate with desktop layout checks and resizable dialog constraints.
- Keeping one unified component increases UI complexity -> accept this to preserve one product surface instead of splitting the experience.

## Critical Files
- `packages/app/src/components/dialog-app-market.tsx`
- `packages/app/src/components/dialog-app-market.css`
- `packages/app/src/pages/layout.tsx`
