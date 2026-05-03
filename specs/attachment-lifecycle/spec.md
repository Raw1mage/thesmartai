# Spec: attachment-lifecycle

## Purpose

Image attachments uploaded by the user collapse into a small text annotation after the assistant turn that processed them finishes; the original binary is staged in a per-session XDG path so the model can re-read on demand. Cuts recurring per-turn input token cost dramatically without sacrificing recall.

## Glossary

| 詞 | 意義 |
|---|---|
| **Hydrated attachment** | The full `attachment_ref` part with binary still in conversation history (the only state pre-dehydration) |
| **Dehydrated attachment** | The same `attachment_ref` part rewritten to carry only `{filename, sha256, annotation, incoming_path}`; binary moved to filesystem |
| ~~**Incoming staging**~~ → see **Repo incoming** | (v1, SUPERSEDED 2026-05-04) — staging path no longer at `~/.local/state/opencode/incoming/`; see Repo incoming below |
| **Repo incoming** (v2) | Filesystem location `<session.project.worktree>/incoming/<filename>` owned by `repo-incoming-attachments` spec. attachment-lifecycle reuses without writing — `attachment_ref.repo_path` already records this path. |
| **`reread_attachment` tool** | Tool the model calls to fetch the binary back from incoming and inject as a fresh `attachment_ref` in the next turn |
| **Annotation** | Plain text replacing the binary; in v1 this is a verbatim slice of the assistant turn's response text (no extra LLM call) |
| **GC sweep** | Background pass that deletes incoming/`<sid>`/ folders for sessions deleted > 7 days ago |

## Requirements

> **v4 (2026-05-04 — current)** Requirements R6′–R10 below describe the active design. Earlier R1–R5 (dehydrate-by-mutation) are kept for traceability but marked SUPERSEDED. v4 reframes: image binary lives in **preface trailing** per turn, never in conversation history.

### Requirement R6′: Image binary inlines via preface trailing (NEW v4)

#### Scenario: turn with active image refs renders inline image in preface trailing
- **GIVEN** session has `session.execution.activeImageRefs = ["image.png"]`
- **AND** the user message at conversation tail contains `attachment_ref` part with `repo_path = "incoming/image.png"`, `mime = "image/png"`
- **WHEN** llm.ts assembles the LLM request via `buildPreface(...)` with `trailingExtras` populated by an "active image inliner" helper
- **THEN** the preface message's content array includes a `{type: "file", url: "data:image/png;base64,...", mediaType: "image/png", filename: "image.png"}` content block in the trailing tier
- **AND** the conversation history's `attachment_ref` part remains as the existing routing-hint text (no inlining there)
- **AND** the assembled wire payload's preface trailing contains the image binary (~20K tokens for a typical PNG); conversation history bytes are unchanged

#### Scenario: turn with no active image refs has no inline image
- **GIVEN** `session.execution.activeImageRefs` is empty or undefined
- **WHEN** llm.ts assembles the LLM request
- **THEN** preface trailing contains no image content blocks (only the existing trailing extras like lazy catalog hints)
- **AND** conversation history is unchanged

### Requirement R7′: Active image set lifecycle (NEW v4)

#### Scenario: user upload adds to active set
- **GIVEN** a new user message with image `attachment_ref` parts containing `repo_path`
- **WHEN** the user message is committed to session storage
- **THEN** each new image's identifier is appended to `session.execution.activeImageRefs`
- **AND** subsequent assembled requests inline that image via preface trailing

#### Scenario: assistant turn completion drains active set
- **GIVEN** `session.execution.activeImageRefs` is non-empty
- **AND** an assistant turn completes (any finish reason)
- **WHEN** the post-completion hook fires
- **THEN** `session.execution.activeImageRefs` is cleared
- **AND** the next assembled request has no inline images (unless reread or new upload added refs)

