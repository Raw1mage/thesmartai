# Observability: attachment-lifecycle

## Events

### Telemetry Events (DD-13)

All events go via `Bus.publish` or `log.info` (decide at impl time; both surfaced in daemon log file).

| Event | When | Payload |
|---|---|---|
| `attachment.dehydrated` | post-completion hook successfully dehydrates one image | `{ sessionID, filename, sha256, originalEstTokens, annotationChars }` |
| `attachment.dehydrate.skipped` | hook decides not to dehydrate | `{ sessionID, filename, reason: "non-image-mime" \| "failed-turn" \| "already-dehydrated" \| "dehydrate-disabled" \| "binary-missing-from-sqlite" }` |
| `attachment.dehydrate.write_failed` | IncomingStore.put throws | `{ sessionID, filename, error }` |
| `attachment.rereaded` | reread_attachment tool returns image bytes successfully | `{ sessionID, filename, byte_size }` |
| `attachment.reread.expired` | tool returns attachment_expired error | `{ sessionID, filename }` |
| `attachment.reread.not_found` | tool returns attachment_not_found error | `{ sessionID, filename, reason }` |
| `attachment.gc.swept` | GC sweep completes | `{ sessionsScanned, sessionsDeleted, bytesFreed, durationMs }` |
| `attachment.gc.session_failed` | per-session removal in sweep fails | `{ sessionID, error }` |
| `attachment.gc.daily` | daily cron timer fires (entry signal) | `{ scheduledAt }` |

## Metrics

Derived counters / aggregates:

| Metric | Definition | Target |
|---|---|---|
| `attachment_dehydration_rate` | `count(attachment.dehydrated) / count(images_uploaded)` per session | ≥ 90% (most images get dehydrated; failed turns + already-dehydrated drop us below 100%) |
| `attachment_token_savings` | `sum(originalEstTokens - annotationChars/4) per session` | observe — hard target hard to set without baseline |
| `reread_rate` | `count(attachment.rereaded) / count(attachment.dehydrated)` | < 20% (most dehydrations should NOT need reread; if higher, annotation quality may be poor) |
| `reread_expired_rate` | `count(attachment.reread.expired) / count(attachment_rereaded + attachment.reread.expired)` | < 5% |
| `gc_bytes_freed_per_day` | sum of `bytesFreed` from daily sweeps | observe; trend over weeks |
| `incoming_dir_size_bytes` | live disk usage of `~/.local/state/opencode/incoming/` | < 1GB typical; > 5GB → investigate |
| `dehydrate_write_failed_rate` | `count(write_failed) / count(dehydrate attempts)` | 0; any non-zero → alert |

## Logs

Structured log via `Log.create({ service })`:

- `service: "attachment-lifecycle"` — main lifecycle events
- `service: "incoming-store"` — filesystem operations
- `service: "attachment-gc"` — GC sweep details

## Dashboards (suggested)

| Panel | Source | Period |
|---|---|---|
| Dehydration count per day | `attachment.dehydrated` | 7d, 30d |
| Token savings cumulative | derived from `attachment.dehydrated` payload | 30d |
| Reread rate | `attachment.rereaded` / `attachment.dehydrated` | 7d |
| Disk usage trend `~/.local/state/opencode/incoming/` | filesystem du sample | 30d |
| GC sweep duration + bytes freed | `attachment.gc.swept` | 30d |
| Top sessions by dehydration count | `attachment.dehydrated` group by sessionID | 7d |

## Alerts

| Alert | Condition | Action |
|---|---|---|
| dehydration write failed | any `attachment.dehydrate.write_failed` event | page on-call (disk / permission issue) |
| reread expired rate spike | `reread_expired_rate > 10%` over 24h | review TTL setting; check unexpected GC firings |
| incoming dir grew > 5GB | filesystem sample | check GC cron is firing; manual sweep if needed |
| GC sweep duration > 60s | `attachment.gc.swept.durationMs > 60000` | optimize sweep (parallel?) or investigate huge dirs |
| dehydration rate < 50% for active session | derived | investigate why hook not firing (config? finish reason?) |

## Manual smoke checks

```bash
# Watch dehydration in real time
tail -f /run/user/1000/opencode-per-user-daemon.log | grep -E "attachment\.(dehydrated|reread|gc)"

# Spot-check incoming dir
du -sh ~/.local/state/opencode/incoming/
ls ~/.local/state/opencode/incoming/

# Verify a specific session's incoming
ls -la ~/.local/state/opencode/incoming/<sessionID>/
```

## Backwards compat observability

Old sessions (with hydrated attachments) emit no `attachment.dehydrated` events. They continue to send full image binaries on every turn — token usage will not benefit. This is by design (no migration; forward-only).

Operator can verify: `attachment_dehydration_rate` per session ID — old sessions = 0%, new sessions = ~90%+.
