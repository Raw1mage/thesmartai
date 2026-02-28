# Event: terminal popout window shows session title

Date: 2026-02-28
Status: Completed

## Decision

- Include current session/page title in the terminal popout window title for easier identification.

## Details

- Popout title format: `<current document title> · <localized terminal title>`
- Title is updated reactively while popout remains open.

## File

- `packages/app/src/pages/session/terminal-panel.tsx`
