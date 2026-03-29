# Event Log

## Requirement

- Plan and implement a `/plans` package for improving chat output rendering and file display in the webapp.
- Reuse the existing file view/file tab surface so assistant file references can open files directly from chat.
- Upgrade markdown file viewing inside file tabs, with safe SVG and Mermaid handling.

## Requirement Update

- The user clarified that markdown file viewing inside file tabs is a current top priority, especially for `.md` documents with SVG and Mermaid-oriented content.
- The user selected a dual-track plan: markdown file viewing and chat file-link navigation should both be planned rather than forcing a single-track MVP ordering.
- The user further selected these concrete decisions for the first delivery:
  - `.md` file tabs use `Preview / Source`
  - SVG support is limited to `.svg` references, not inline raw SVG
  - chat file-link support is limited to `absolute path`, `repo-relative path`, and optional `:line`
  - Mermaid scope should aim broader than fenced-block-only, but safety and current renderer seams remain the hard limit

## Scope

### IN

- Markdown file-tab rendering and `Preview / Source`
- Chat file-reference parsing and navigation into existing file tabs
- Shared rich markdown surface for chat and file-tab preview
- Safe SVG and Mermaid handling within existing UI boundaries
- Planner artifacts, implementation evidence, and verification records

### OUT

- Repo-wide renderer rewrite
- Arbitrary raw HTML embedding
- Inline raw SVG execution
- Non-web surfaces unless required by shared renderer constraints

## Task List

- Read planner artifacts and architecture evidence
- Implement Markdown File Viewer MVP in beta worktree
- Implement Chat File-Reference Navigation MVP in beta worktree
- Unify chat/file-tab rich markdown surface in beta worktree
- Record verification blockers and sync docs in the main repo

## Conversation Summary

- The user clarified that markdown hyperlinks are desirable, but the real product goal is to make them actually render and interact correctly in the webapp.
- The user pointed out that the product already has a file view tab and suggested connecting assistant output to that surface before adding broader rendering support.
- Further inspection showed that chat messages already use `Markdown`, while file tabs still render markdown files through generic code output.
- Planning was therefore revised into a dual-track model: markdown file viewing and chat file-link navigation are parallel tracks, with shared renderer work and Mermaid/SVG following as controlled expansions.
- The user then approved moving into beta build workflow implementation.

## Debug Checkpoints

### Baseline

- Assistant replies already contain markdown-like structure and file references.
- Current user experience did not let those file references act as navigable UI elements.
- Existing webapp already provided file tabs and an SVG-aware file viewer.
- Markdown files in file tabs did not yet receive markdown-aware rendering.

### Instrumentation Plan

- Read session message renderer files to identify the current assistant text rendering seam.
- Read file context and file tab files to confirm file-open and selected-line authority surfaces.
- Read the rich-content provider to determine whether markdown extension should happen inside existing provider boundaries.
- Implement in beta worktree only, then validate with the smallest feasible package-level tests.

### Execution

- Confirmed `packages/app/src/pages/session/components/message-content.tsx` renders assistant text via `Markdown`.
- Confirmed `packages/app/src/pages/session/session-rich-content-provider.tsx` already wraps session UI with `MarkedProvider`, `DiffComponentProvider`, and `CodeComponentProvider`.
- Confirmed `packages/app/src/context/file.tsx` owns path normalization, loading, and selected-line state.
- Confirmed `packages/app/src/pages/session/file-tabs.tsx` already consumes selected lines and includes dedicated SVG preview behavior.
- Confirmed `packages/app/src/pages/session/file-tabs.tsx` previously routed generic loaded text, including markdown files, through `renderCode(...)` rather than a markdown-aware viewer branch.
- Implemented Markdown File Viewer MVP in beta worktree:
  - `.md`-specific viewer branch
  - `Preview / Source` toggle
  - markdown helper extraction
  - `.svg` reference rewriting/preload path
  - Mermaid detection with explicit visible fallback
- Implemented Chat File-Reference Navigation MVP in beta worktree:
  - conservative file-reference detection
  - `absolute path`, `repo-relative path`, optional `:line`
  - custom `opencode-file://` href encoding/decoding
  - click opens existing file tab and sets selected line
  - external URLs remain browser links
- Implemented shared rich markdown surface in beta worktree:
  - new `rich-markdown-surface.tsx`
  - chat and markdown file preview both route through the shared surface
  - Mermaid fallback notice centralized instead of duplicated

### Root Cause

- The missing capability was not the absence of a file viewer; it was the lack of binding between assistant message rendering and the existing file-navigation authority.
- Rich markdown support was asymmetrical: chat already had a markdown renderer, while markdown files in file tabs did not.
- The system also lacked a shared rich markdown surface, so chat and file-tab preview had duplicated and inconsistent behavior.

### Validation

- Beta branch used: `feature/chat-rich-file-rendering`
- Beta worktree used: `/home/pkcs12/projects/.beta-worktrees/opencode/feature/chat-rich-file-rendering`
- Minimal validation attempted:
  - `bun test packages/app/src/pages/session/message-file-links.test.ts`
  - `bun test packages/app/src/pages/session/markdown-file-viewer.test.ts`
- Validation is currently blocked by beta dependency-resolution/environment issues, not by the changed feature logic alone:
  - earlier blocker: missing `@happy-dom/global-registrator`
  - earlier blocker: missing `tsgo`
  - current repeated blocker: `Cannot find package 'zod' from packages/opencode/src/util/log.ts`
- As a result, no reliable passing test/typecheck result has been obtained yet.

## Decisions

- Treat markdown file viewing and chat file-link navigation as dual-track top-level workstreams.
- Preserve the current markdown path and extend it rather than replacing it.
- Add a markdown-aware branch to file tabs instead of leaving `.md` files on the generic code path.
- Use `Preview / Source` for markdown file tabs.
- Keep SVG rich behavior authoritative in the existing file viewer; support `.svg` references but not inline raw SVG.
- Keep chat file-link parsing conservative.
- Keep external URLs as normal browser links.
- Keep Mermaid in a safe explicit fallback state until a safe true-render path is verified.

## Verification

- Read `/home/pkcs12/projects/opencode/packages/app/src/pages/session/components/message-content.tsx`
- Read `/home/pkcs12/projects/opencode/packages/app/src/pages/session/session-rich-content-provider.tsx`
- Read `/home/pkcs12/projects/opencode/packages/app/src/context/file.tsx`
- Read `/home/pkcs12/projects/opencode/packages/app/src/pages/session/file-tabs.tsx`
- Read `/home/pkcs12/projects/opencode/specs/architecture.md`
- Checked beta worktree status to confirm modified/new files are within the expected session UI surface

## Architecture Sync

- Architecture documentation now needs to acknowledge that session rich markdown rendering is shared across chat message content and markdown file preview, and that markdown file tabs now diverge from the generic `renderCode(...)` path.
