# Handoff

## Execution Contract

- Build agent must read implementation-spec.md first
- Build agent must read proposal.md / spec.md / design.md / tasks.md before coding
- Materialize tasks.md into runtime todos before coding

## Required Reads

- implementation-spec.md
- proposal.md
- spec.md
- design.md
- tasks.md

## Current State

- Milestone 0 (Planning) 完成：架構 pivot 決策、ctl.sock protocol、error handling 策略已定
- Phase 1 (C Gateway Core) 部分完成：WebRoute struct / load / match / proxy 已在 unstaged diff，但缺 error redirect 和 uid 欄位
- Phase 2 (Control Socket) 尚未開始
- Phase 3 (CLI + Skill) 尚未開始
- Phase 4 (Testing) 尚未開始
- Gateway 尚未重新編譯

## Stop Gates In Force

- splice() 對 TCP socket 是否穩定：Phase 1 compile + smoke test 即可驗證
- ctl.sock group 權限：需確認 opencode group 存在且 daemon user 已加入
- cecelearn webapp 需運行中才能做端到端測試

## Build Entry Recommendation

建議執行順序：

1. **Phase 1 — 先完成 C Gateway Core**：補 error redirect (302)、uid 欄位，編譯驗證
2. **手動寫一份 routes.conf smoke test**：不等 ctl.sock，先確認 routing + splice + redirect 正確
3. **Phase 2 — 實作 ctl.sock**：加 epoll type、listen、JSON protocol、persistence
4. **Phase 3 — CLI + Skill**：有了 ctl.sock 後 webctl.sh 只是 socat/nc 等級的 client
5. **Phase 4 — 端到端驗證**

## Execution-Ready Checklist

- [x] Implementation spec is complete
- [x] Companion artifacts are aligned
- [x] Validation plan is explicit
- [x] Runtime todo seed is present in tasks.md
- [x] C Gateway core diff exists (unstaged, needs updates)
- [ ] Gateway compiled with new code
- [ ] ctl.sock implemented and tested
- [ ] CLI commands implemented
- [ ] Skill template written
