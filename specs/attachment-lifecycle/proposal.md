# Proposal: attachment-lifecycle

## Why

User-uploaded attachments (images, PDFs, files) currently stay in conversation history forever. Every subsequent LLM call re-sends the full binary, even after the model has already processed and responded to the content. Real-world impact in production session `ses_211c853fcfferC149YUFem6mN4` (codex GPT-5.5, 2026-05-04):

- 10 PNG screenshots uploaded across 9 user turns
- ~188K estimated image tokens accumulated
- Every turn after upload sends ALL prior images again
- 99% Anthropic-style prompt cache hit only saves time + cost-per-byte; the **input token quota is still consumed** on every re-send (image tokens count against weekly `usage_limit_reached` even when cached)

The model rarely needs to re-look at an image once it has responded to it. A "post-read dehydration with retrieval fallback" pattern would dramatically cut token cost without sacrificing recall.

## Original Requirement Wording (Baseline)

- "問題是每張貼圖之後 AI 讀過圖了之後就不需要留在 context 了吧？" (2026-05-04)
- "我覺得是一個很小的 hotfix，每張圖上傳後 AI 讀了給它留一個解讀後的註解，圖就不用留了。但圖的原檔可以在 /incoming 中暫留一陣子，萬一同一 session 對話稍後 AI 覺得剛剛讀過的什麼圖還需要再看一眼，還能再叫回來讀一下。" (2026-05-04)

## Requirement Revision History

- 2026-05-04: initial draft (proposal-only at this stage)
- 2026-05-04 v2: 6 OQs resolved (annotation = response text, storage = XDG, trigger = always, v1 = images, TTL = 7d, subagent = per-session)
- 2026-05-04 v2-amend: discovered `repo-incoming-attachments` already owns binary lifecycle (per-project `<worktree>/incoming/`). Scope reduced from 5 to 3 implementation phases. DD-2/DD-4/DD-11 superseded.
- 2026-05-04 v3: architectural pivot 1 — discovered opencode never inlines image binary; currently routes through vision subagent for ≤1500 token text summary. v3 proposed inlining image into user message + dehydrate-by-mutation after first read.
- 2026-05-04 v4 (current): **architectural pivot 2** — v3's dehydrate-by-mutation **violates Phase B's "static-front, dynamic-back" cache locality principle**. Mutating historical user message bytes (deep in conversation history) invalidates cache prefix from that point. Phase B's discipline says: big-delta content belongs at the END of context (preface trailing zone, BP4 zone), where invalidation is cheap. v4 redesigns: **image binary inlines into preface trailing per-turn (NOT into conversation history); conversation history's `attachment_ref` parts STAY as small text routing-refs, byte-stable forever**. No mutation. No dehydration flag. The "annotation" is just the assistant's natural response text (lives in assistant message text, byte-stable forever). Reread tool returns a "voucher" that signals "include image X in next turn's preface trailing" instead of returning binary inline. v4 reverts the 4 v3 implementation commits (`f39d70e71`..`8039fcf65`); they're wrong-direction.

## Effective Requirement Description (v4 2026-05-04 — current)

**Core principle**: Image binaries belong in the **preface trailing tier** (per-turn dynamic, BP4 zone, expected to invalidate every turn). They MUST NOT enter conversation history. Conversation history stays byte-stable forever; cache locality preserved.

1. **Image binary inlines via preface trailing** (NOT user message): When the LLM request is assembled, the system computes "active image refs" — images that should be visible to the main agent THIS turn. Each active image is rendered as `{type: "file", url: "data:<mime>;base64,...", mediaType: ..., filename: ...}` content block appended to the preface message's trailing tier. Conversation history's `attachment_ref` parts stay as compact text routing-refs forever (~470 bytes each, byte-stable).

2. **Active image set per session** (`session.execution.activeImageRefs[]`):
   - **Add**: when user uploads (next user turn marks the new attachment_ref as active); when AI calls `reread_attachment(filename)` (queues for next turn)
   - **Remove**: after the next assistant turn completes — image was already shown, AI's response captured the analysis, no need to keep it active
   - Rule: at most 1 turn of "active" lifespan unless explicitly extended via reread

3. **Re-read tool** (`reread_attachment(filename)`):
   - Returns small text "voucher": `{type:"text", text:"Image '<file>' queued for vision in your next turn."}`
   - Side effect: pushes filename onto `session.execution.activeImageRefs[]`
   - Next turn: preface trailing inlines that image
   - AI sees the image on the turn AFTER calling reread (acceptable latency)

