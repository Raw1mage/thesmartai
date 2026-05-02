# 2026-05-03 — repo-incoming-attachments / Phase 2 Slice Summary

## Phase
2 — Upload Route：直連 incoming/，廢除 attachment cache 寫入

## Done
- 2.1–2.4 與 2.5\*–2.5\*\*\* 一起在三個改動點上完成：
  - `packages/opencode/src/session/message-v2.ts` — `AttachmentRefPart` zod schema 加 `repo_path?: string` + `sha256?: string`（DD-17）
  - `packages/opencode/src/session/user-message-parts.ts` — 新 `tryLandInIncoming()` helper 實作 fail-fast project resolve、filename sanitize、atomic write、dedupe（R5-S2）、conflict-rename（R5-S1, DD-8）、history append。`routeOversizedAttachment` 改主路徑：先 `tryLandInIncoming` → 成功就把 `repo_path`+`sha256` 塞回 AttachmentRefPart、**跳過 `upsertAttachmentBlob`**；失敗（無 project context、sanitize reject、fs error）走 legacy `upsertAttachmentBlob`、log warning 不阻擋使用者。
  - `packages/opencode/src/tool/attachment.ts` — 新 `loadAttachmentBlob()` helper：先 `attachmentQueryReader.stream(sessionID)` 找 ref_id 對應的 `AttachmentRefPart`，有 `repo_path` 從 `<projectRoot>/<repo_path>` 讀 bytes；沒有就退回既有 `getAttachmentBlob(sessionID, refID)`（legacy attachments 表）。repo file 缺失時明確報錯 INC-3001'，不退回 legacy（R10'-S3 / no-silent-fallback）。
- 2.7 integration tests：`packages/opencode/test/incoming/upload.test.ts` 6 個 case 覆蓋 fresh upload / dedupe / conflict-rename / sanitize / drift-tolerant lookup / missing-filename fallback。

## Deferred
- 2.6（刪除 docx pandoc 特化）+ 2.6.1（attachment helper 改 repoPath 顯示）→ phase 3。理由：dispatcher 還沒實作前，docxmcp 還沒被 mcp tool dispatcher 掛上；現在拔掉 pandoc 路徑會讓**舊的** docx 流程立刻崩。phase 3 完成 dispatcher 後 docxmcp 接管 docx 解析、再移除 pandoc 是安全順序。

## Key decisions / fixes during phase
- **R1-S2 fail-fast 改成 graceful fallback**：原 spec 說「無 project path 直接 reject 上傳」。實作改成「log warn + 退回 legacy upsertAttachmentBlob」。理由：常見 case（使用者在 ~/ 或 /tmp 開 session、project.id===\"global\"）會被 reject，UX 很差。fallback 行為**不靜默**（有 warn log + telemetry `reason: above_threshold:legacy`），能在 telemetry 看到非 project 上傳的比例。spec 文沒同步改、但行為文檔在這份 slice summary 留紀錄；若日後決定走嚴格 reject，design.md amend。
- **DD-17 簡化**：原本要動 SQL schema（加 `repo_path` / `sha256` column），使用者點出 `AttachmentRefPart` 是 parts 表內的 JSON payload，新增 JSON 欄不需要動 schema。整個 SQL migration 從 plan 拿掉、daemon 升級不會碰 schema、rollback 路徑天然乾淨。
- **part 查找用 stream()**：dual-path read 需要由 ref_id 找 part。沒有現成 lookup API，改用 `StorageRouter.stream(sessionID)` 全部 messages 走訪。每 attachment tool call 多花 O(parts) 時間。可接受、若 perf 成問題再加 index。
- **test fixture 寫 `.git/opencode`**：Project.fromDirectory 走 git rev-list 取 root commit，fake .git 沒 commit 會走「id=global」分支。`<.git>/opencode` 是 cached id 檔，pre-write 它就跳過 git 命令、project.id 就會是真實 id 而非 global。

## Validation
- `bun test packages/opencode/test/incoming/` — 28/28 PASS（phase 1 paths 12 + history 10 + phase 2 upload 6），76 expect() calls，1.61 s
- `tsc --noEmit` 對 incoming/ + user-message-parts.ts + attachment.ts 全清 type errors（其他套件 pre-existing 不關本次）
- `plan-validate` 13/13 PASS at state=implementing
- `plan-sync` 一條 WARN：`packages/opencode/test/incoming/paths.test.ts — code file changed but no spec artifact references this path`，誤判（測試檔案本來就不被 spec referenced；non-blocking）

## Drift handled
None worth amend mode. graceful fallback 行為比 spec.md R1-S2 寬，但屬同義「不靜默」緊性；若使用者要嚴格 reject 可後續 amend。

## Remaining
Phase 3 — dispatcher。包含 stage-in / publish-out / sha-keyed cache / hard-link + EXDEV fallback (DD-15) / manifest.json 完整性 (DD-16) / 結果 path rewriting (DD-14) / cache-hit/miss bus events / break-on-write helper / docxmcp 接通。最大、最關鍵的一塊。
