# Proposal

## Why
- The app market dialog had become hard to use on narrow/mobile layouts: cards overflowed, the grid was cramped, and close/escape affordances were not obvious enough from the visible UI.
- App market had already become a first-class product surface for managed MCP apps and standard MCP servers, so the dialog needed production-grade responsive behavior rather than desktop-only polish.

## Original Requirement Wording (Baseline)
- "Fix the app market dialog so managed-app cards adapt on mobile and the dialog is easier to close from the UI."

## Requirement Revision History
- 2026-03-25: initial promoted slice focused on mobile card layout and close affordance improvement.
- 2026-03-26 to 2026-03-27: follow-up app-market commits refined card layout, unified MCP market behavior, and mobile dialog polish.

## Effective Requirement Description
1. App market must behave as a real product surface for both managed apps and standard MCP servers.
2. The dialog must remain readable and operable on mobile/narrow viewports without breaking desktop usability.

## Scope
### IN
- Responsive dialog sizing for app market
- Mobile-friendly card grid behavior
- Visible action/close affordances in the dialog shell
- Managed-app and MCP-server unified market presentation

### OUT
- MCP backend protocol redesign
- OAuth/token storage redesign beyond the already landed shared-token flow
- Non-app-market dialog system rewrites

## Non-Goals
- Rebuilding the entire settings or sidebar architecture
- Redesigning the managed app registry data model

## Constraints
- Preserve existing app-market routing and dialog entry point
- Do not regress desktop usability while fixing mobile layout
- Reuse existing dialog shell and managed app actions where possible

## What Changes
- Refined app-market dialog layout, sizing, and card grid behavior for mobile and desktop
- Unified the market surface so standard MCP servers and managed apps share one product view
- Improved visible affordances for search, actions, and dialog interaction

## Capabilities
### New Capabilities
- Mobile-usable app market dialog with responsive card layout
- Unified MCP market surface covering managed apps and standard servers

### Modified Capabilities
- App market presentation: moved from rough dialog layout to product-grade responsive behavior
- Managed app UX: easier install/connect/repair flow visibility inside the same market surface

## Impact
- `packages/app/src/components/dialog-app-market.tsx`
- `packages/app/src/components/dialog-app-market.css`
- `packages/app/src/pages/layout.tsx`
- related app-market/mobile UX commits and event history
