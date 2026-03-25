# Event: Gateway Google Login Binding

**Date**: 2026-03-25
**Branch**: `plans/20260325_linux-pam-per-user-daemon/`

## Scope

### IN
- 評估 gateway 是否應支援 Google login 相容路徑
- 定義 Linux PAM 與 Google 登入的角色邊界
- 收斂 Google 身分與 Linux user 的綁定政策
- 判斷 `gauth.json` 是否適合作為綁定真相來源
- 設計未綁定時的 fail-fast 拒絕策略

### OUT
- 實作 gateway 登入程式碼
- 變更現有 PAM 主流程
- 改寫 Google OAuth token 管理格式
- 前端綁定 UI/管理頁實作

## Key Decisions
- Linux PAM 維持主登入入口，不被 Google 取代
- Google login 可作為相容入口，但前提是事前已綁定到有效 Linux 帳號
- gateway 不接受未綁定的 Google 身分，必須明確拒絕
- Linux user 為主體真相來源，Google account 為附屬關聯
- 綁定動作應在 Linux 先登入後完成
- 綁定主鍵傾向使用 Google email，但需再確認是否要補存 stable sub
- 綁定資料不放入 `gauth.json`，而是由 `/etc/opencode/` 下的全域 registry module 管理

## Open Questions
- `gauth.json` 是否只適合存 OAuth token，而不適合存 Linux↔Google binding
- 綁定資料應放在本機 user scope、中心 registry，還是沿用 account/auth service
- 是否需要在後續 plan 中新增 binding schema 與 gateway lookup contract

## Verification
- 以現有 architecture docs 與 Gmail/Calendar OAuth 事件確認：`gauth.json` 目前角色是 shared Google OAuth token storage，不是 binding registry
- 目前沒有看到 Linux user ↔ Google identity 的既有綁定資料模型
- Gateway 變更已落地：新增 `POST /auth/login/google`，以 `google_email` 解析 binding registry 並在未綁定時回 403
- `daemon/opencode-gateway.c` 已保留 Linux PAM `/auth/login` 原路徑，未引入 fallback / auto-match

## Architecture Sync
- Architecture Sync: Updated — 已補充 gateway 身分邊界、Google 登入相容路徑與 registry 放置原則

## Remaining
- 需要後續確認 `/etc/opencode/google-bindings.json` 的實際持久化與管理責任
- 需要決定 binding registry 是否要進一步納入正式配置生成流程
