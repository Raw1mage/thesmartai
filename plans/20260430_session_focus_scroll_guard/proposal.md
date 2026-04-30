# Session Focus / Scroll Guard

## Requirement

User reports that while browsing the webapp session conversation, the viewport/focus is repeatedly stolen even when they are not intentionally resuming follow-bottom mode.

## Scope

IN:

- Preserve the reader's position while `autoScroll.userScrolled()` is true.
- Avoid non-user-initiated prompt autofocus while the user is in free-reading mode.
- Keep explicit user actions working: typing into an unfocused chat input, clicking resume-bottom, message navigation, terminal focus, title rename.

OUT:

- Rewriting the auto-scroll hook.
- Changing backend session/event contracts.
- Changing terminal focus semantics when the terminal panel is explicitly active.

## Constraints

- No fallback behavior that silently masks state mismatch.
- Keep changes local to the session-page / prompt focus boundary.
- Use existing `createAutoScroll` and session scroll infrastructure.
