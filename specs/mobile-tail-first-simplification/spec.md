# Spec: Mobile Tail-First Session Simplification

## Purpose

One initial-load path (tail-first), one live path (SSE patch-in-place), one on-demand path (user-scrolled load-more). Every other "continuity" mechanism is deleted.

---

## Requirements

### Requirement: R1 — Tail-first initial load

The only way to populate the session store on open is to fetch the last N messages.

#### Scenario: User opens a session cold (no store)

- **GIVEN** the user navigates to `/session/:id` with an empty client store
- **WHEN** the app hydrates
- **THEN** the app calls `GET /session/:id/message?limit=N` where N = `session_tail_mobile` (30) on mobile, `session_tail_desktop` (200) on desktop
- **AND** the response is the chronologically-ordered last N messages
- **AND** no cursor, `beforeMessageID`, or `Last-Event-ID` header is sent

#### Scenario: User reopens a session with existing store

- **GIVEN** the session is already in the store from a previous visit
- **WHEN** the app re-enters the session route
- **THEN** the store is discarded and R1 Scenario 1 runs again (no resume, no delta merge)

#### Scenario: Session has fewer than N messages

- **GIVEN** the session has M messages, M < N
- **WHEN** R1 fires
- **THEN** all M messages are returned; no padding, no error

---

### Requirement: R2 — SSE live patch-in-place only

SSE delivers only events that occur after the subscription starts. No replay, no resume.

#### Scenario: New part streams in

- **GIVEN** the store is populated (via R1)
- **WHEN** a `message.part.updated` SSE event fires for a live-streaming assistant message
- **THEN** the part is applied in-place (append / rebuild per existing event-reducer rules)
- **AND** the message is added to the "live-streaming" set for LRU protection (R4)

#### Scenario: SSE reconnects after transient drop

- **GIVEN** the SSE connection drops and reconnects
- **WHEN** the reconnect completes
- **THEN** the client does NOT request replay, does NOT send `Last-Event-ID`, does NOT force-refetch
- **AND** whatever events occurred during the drop are lost from the live stream (recoverable only via user-triggered load-more)

#### Scenario: Tab backgrounded and foregrounded

- **GIVEN** the user backgrounds the tab
- **WHEN** the tab returns to foreground
- **THEN** no force-refetch, no re-hydrate, no delta fill — the existing store is kept as-is and SSE continues from here

---

### Requirement: R3 — Explicit load-more on scroll-up

Older messages load only when the user actively scrolls toward the top.

#### Scenario: User scrolls near the top edge

- **GIVEN** the session has more messages than the tail window
- **WHEN** the scroll-spy sentinel enters the viewport by user gesture
- **THEN** the app calls `GET /session/:id/message?limit=N&before=<oldestStoredID>`
- **AND** the returned older messages are prepended to the store
- **AND** if the total now exceeds the store cap (R4), the newest-non-streaming messages are NOT evicted (only older-than-cap messages are)

#### Scenario: Programmatic trigger is forbidden

- **GIVEN** any non-user-gesture code path (visibility change, online, SSE reconnect, timer)
- **WHEN** that path considers triggering load-more
- **THEN** it MUST NOT fire — load-more is gated on real scroll-spy intersection only

---

### Requirement: R4 — Store hard cap with LRU eviction

The client store never exceeds the configured cap.

#### Scenario: Insert exceeds cap

- **GIVEN** the store holds `cap` messages (mobile=200, desktop=500)
- **WHEN** a new SSE event or load-more batch would push beyond cap
- **THEN** oldest non-streaming messages are evicted until size ≤ cap
- **AND** live-streaming messages (tracked in the live-set) are NEVER evicted

#### Scenario: Streaming message completes

- **GIVEN** a message was in the live-streaming set
- **WHEN** the final `message.updated` event marks it complete
- **THEN** it is removed from the live-set and becomes LRU-eligible

---

### Requirement: R5 — Single-part size cap

Each part is capped at 500 KB; overflow is truncated with `truncatedPrefix` marker.

#### Scenario: Part exceeds 500 KB during streaming

- **GIVEN** a streaming text/reasoning part receives chunks
- **WHEN** total bytes > 500 KB
- **THEN** only the last 500 KB are kept; `truncatedPrefix` records dropped byte count
- **AND** existing `FoldableMarkdown` UI shows banner + tail view

#### Scenario: User expands a truncated part

- **GIVEN** a truncated completed part displays an "expand" affordance
- **WHEN** the user clicks expand
- **THEN** a part-scoped fetch retrieves only that part's full content (NOT a full `syncSession()`)
- **AND** the part is rebuilt in place without touching any other store state

---

### Requirement: R6 — Removal contract

The following code paths are fully deleted from the tree.

#### Scenario: Build contains forbidden symbols

- **GIVEN** the post-implementation bundle
- **WHEN** grep for `Last-Event-ID`, `beforeMessageID`, `forceRefetch`, `force:true`, SSE replay buffer on server
- **THEN** zero hits outside of removed-file archive / this spec / event log

Removed paths (non-exhaustive, captured in design.md DD-8):
- Server: SSE event replay buffer + `Last-Event-ID` handler
- Server: `beforeMessageID` query param parsing
- Server: force-resync incremental tail branch
- Client `sync.tsx`: `force:true` code path entirely
- Client `use-session-resume-sync.ts`: `dispatch force:true` sites (all 4)
- Client `FoldableMarkdown.expand`: `syncSession()` call (replaced with part-scoped fetch)
- Client `global-sync/event-reducer.ts`: any branch keyed on replay / resume

---

## Acceptance Checks

- [ ] Mobile tab survives 1 hour on cisopro session without OOM
- [ ] Desktop session-open shows exactly 200 most recent messages; scroll-up loads older
- [ ] SSE drop+reconnect does NOT trigger HTTP fetch
- [ ] Tab background→foreground does NOT trigger HTTP fetch
- [ ] Store memory stays bounded (measurable via Chrome devtools Memory tab)
- [ ] Removed symbols show zero hits in final bundle grep
