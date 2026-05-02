# 2026-05-03 — repo-incoming-attachments / Mid-implementation Spec Correction

## Trigger

Phase 2 開工掃 [packages/opencode/src/server/routes/](../../packages/opencode/src/server/routes/) 找 upload route 與 [tool/attachment.ts](../../packages/opencode/src/tool/attachment.ts) 時，發現原 spec 對 attachment 儲存層的 mental model 是錯的。

## What was wrong

Spec 文（proposal.md / spec.md R10 / design.md DD-10 / tasks 2.5-2.6 / errors.md INC-3001-2 / test-vectors TV-04, TV-11）假設 opencode 把上傳檔案存在 `~/.local/state/opencode/attachments/<refID>.docx` 這種 plain-file content-addressed cache。

實際從 [session/storage/index.ts](../../packages/opencode/src/session/storage/index.ts)、[legacy.ts](../../packages/opencode/src/session/storage/legacy.ts)、[sqlite.ts](../../packages/opencode/src/session/storage/sqlite.ts) 看到：attachment 是 `SessionStorage.AttachmentBlob` 結構，包含 `content: Uint8Array` 嵌入欄位，存於 storage key `["attachment", sessionID, refID]`。LegacyStore 把 content base64 進 JSON envelope；SqliteStore 把 content 進 SQLite blob 欄。**沒有任何 `~/.local/state/opencode/attachments/*.docx` plain file。**

## Why the mistake matters

Plan 中所有「廢除舊 cache 路徑」的描述（5/8 個 spec 段落）都攻擊不存在的目標。phase 2.5 / 2.6 的任務描述會引導 implementor 找一段不存在的程式碼。INC-3001 的錯誤訊息與真實情境不符。R10-S1 的 scenario 永遠跑不通。

## What stayed valid

- 使用者初衷（檔案應屬 repo、不該被吞、計算成果不丟）完全沒變。攻擊面換了，目標一致。
- Phase 1 完成的 [packages/opencode/src/incoming/](../../packages/opencode/src/incoming/)（paths.ts + history.ts）跟 storage 層解耦，繼續有效。22/22 unit test 仍綠。
- C4 / sequence / data-schema / idef0 / grafcet 對「上層流程」的描述仍然對；只有提到 legacy cache 那段需要重新理解為「legacy AttachmentBlob row」。
- 新加的 DD-14 / 15 / 16（path rewriting / EXDEV fallback / manifest verify）跟此 drift 無關，不動。

## Mode considered

`revise` mode 在 plan-builder 規定 `living → designed`，本 spec 在 `implementing` 狀態，script 拒絕轉換。state machine 沒有「mid-build 發現 spec drift」的官方 mode。

## Action taken

選擇 §6 Layer 1/2 inline-delta marker 就地改寫，不退回 designed state：

1. proposal.md — Why 段標 v1 SUPERSEDED 加 v2、Effective Requirement 第 5 條 strike + add v2、Revision History 加一條 2026-05-03 紀錄
2. spec.md R10 整段 strike，新增 R10' 三個 scenario（新寫輕量引用 / 舊 row 仍可讀 / 新 row 缺 repo file 報錯）；AC-15 strike 加 AC-15a/b/c
3. design.md DD-10 整段 strike，新增 DD-17（AttachmentBlob schema 演進為 content optional + 新增 repoPath/sha256）
4. tasks.md 2.5 strike 加 2.5'/2.5''；2.6.1 加 attachment helper 改寫
5. errors.md INC-3001 strike 加 INC-3001'（attachment_repo_file_missing），INC-3002 改寫成 attachment_blob_malformed
6. test-vectors.json TV-04 fsExpectations 修正、TV-11 整條換成 TV-11/11B/11C 三條對應 R10'-S2/S3 / INC-3001'

## Validation

- `plan-validate` 13/13 PASS at state=implementing
- JSON 格式有效
- `incoming/` 模組程式碼不動、tests 不重跑（與此 drift 無關）

## Continuing

Phase 2 重新規劃以 DD-17 為基準：
- 2.1~2.4 維持原計畫
- 2.5' / 2.5'' 新增 — 演進 AttachmentBlob schema、改 getAttachmentBlob 雙路徑
- 2.6 / 2.6.1 維持 + 微調

下一步：開始 phase 2 task 2.1（upload route）。