4. **Annotation = assistant's natural response text** (no extra mechanism): When AI sees image and responds, its response text IS the annotation. Lives in assistant message → conversation history → byte-stable forever. Future turns reference the analysis through normal conversation context. No `dehydrated` flag, no `annotation` field, no extraction step.

5. **Vision subagent → opt-in fallback** (per v3 DD-18, retained): The `attachment(mode=read, agent=vision)` tool dispatch path stays for cases where the model wants a focused vision-subagent analysis (deep analysis, non-multimodal main). Default route flips to inline (via preface trailing).

6. **Cache profile** (the crucial property):
   - Conversation history NEVER mutates → BP1/BP2/BP3 cached, conversation tail bytes byte-stable
   - Image inline ONLY in preface trailing → invalidation rides BP4 (per-turn anyway)
   - Turn N (image active): trailing has image, BP4 fresh (expected). Image cached at BP4 savepoint.
   - Turn N+1 (no reread): trailing doesn't have image. BP4 fresh. **Conversation history byte-stable, BP4 prior savepoint partially reused for the conversation portion**. Only preface trailing + new user msg are fresh.
   - **No mid-history mutation. No surprise cache invalidation. Phase B discipline preserved.**

## Effective Requirement Description (v3 2026-05-04 — SUPERSEDED by v4)

0. **Inline read by main agent (NEW v3)**: When `attachment_ref` is image mime AND `repo_path` is populated AND `dehydrated !== true`, `MessageV2.toModelMessages` emits a real **inline image content block** (data URI from the on-disk binary) so the main multimodal agent can use its native vision capability. The legacy "use the attachment tool, agent=vision" routing hint is replaced by direct inline. The vision subagent path remains available as **opt-in** when the main agent explicitly chooses (e.g. for deep analysis, or when the main is a non-multimodal model). **(SUPERSEDED — inlining into user message put a big delta in conversation tail, violating Phase B's cache locality discipline. v4 moves inline to preface trailing.)**

1. **Post-read dehydration**: After the assistant turn that consumed an attachment finishes (`finish="stop"`), replace the `attachment_ref` part in conversation history with a **dehydrated stub** containing:
   - Original filename
   - sha256 of the binary
   - A short annotation derived from the assistant's response (or a small dedicated annotation pass)
   - A pointer to the staged binary (e.g. `/incoming/<sessionID>/<filename>`)
   - Instruction that the model can re-read via a tool if needed

2. **`/incoming` staging**: The original binary is moved from the session's attachment storage to a staging area (`~/.local/state/opencode/incoming/<sessionID>/<filename>` or similar). Retained for the session lifetime + a TTL (default 24h after `session.deleted`, then GC'd).

3. **Re-read tool**: A new tool (working name `reread_attachment`) lets the model pull a staged binary back as a fresh attachment in the next turn:
   ```
   reread_attachment(filename: string) → { type: "image", url: ..., est_tokens: ... }
   ```
   Tool description tells the model when to use it.

4. **Cache-friendliness preserved**: The dehydrated stub is byte-stable. Replacing the binary is a one-time conversation history rewrite that invalidates BP4 once for that turn but yields massive savings on subsequent turns.

5. **Compatibility with Phase A/B compaction**: This sits orthogonal to compaction. Compaction still operates on the full conversation history; dehydrated stubs are smaller so compaction has less work. Phase A's skill auto-pin / sanitizer logic is unaffected.

## Scope

### IN

- Extend `attachment_ref` part schema (or new `attachment_dehydrated` type) with optional dehydration metadata
- Storage migration: move binary from per-session sqlite `attachments` table → filesystem `/incoming/<sessionID>/<filename>` on dehydration
- New `reread_attachment` tool registered in tool registry
- Dehydration trigger: post-assistant-completion hook in `processor.ts` or a dedicated background task
- Annotation generation strategy
- `/incoming` GC policy + cleanup hook on `session.deleted`
- Telemetry: `attachment.dehydrated`, `attachment.rereaded`, `attachment.gc'd`

### OUT

- Pre-emptive image compression (separate concern)
- Audio / video attachment handling (out of scope; image + PDF only for v1)
- Cross-session attachment sharing (no shared `/incoming`)
- UI changes beyond optional "compressed" badge

