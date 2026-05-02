# Handoff: docxmcp-http-transport

## Execution Contract

Build agent picking up this spec MUST：

1. **Treat tasks.md as authoritative checklist source.** TodoWrite 一次只載一個 phase 的 `- [ ]`。phase 跨越時 atomic 滾。不允許全 10 phase 一次灌進 TodoWrite。
2. **Bind mount 任何形式絕對禁止.** docker `-v <host>:<container>` 與 `--mount type=bind` 全清。違規 = contract violation，立即停。docker named volume（DD-5 cache）允許但僅限明確列出的 `docxmcp-cache`。
3. **No silent fallback.** docxmcp HTTP container 沒起來 / token 失效 / upload 失敗 → 明確錯誤、不退回任何 stdio bind mount 路徑（per memory rule [feedback_no_silent_fallback.md](memory/feedback_no_silent_fallback.md)）。
4. **Cutover 一次性.** docxmcp 切 HTTP 之後不保留舊 stdio 路徑；要 rollback 走 git tag（task 7.2）。
5. **不動 bin/*.py.** 21 支 Python CLI 程式碼**保持原樣**；只動 mcp wrapper schema 與 token 解析層。
6. **Two-repo coordination.** 改動橫跨 `~/projects/docxmcp/` + `~/projects/opencode/`；commit 時兩 repo 對應 commit 的 message 互相引用。
7. **Sync after every checkbox.** 每勾完一條跑 `bun run ~/projects/skills/plan-builder/scripts/plan-sync.ts specs/docxmcp-http-transport/`。
8. **Phase boundary 寫 slice summary.** 每 phase 全綠後 `docs/events/event_<YYYYMMDD>_docxmcp-http-transport-phase<N>.md`。

## Required Reads

依序讀完才動手：

1. [proposal.md](proposal.md) — Why / 兩層 surface / Locked-in A-M / Cross-Cutting Security Policy
2. [spec.md](spec.md) — R1~R9 + 17 AC
3. [design.md](design.md) — DD-1 ~ DD-13、Risks RK-1~RK-8、Critical Files
4. [c4.json](c4.json) — 4 容器 / 8 元件 / 11 relationship
5. [sequence.json](sequence.json) — 6 個 runtime scenario
6. [data-schema.json](data-schema.json) — Token / FileUploadResponse / ToolCallTokenArgs / BindMountAuditViolation 等 schema（contract first）
7. [idef0.json](idef0.json) + [grafcet.json](grafcet.json) — 功能分解 + state machine
8. [memory/feedback_no_silent_fallback.md](memory/feedback_no_silent_fallback.md) — AGENTS.md 第一條
9. [memory/feedback_restart_daemon_consent.md](memory/feedback_restart_daemon_consent.md) — task 7.5 重啟必須先問
10. [memory/feedback_destructive_tool_guard.md](memory/feedback_destructive_tool_guard.md) — 動 `~/.local/state/opencode/mcp-staging/` 清理時必先停問
11. [specs/repo-incoming-attachments/design.md](../repo-incoming-attachments/design.md) — 撤掉的 DD-3/5/11/15/16 原文 + 保留的 DD-1/2/6/7/8/12/13/14/17
12. [docxmcp/HANDOVER.md](../../../docxmcp/HANDOVER.md) — docxmcp Wave 3 上下文；本 spec 落地後要更新

## Stop Gates In Force

| Stop | 觸發條件 | 應對 |
|---|---|---|
| SG-1 | 偵測到 docker run command 含 `-v <host>:<container>` 或 `--mount type=bind` | 停。回報違規 entry，等使用者拍板（理論上應該一個都沒有）|
| SG-2 | docxmcp HTTP server 啟動失敗 / healthz 不通 | 停。debug，不要繞回 stdio 路徑 |
| SG-3 | dispatcher 大刪期間發現有功能依賴 hard-link / break-on-write 但無替代 | 停。檢視是否有遺漏 DD 需要 supersede 或保留 |
| SG-4 | 動 `~/.local/state/opencode/mcp-staging/` 既有資料前 | 停。等使用者拍板清理範圍 |
| SG-5 | task 7.5 daemon restart 前 | 停。明確問「重啟嗎？」，使用者點頭才呼叫 `system-manager:restart_self` |
| SG-6 | mcp-apps.json 切換後 `/store/audit-bind-mounts` 回非空違規清單 | 停。回報違規 app id，等使用者決定遷移 / 移除 |
| SG-7 | 既有 attachment HTTP API 客戶端（web、TUI）行為改變 | 停。確認 attachment_ref schema 仍含 repo_path + sha256（R9）|
| SG-8 | sync drift warning 顯示「invalidates architecture」或「adds new requirement」 | 停。走 plan-builder `refactor` 或 `extend` mode |
| SG-9 | bundle base64 訊息超過 mcp client 可處理上限（>50MB），導致 tool call 卡 | 停。觸發 DD-10 v2 路徑（OQ-1 token-based 二次 GET）開新 spec |
| SG-10 | docxmcp container 啟動 race 導致 connect timeout | 停。確認 healthcheck + retry 設定 OK；不要繞過健康檢查強連 |

## Execution-Ready Checklist

開工前自我檢查清單，全 yes 才進 implementing：

- [ ] `.state.json.state == "planned"`
- [ ] §Required Reads 12 項全讀
- [ ] 10 條 Stop Gate 觸發條件已掌握
- [ ] 確認 `~/projects/docxmcp/` 與 `~/projects/opencode/` 兩 repo 都 clean working tree（沒未提交改動）
- [ ] 確認 docker daemon running（`docker version` ok）
- [ ] 確認 mcp Python SDK >= 1.27（已驗 phase E 時有 streamable_http_manager）
- [ ] 確認 opencode mcp client SDK 有 `StreamableHTTPClientTransport`（已 import 過）
- [ ] git tag `pre-http-transport-cutover` 在兩 repo 都已下（task 7.2 預備）
- [ ] phase 1 TodoWrite 已 bootstrap（task 1.1~1.7）
- [ ] beta-workflow 是否啟用？— 此 spec 跨兩 repo + 動 mcp 子系統 + 一次性 cutover；建議走 beta worktree（per memory `feedback_beta_xdg_isolation.md` 注意 XDG 隔離）
