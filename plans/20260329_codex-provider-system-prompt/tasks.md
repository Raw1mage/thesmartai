# Tasks

## 1. Markdown File Viewer MVP

- [x] 1.1 Read the approved implementation spec and companion artifacts.
- [x] 1.2 Add a markdown-aware render branch to `file-tabs.tsx` for `.md` content.
- [x] 1.3 Reuse or extract the existing markdown/rich-content provider stack for file-tab markdown rendering.
- [x] 1.4 Define SVG and Mermaid behavior for markdown file viewing with safe fallback.

## 2. Chat File-Reference Navigation MVP

- [x] 2.1 Locate the message markdown extension seam in `message-content.tsx` and `session-rich-content-provider.tsx`.
- [x] 2.2 Implement conservative file-reference parsing for absolute paths, repo-relative paths, and optional `:line` suffixes.
- [x] 2.3 Wire chat file-reference clicks into the existing file context/tab flow and selected-line state.

## 3. Shared Rich Markdown Extension Surface

- [x] 3.1 Refactor the rich markdown path so file tabs and chat can share controlled component hooks without regressing current output.
- [x] 3.2 Preserve existing code, diff, and markdown presentation while adding component hooks for file references and diagram blocks.

## 4. Diagram Rendering Expansion

- [x] 4.1 Add Mermaid fenced-block rendering through a controlled renderer component with safe fallback.
- [x] 4.2 Define and implement chat-safe SVG behavior by routing users toward the existing SVG file-tab viewer rather than raw inline injection.

## 5. Validation And Regression Guardrails

- [x] 5.1 Add parser tests for valid and invalid file-reference patterns.
- [ ] 5.2 Add UI tests for markdown file rendering and chat click-to-open-file / jump-to-line behavior.
- [ ] 5.3 Validate Mermaid fallback behavior and markdown regression coverage.

## 6. Documentation Sync

- [x] 6.1 Record implementation evidence and decisions in `docs/events/event_20260329_chat-rich-render-plan.md`.
- [x] 6.2 Update `specs/architecture.md` only if implementation changes renderer/file-navigation module boundaries.