## Non-Goals

- Replacing prompt cache (Phase B handled cache-prefix architecture)
- Building a general-purpose file content-addressable store
- Forcing the model to call `reread_attachment` — opt-in based on model's judgment

## Constraints

- The session sqlite `attachments` table currently holds the binary; moving to filesystem must preserve referential integrity via `attachment_ref.payload_json.ref_id`
- Re-read tool result must produce a valid `MessageV2` part schema (likely tool-result with embedded image)
- Dehydration must be reversible during the staging window; after GC it's gone
- Cannot dehydrate attachments mid-turn (must wait for `finish="stop"`)
- Subagent path must work too (delegate may share parent attachments via prefix)

## What Changes

- `packages/opencode/src/session/message-v2.ts`: extend `attachment_ref` part with optional dehydration metadata
- `packages/opencode/src/session/storage/incoming-store.ts` (NEW): wraps `/incoming/<sessionID>/` filesystem operations
- `packages/opencode/src/session/processor.ts`: post-completion hook scans parent user message for `attachment_ref` parts → triggers dehydration
- `packages/opencode/src/tool/reread-attachment.ts` (NEW): the re-read tool implementation
- `packages/opencode/src/session/index.ts session.deleted Bus subscription`: add cleanup of `/incoming/<sessionID>/`
- `packages/opencode/src/session/attachment-annotator.ts` (NEW, maybe): generate annotation from response text or via small LLM call
- New tweaks.cfg entries: `attachment_dehydrate_enabled`, `attachment_incoming_ttl_seconds`, `attachment_annotation_strategy`

## Capabilities

### New Capabilities

- **Post-read dehydration**: attachments collapse to small text annotations after first use
- **`/incoming` staging**: binaries kept in filesystem retrieval store for in-session re-fetch
- **`reread_attachment` tool**: model self-service for re-reading

### Modified Capabilities

- **`attachment_ref` part**: optional dehydration fields; serialization roundtrip preserves them
- **`Session.messages`**: returns dehydrated form by default; reread injects fresh form
- **`session.deleted` Bus subscriber**: also cleans `/incoming/<sessionID>/`

## Impact

- **Token savings**: For sessions like `ses_211c853fcffer...` (10 images, 188K tokens), dehydration cuts ~150K+ recurring tokens per turn after the first. Weekly `usage_limit_reached` budget recovers proportionally.
- **Cache invalidation**: One-time BP4 invalidation per dehydrated turn; subsequent turns benefit from smaller, more cacheable conversation tail.
- **Disk usage**: `/incoming/<sessionID>/` accumulates binaries until GC. Typical sessions (10-20 images × 50KB avg = 500KB–1MB per session). 24h post-`session.deleted` TTL keeps disk pressure modest.
- **Model behavior**: needs prompt update telling model that dehydrated attachments can be re-read via tool. Could live in Phase B preface T1 (or static system block, depending on universality).
- **Compaction interaction**: smaller conversation history → compaction triggers later → fewer compaction events.
- **Plugin contract**: new optional Bus event `attachment.dehydrated` for plugins to observe.
- **Backward compat**: Old sessions with non-dehydrated attachments continue to work; dehydration is forward-only.

## Open Questions (resolved 2026-05-04)

1. ✅ **Annotation source** = use the assistant turn's response text directly as the annotation. Zero extra cost. Risk: if response text is brief/dismissive, annotation is sparse — acceptable trade-off for hotfix scope.
2. ✅ **Storage location** = XDG state-home, `~/.local/state/opencode/incoming/<sessionID>/<filename>`. Plus an explicit GC mechanism (daemon-startup + daily-cron sweep).
3. ✅ **Trigger granularity** = always dehydrate every attachment in the just-completed turn; binary preserved at the storage location so AI can `reread_attachment` later.
4. ✅ **TTL** = 7 days after `session.deleted` (sensible default). GC sweeps every daemon startup + once per day via cron.
5. ✅ **Subagent** = each session has its own `incoming/<sessionID>/`; parent's attachments do NOT bleed into child's incoming. If subagent needs parent's attachment, parent must re-attach in the dispatch context explicitly.
6. ✅ **v1 scope** = **images only** (PNG / JPG / WebP / GIF / etc). PDF / text / code attachments are deferred to a separate spec — a placeholder will be created when needed.
