# Event: terminal new-tab clean surface fix

Date: 2026-02-28
Status: Completed

## Problem

- Creating a new terminal tab could briefly show previous terminal visual content (frame bleed).

## Fix

- Hard-reset terminal host container DOM before opening a new terminal renderer.
- Hard-reset terminal host container again on component cleanup.

## File

- `packages/app/src/components/terminal.tsx`