#### Scenario: multiple turns same image
- **GIVEN** image was inlined turn N, drained after assistant N
- **WHEN** turn N+1 starts (user typed text only, no new upload, no reread)
- **THEN** preface trailing has no image
- **AND** conversation history's `attachment_ref` text reference is unchanged
- **AND** AI's prior response text (in assistant message N) carries forward as the durable understanding

### Requirement R8′: Reread tool returns voucher (NEW v4)

#### Scenario: AI calls reread, image inlines on next turn
- **GIVEN** session has a dehydrated/past attachment_ref with filename `image.png` and valid `repo_path`
- **WHEN** AI invokes `reread_attachment({filename: "image.png"})` during turn N
- **THEN** the tool returns `{type: "text", text: "Image 'image.png' queued for vision in your next turn."}`
- **AND** `session.execution.activeImageRefs` gains the entry
- **AND** turn N+1's preface trailing inlines the image via R6′
- **AND** AI sees image content on turn N+1, can analyze it freshly

#### Scenario: reread for missing/non-existent attachment
- **GIVEN** filename does not match any attachment_ref in this session, OR the file at `<worktree>/<repo_path>` is gone (user deleted)
- **WHEN** AI invokes `reread_attachment`
- **THEN** the tool returns `{type: "text", text: "<error message>"}` with the appropriate reason
- **AND** activeImageRefs is NOT updated

### Requirement R9′: Cache locality preserved (NEW v4)

