# Design

## Baseline

- `packages/app/src/pages/session.tsx` owns the session scroller, active-message state, prompt dock height, keyboard autofocus, lazy render/backfill, and wiring into `useSessionHashScroll`.
- `packages/app/src/pages/session/use-session-hash-scroll.ts` can programmatically scroll to bottom or a message anchor when session/hash/message state changes.
- `packages/app/src/components/prompt-input.tsx` intentionally focuses the composer for editor-local operations; page-level global autofocus is the broader browsing-mode risk.

## Decisions

- **DD-1** Treat `autoScroll.userScrolled()` as the explicit free-reading signal for the session page.
- **DD-2** Non-user-initiated initial hash handling must not scroll to bottom while free-reading is active.
- **DD-3** Page-level printable-key autofocus must not steal focus while free-reading is active unless the event target is already the session page and no dialog/blocker is active.
- **DD-4** Lazy render/backfill may still preserve scroll position, but must not resume bottom or clear the active reading anchor unless the user explicitly resumes.

## Critical Files

- `packages/app/src/pages/session.tsx`
- `packages/app/src/pages/session/use-session-hash-scroll.ts`
- `packages/app/src/pages/session/use-session-hash-scroll.test.ts`
- `packages/app/src/pages/session/session-prompt-dock.test.ts`

## Risks

- Over-guarding autofocus could make typing-to-focus feel broken.
- Over-guarding hash scroll could break deep links.
- Scroll preservation changes must avoid fighting lazy history loading.
