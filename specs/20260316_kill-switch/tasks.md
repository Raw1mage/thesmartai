# Tasks for Kill-switch Implementation

1-spec: 完成 planner artifacts（implementation-spec.md, spec.md, design.md） — owner: planner — status: done

2-core-api: 實作 state store 與 API endpoints

- files: src/server/services/kill_switch_state._ , src/server/routes/admin/kill_switch._ — owner: backend — est: 1d

3-rbac-mfa: 整合 RBAC 與 MFA 檢查到 API — owner: backend/security — est: 1d

4-agent-check: 在 agent 啟動與 scheduler path 加入 check（短路新任務） — owner: infra — est: 0.5d

5-soft-kill: 實作 soft-pause signaling (redis pubsub / control channel) — owner: infra — est: 0.5d

6-hard-kill: 實作 timeout 驅動的 force termination — owner: infra — est: 0.5d

7-snapshot: snapshot generator 與上傳（object store） — owner: infra/ops — est: 0.5d

8-web-ui: admin button 與 modal — owner: frontend — est: 1d

9-tui: TUI hotkey + confirmation flow — owner: tui — est: 0.5d

10-tests: 單元與集成測試 + E2E — owner: qa — est: 1d

11-runbook: 撰寫 runbook 與 postmortem template — owner: ops — est: 0.5d

12-security-review: 安全團隊 review 並 sign-off — owner: security — est: 0.5d

依賴關係與順序：2 -> 3 -> 4,5 -> 6 -> 7 -> 8,9 -> 10 -> 11 -> 12