#### Scenario: conversation history bytes byte-stable across turns
- **GIVEN** any session that has dehydrated images (text refs in history) and active images (binary in trailing)
- **WHEN** sequential LLM requests are assembled across N turns
- **THEN** for any historical user message M (where M < N), its serialized bytes (the routing-hint text) are identical across all subsequent turn requests
- **AND** Phase B BP1/BP2/BP3 cache savepoints continue to hit on the system + preface T1 + preface T2 portions
- **AND** BP4 cache invalidation per turn is the only expected churn (matches Phase B's discipline)

### Requirement R10: Upload announces, AI opts in (NEW v5 2026-05-04)

> **Architectural pivot**: replaces v4's "auto-queue every uploaded image into next turn's preface trailing" with a pure opt-in model. Upload now ONLY stages binary + announces inventory; AI explicitly calls `reread_attachment` (renamed `view_attachment` per DD-22.5 if adopted) to bring specific images into the next turn's preface. Eliminates force-feed risk regardless of upload count.

#### Scenario: user uploads N images, none auto-inline
- **GIVEN** a user message with N image `attachment_ref` parts (any N including N>10)
- **AND** `attachment_inline_enabled=true`
- **WHEN** the upload-commit hook runs
- **THEN** `session.execution.activeImageRefs` is NOT modified (stays empty / unchanged)
- **AND** the binary lands in `${Global.Path.data}/sessions/<sessionID>/attachments/<filename>` per the v4 hotfix routing
- **AND** the next turn's preface trailing tier emits NO image content blocks (because activeImageRefs is empty)
- **AND** the next turn's preface trailing tier emits an `<attached_images>` text inventory listing all session image attachments with metadata

#### Scenario: AI reads inventory, calls voucher, image inlines next turn
- **GIVEN** the inventory advertises `screenshot.png`, `error.png`, `debug.png` (3 uploaded images, 0 active)
- **WHEN** AI calls `reread_attachment({filename: "screenshot.png"})` during turn N
- **THEN** activeImageRefs gains `screenshot.png`
- **AND** turn N+1 preface trailing inlines screenshot.png ONLY (the other two stay in inventory only)
- **AND** AI sees pixel content for screenshot.png on turn N+1
- **AND** drainAfterAssistant clears activeImageRefs at the end of turn N+1; turn N+2 inlines no image unless AI requests again

#### Scenario: 50 uploaded images do not inflate context
- **GIVEN** a session with 50 uploaded image `attachment_ref` parts (e.g. user dropped a debug folder)
- **AND** activeImageRefs is empty
- **WHEN** the next turn assembles
- **THEN** the preface trailing tier carries the inventory (~50 lines of text, ~3-5KB) but ZERO image binary
- **AND** total preface trailing token cost stays bounded by inventory text size, not by image count
- **AND** AI can call `reread_attachment` for the 1-2 images it needs

### ~~Requirement: Dehydrate every image attachment after its first read~~ (v1, SUPERSEDED 2026-05-04 by R6′)

#### Scenario: assistant turn with `finish="stop"` triggers dehydration
- **GIVEN** a user message with one or more `attachment_ref` parts of mime type `image/*`
- **AND** the assistant message replying to that user message reaches `finish="stop"`
- **WHEN** the post-completion hook fires
- **THEN** for each image `attachment_ref` part on that user message:
  - The binary is moved from session sqlite `attachments` table to `~/.local/state/opencode/incoming/<sessionID>/<filename>`
  - The `attachment_ref` part is rewritten in place: original payload fields preserved, plus `dehydrated: true`, `annotation: <verbatim assistant response text>`, `sha256: <hex>`, `incoming_path: <abs path>`
  - The on-disk binary file's permissions are 0644 (readable by the same user)

#### Scenario: non-image attachments are not dehydrated in v1
- **GIVEN** a user message with an attachment_ref of mime type `application/pdf`
- **WHEN** the assistant turn completes
- **THEN** the attachment_ref is left untouched (still hydrated)
- **AND** a telemetry event `attachment.dehydrate.skipped { reason: "non-image-mime" }` is emitted

#### Scenario: failed turns do not dehydrate
- **GIVEN** an assistant message with `finish="error"` or `finish="abort"`
- **WHEN** the post-completion hook evaluates
- **THEN** dehydration does NOT run for that turn's attachments

### Requirement: Main multimodal agent reads images inline (NEW v3)

#### Scenario: hydrated image attachment serializes as inline image content block
- **GIVEN** a session message with an `attachment_ref` part where mime is `image/png`, `repo_path` is `incoming/x.png`, and `dehydrated !== true`
- **AND** the main agent's model supports image input (multimodal capability)
- **WHEN** `MessageV2.toModelMessages` runs to prepare the LLM payload
- **THEN** the part serializes to an AI SDK `{type: "file", url: "data:image/png;base64,...", mediaType: "image/png", filename: ...}` content block
- **AND** the main agent receives the actual image binary, NOT a `<attachment_ref>` text routing hint

#### Scenario: non-multimodal model still routes via vision subagent
- **GIVEN** the model's capabilities don't include image input (e.g. lite providers per Phase B DD-14)
- **WHEN** `MessageV2.toModelMessages` runs
- **THEN** the legacy text routing hint is emitted instead, telling the model to call `attachment` tool with `agent=vision`

### Requirement: Vision subagent remains opt-in (NEW v3)

#### Scenario: model can still explicitly call vision subagent
- **GIVEN** any session
- **WHEN** the main agent invokes the `attachment` tool with `mode=read agent=vision`
- **THEN** the existing dispatch path runs (templates/prompts/agents/vision.txt prompt, ≤1500 token text response)
- **AND** the response returns to main agent as today

#### Scenario: routing hint language softened
- **GIVEN** the legacy fallback path fires (no `repo_path` OR non-multimodal model)
- **WHEN** the routing hint is emitted
- **THEN** the language frames vision-subagent as one option among several, not the only path: e.g. "If you want a focused vision-subagent analysis instead of inline reading, call attachment(mode=read, agent=vision)"

### Requirement: Subsequent LLM calls send dehydrated stub instead of binary

#### Scenario: model wire payload contains text annotation only
- **GIVEN** a session where image `attachment_ref` parts have been dehydrated
- **WHEN** the next LLM call assembles `messages[]`
- **THEN** the dehydrated `attachment_ref` parts serialize to a small text content block with shape `<dehydrated_attachment filename="..." sha256="...">${annotation}</dehydrated_attachment>` — NOT the original image binary
- **AND** the `est_tokens` of the new payload reflects annotation length (≤ 1K typical), not original image tokens (typically 7K-167K)

### Requirement: Model can re-read a staged attachment via tool

#### Scenario: `reread_attachment(filename)` returns fresh binary
- **GIVEN** a dehydrated `attachment_ref` with `filename="image (3).png"` and binary at `~/.local/state/opencode/incoming/<sid>/image (3).png`
- **WHEN** the model calls `reread_attachment({filename: "image (3).png"})`
- **THEN** the tool reads the file, returns `{type: "image", url: "data:image/png;base64,...", est_tokens, byte_size}`
- **AND** the next turn's user message inherits this fresh image (via tool result handling)

#### Scenario: file missing returns error
- **GIVEN** the binary at `<worktree>/<repo_path>` has been removed by the user (e.g. `git clean`, manual delete, never landed for legacy session)
- **WHEN** the model calls `reread_attachment({filename: "image (3).png"})`
- **THEN** the tool returns an error: `{error: "attachment_not_found", message: "Image '<file>' is no longer at <worktree>/<repo_path>. Please ask the user to re-upload if you need to look at it."}`

### Requirement: Staging is per-session and isolated

#### Scenario: each session has its own incoming directory
- **GIVEN** sessions A and B both upload an image named `image.png`
- **WHEN** both turns dehydrate
- **THEN** they live at separate paths: `~/.local/state/opencode/incoming/sesA/image.png` and `~/.local/state/opencode/incoming/sesB/image.png`
- **AND** subagent dispatched from session A does NOT inherit session A's incoming

~~### Requirement: Garbage collection sweep~~

**(v1, SUPERSEDED 2026-05-04)** Removed under design.md DD-4'. Binary lifecycle is owned by `repo-incoming-attachments` (per-project, user-managed via `git clean` / `.gitignore` / manual `rm`). attachment-lifecycle has no GC sweep, no TTL, no daemon-startup hook, no cron timer. Reread errors with `attachment_not_found` if user has removed the file from `<worktree>/incoming/`.

### Requirement: Dehydration is one-way unless reread

#### Scenario: previously-dehydrated attachment cannot be silently re-hydrated
- **GIVEN** an `attachment_ref` part already has `dehydrated: true`
- **WHEN** the post-completion hook runs again on a later turn
- **THEN** the part is skipped (idempotent — no double dehydration, no annotation overwrite)

## Acceptance Checks

| Check | How verified |
|---|---|
| 10-image session sees ≥ 90% reduction in image tokens between first turn and second turn after dehydration | Manual smoke + telemetry comparison |
| `attachment.dehydrated` event fires once per image post-turn | Unit test on processor.ts hook |
| Wire payload for next LLM call contains `<dehydrated_attachment>` not raw image | Integration test with mock provider |
| `reread_attachment` tool returns valid image content | Unit test |
| ~~GC sweep deletes `<sid>` dirs after 7-day TTL~~ | (v1, SUPERSEDED 2026-05-04 — no GC; user-managed) |
| Subagent does not inherit parent's incoming | Integration test |
| Non-image mimes (PDF) NOT dehydrated in v1 | Unit test |

## Out-of-scope (explicit)

- PDF / text / code attachment dehydration (separate spec, deferred)
- Audio / video attachments (deferred)
- Pre-emptive image compression (separate concern)
- Cross-session attachment sharing
- UI changes beyond an optional "compressed" badge
- Annotation quality enhancement (e.g. dedicated LLM call for richer annotations) — v2 candidate

## Dependencies

- [prompt-cache-and-compaction-hardening](../prompt-cache-and-compaction-hardening/) (Phase B landed) — provides the static-system + preface architecture this slots into; conversation history dehydration is independent
- `MessageV2.AttachmentRefPart` — extended with optional dehydration metadata fields
