# Tasks

## 1. Focus / scroll guard implementation

- [x] 1.1 Add a free-reading-aware guard to session hash initial bottom scroll.
- [x] 1.2 Prevent page-level printable-key autofocus from stealing focus while browsing history.
- [x] 1.3 Add targeted tests for free-reading hash/autofocus behavior where feasible.
- [x] 1.4 Run focused frontend tests / type checks for touched modules.
- [x] 1.5 Exclude tool call wrappers from browser scroll anchoring.
- [x] 1.6 Disable session scroll-snap while runloop/toolcall updates are active.
- [x] 1.7 Stop reactive hash replay from repositioning free-reading viewports.
- [x] 1.8 Remove session proximity scroll-snap entirely after short-toolcall reproduction.
- [x] 1.9 Treat user scroll events as free-reading during active tool updates instead of correcting back to bottom.
- [x] 1.10 Exclude outer message turn wrappers from browser scroll anchoring.
- [x] 1.11 Route all root scroll events through auto-scroll state handling while keeping scrollSpy gesture-gated.
- [x] 1.12 Prevent toolcall working-start from forcing bottom when already away from bottom.
- [x] 1.13 Make explicit pause remember reading intent even before overflow grows.
- [x] 1.14 Clear pending programmatic-scroll markers on explicit wheel/touch reading intent.
- [x] 1.15 Scope auto-scroll active state to real session busy and treat any root wheel/touch as reading intent.
- [x] 1.16 Block resize-follow when tool-card height changes while already away from bottom.
- [x] 1.17 Disable nested turn scroll anchoring and remove resize snap-back when tool updates move away from bottom.
- [x] 1.18 Apply spec-aligned scoped `overflow-anchor: none` to all session scroller descendants.
- [x] 1.19 Make session timeline turns content-height instead of viewport-height.

## 2. Evidence and docs

- [x] 2.1 Update event log with checkpoints and validation.
- [x] 2.2 Check architecture sync and document no-change or update as needed.
