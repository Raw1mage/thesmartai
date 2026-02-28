# Event: terminal popout selection copy shortcut fix

Date: 2026-02-28
Status: Completed

## Problems

1. After click-only interaction, selection mode could remain latched.
2. Drag-selected text was hard to copy with standard Ctrl+C expectation.

## Fix

- Ensure temporary free-move listener is removed on pointerup to avoid lingering selection-mode behavior.
- In terminal key handler, when text selection exists, map `Ctrl+C` to copy (`document.execCommand("copy")`) instead of sending interrupt to PTY.

## File

- `packages/app/src/components/terminal.tsx`
