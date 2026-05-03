# Errors: attachment-lifecycle

## Error Catalogue

### E-ATTACHMENT-EXPIRED (model-facing tool error)

| 欄位 | 值 |
|---|---|
| **Code** | `attachment_expired` |
| **Source** | `tool/reread-attachment.ts` (DD-9) |
| **Layer** | tool result |
| **Throw site** | When `IncomingStore.get(sid, filename)` returns null AND a part with this filename has `dehydrated=true` (i.e. binary was here, GC removed it) |
| **User-visible message** | "Image '<filename>' was staged but has been garbage-collected past its 7-day TTL. Original is no longer recoverable; please ask the user to re-upload if you need to look at it." |
| **Recovery** | Model asks user to re-upload; alternative — model proceeds based on existing annotation |
| **Telemetry** | `attachment.reread.expired { sessionID, filename }` |

### E-ATTACHMENT-NOT-FOUND (model-facing tool error)

| 欄位 | 值 |
|---|---|
| **Code** | `attachment_not_found` |
| **Source** | `tool/reread-attachment.ts` |
| **Layer** | tool result |
| **Throw site** | When the requested filename matches no dehydrated part in this session, or sanitization rejects the input (path traversal etc) |
| **User-visible message** | "No staged attachment named '<filename>' found in this session. Either the filename is incorrect, or it was never uploaded." |
| **Recovery** | Model self-corrects by listing prior attachments mentally / asks user |
| **Telemetry** | `attachment.reread.not_found { sessionID, filename }` |

### W-DEHYDRATION-SKIPPED (telemetry-only, not thrown)

Multiple sub-cases all surface as `attachment.dehydrate.skipped`:

| Reason | Trigger |
|---|---|
| `non-image-mime` | mime starts with anything other than `image/` (DD-3 v1 scope) |
| `failed-turn` | `finish !== "stop"` (DD-10) |
| `already-dehydrated` | part already has `dehydrated === true` (DD-5 idempotency) |
| `dehydrate-disabled` | tweaks.cfg `attachment_dehydrate_enabled=false` |
| `binary-missing-from-sqlite` | sqlite attachments table doesn't have the binary (already moved or never had it) — log warn, skip |

| 欄位 | 值 |
|---|---|
| **Code** | (no throw; telemetry only) |
| **Source** | `processor.ts` post-completion hook |
| **Telemetry** | `attachment.dehydrate.skipped { sessionID, filename, reason }` |
| **User-visible** | none |
| **Recovery** | Natural — non-image / failed turn / disabled don't need recovery; rare `binary-missing-from-sqlite` indicates upstream race or earlier failure (treat as defensive) |

### E-INCOMING-WRITE-FAILED (logged, dehydration aborts for that part)

| 欄位 | 值 |
|---|---|
| **Code** | `incoming_write_failed` |
| **Source** | `incoming-store.ts put()` |
| **Layer** | session/storage |
| **Throw site** | Filesystem write fails (disk full, permission denied, EIO) |
| **User-visible message** | none (background hook); session continues with attachment still hydrated |
| **Recovery** | Defensive: leave the attachment_ref in its original hydrated form; emit `attachment.dehydrate.write_failed { sessionID, filename, error }`; ops should investigate disk/permissions |
| **Telemetry** | `attachment.dehydrate.write_failed { sessionID, filename, error }` |

### E-GC-SWEEP-FAILED (logged, GC aborts for that session)

| 欄位 | 值 |
|---|---|
| **Code** | (no throw to caller; per-session error logged) |
| **Source** | `garbage-collect-incoming.ts` |
| **Layer** | session/storage |
| **Throw site** | rmdir / unlink fails for a specific session dir |
| **Recovery** | Skip that session; continue sweep on others; emit warn telemetry |
| **Telemetry** | `attachment.gc.session_failed { sessionID, error }` |

## Error budget / SLO

| Event | Tolerance | Alert |
|---|---|---|
| `attachment_expired` (model received) | normal — happens for sessions older than TTL | only alert if > 5% of reread calls return expired (unexpected GC) |
| `attachment_not_found` | < 1% of reread calls (model rarely typos filename) | persistent > 5% → review tool prompt clarity |
| `attachment.dehydrate.write_failed` | 0 | any 1 occurrence → ops investigate disk |
| `attachment.gc.session_failed` | < 1% of swept sessions | > 5% → permission/FS audit |
