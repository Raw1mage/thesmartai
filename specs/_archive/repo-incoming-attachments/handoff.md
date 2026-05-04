# Handoff: repo-incoming-attachments

## Execution Contract

Build agent picking up this spec MUST：

1. **Treat tasks.md as authoritative checklist source.** TodoWrite 載入單位是一個 `## N.` phase 的所有 `- [ ]` 項；phase 跨越時 atomic 滾到下一 phase。不允許一次性把全 7 phase 灌進 TodoWrite。
2. **Drive everything through `incoming.dispatcher`.** 任何寫入 `<repo>/incoming/**` 的程式路徑（upload route、Edit/Write/Bash tool、mcp tool）都要走 break-on-write helper（DD-11）。直接 `fs.writeFile` 進 incoming/ 屬於 contract violation；phase 4.5 的 negative test 會抓到。
3. **No silent fallback.** session.project.path 解析失敗就直接 reject 上傳（DD-1）。不要偷渡舊 attachment cache 路徑當退路。對應 memory rule [feedback_no_silent_fallback.md](memory/feedback_no_silent_fallback.md)。
4. **mcp 容器邊界不准擴張.** DD-3：docxmcp 啟動 mount 列表只能有 `<staging-area>:/state`。看到任何 host repo path / `$HOME` 出現在 docker run command 都是錯。phase 5 的 mount 列表審計（AC-13）會抓到。
5. **Hard-link cross-session cache（DD-11）.** publish bundle 用 `link()` 而非 `cp -r`。後續對 incoming 端的寫入必須先 break-on-write（stat → 若 nlink>1 → cp+rename → write）。
6. **Sync after every checkbox.** 每勾完一條任務跑 `bun run ~/projects/skills/plan-builder/scripts/plan-sync.ts specs/_archive/repo-incoming-attachments/`，drift 警告依 §16.3 決策樹處理。
7. **Phase boundary 寫 slice summary.** 每個 phase 全綠後寫 `docs/events/event_<YYYYMMDD>_repo-incoming-attachments-phase<N>.md`，記錄完成的 task ID、新 DD（若有）、validation 結果、drift 處理結果，然後**自動滾到下一 phase 不暫停**。

## Required Reads

依序讀完才能動手：

1. [proposal.md](proposal.md) — Why / 範圍 / locked-in decisions A~I（共 9 條 + 後續 J~M 即 DD-12 / DD-13 / hard-link 規範）
2. [spec.md](spec.md) — R1~R10 + 15 個 Scenario + 15 條 Acceptance Check
3. [design.md](design.md) — DD-1 ~ DD-13、Risks RK-1~RK-7、Critical Files
4. [c4.json](c4.json) — 結構觀：4 容器 / 6 元件
5. [sequence.json](sequence.json) — 7 個 runtime scenario
6. [data-schema.json](data-schema.json) — HistoryEntry / AttachmentRef / DispatcherStageRequest schemas（contract first，code 跟 schema 走）
7. [idef0.json](idef0.json) + [grafcet.json](grafcet.json) — 功能分解 + slot state machine
8. [memory/feedback_no_silent_fallback.md](memory/feedback_no_silent_fallback.md) — AGENTS.md 第一條
9. [memory/feedback_repo_independent_design.md](memory/feedback_repo_independent_design.md) — runtime state 不應 repo-relative
10. [memory/feedback_minimal_fix_then_stop.md](memory/feedback_minimal_fix_then_stop.md) — 不要在這 spec 之外擅自擴張到「跨 platform 路徑通用」「fs watcher」等鄰近題目
11. [memory/feedback_destructive_tool_guard.md](memory/feedback_destructive_tool_guard.md) — 動到 `~/.local/state/opencode/attachments/` 舊資料前必須先停下確認
12. [docxmcp:HANDOVER.md](../../../docxmcp/HANDOVER.md) — Wave 3 既有上下文（要 supersede 其中「Bundle 預設落點」段，phase 6.2）

## Stop Gates In Force

以下情境必須停下、報告、等使用者拍板，**不可**自行繞過或推進：

| Stop | 觸發條件 | 應對 |
|---|---|---|
| SG-1 | 動到 `~/.local/state/opencode/attachments/` 既有舊資料前 | 停。回報哪些 ref 還活著，等使用者決定遷移 / 刪除 / 留著 |
| SG-2 | daemon 需要重啟才能 reload incoming module | 停。明確問「重啟嗎？」，使用者點頭才呼叫 `system-manager:restart_self`（memory rule [feedback_restart_daemon_consent.md](memory/feedback_restart_daemon_consent.md)） |
| SG-3 | 偵測到任何 mcp app 的 docker run command 含 host repo / HOME mount | 停。debug，不要 workaround |
| SG-4 | 履歷 jsonl 出現 schema_version > 1 的紀錄 | 停。代表有未來版本的 daemon 寫過、向下相容路線需要先確認 |
| SG-5 | break-on-write helper 失敗、cache 端 inode 被改 | 停。RK-1/RK-3 觸發，回報具體繞過 path 與 stack trace |
| SG-6 | sync drift warning 顯示「adds new requirement / capability」 | 停。走 plan-builder `extend` mode，而不是繼續硬寫 |
| SG-7 | sync drift warning 顯示「invalidates architecture」 | 停。走 plan-builder `refactor` mode |
| SG-8 | 既有 attachment HTTP API 客戶端（web、TUI、其他 client）行為改變 | 停。需求是回傳 schema 加欄位 + 保留 `refID` deprecated alias，不可 break old client |
| SG-9 | 任何 phase 過程中發現 design.md 某條 DD 與實作衝突 | 停。回報衝突，走 `amend` mode 修 DD，不可繞過 |

## Execution-Ready Checklist

開工前自我檢查清單，全 yes 才能進 implementing：

- [ ] 已 promote 到 `planned` 狀態（`.state.json.state == "planned"`）
- [ ] 已讀完 §Required Reads 全部 12 項
- [ ] 已掌握 9 條 Stop Gate 觸發條件
- [ ] 已確認 `~/.local/state/opencode/mcp-staging/docxmcp/{staging,bundles}/` 路徑可建立（DD-5）
- [ ] 已確認本機 `link()` syscall 可用（hard-link 必要條件，DD-11）
- [ ] 已確認 docxmcp 容器最新版可重新 build（軌 D 已完成；本 spec 不重做容器）
- [ ] 已建立 phase 1 的 TodoWrite 載入（task 1.1~1.9）並把 1.1 標 in_progress
- [ ] beta-workflow 是否啟用？— 此 spec 範圍動 opencode core，建議走 beta worktree，但若使用者另有指示優先聽使用者
