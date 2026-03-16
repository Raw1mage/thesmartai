# RBAC / Capability Hooks for Kill-switch

目的：定義 kill-switch 的實際授權邊界，避免 header-based 假角色與 silent fallback。

## 1) Permission model (authoritative)

- Capability key: `kill_switch.trigger`
- Policy: deny-by-default
  - 未設定 allow 視同拒絕
  - `ask` 在本路徑視為拒絕（不進互動 permission flow）

## 2) Gate sequence

1. **Auth-bound operator gate**
   - source: `RequestUser.username()` + `WebAuth`
   - if web-auth enabled and request user missing -> `401 auth_required`
   - if configured operator exists and mismatch -> `403 operator_mismatch`
2. **Capability gate**
   - source: `Config.getGlobal().permission`
   - evaluator: `PermissionNext.evaluate("kill_switch.trigger", "*")`
   - non-allow -> `403 capability_denied`
3. **MFA gate (trigger path)**
   - no mfa code -> challenge (202)
   - invalid mfa -> 401

## 3) Hook locations

- `POST /api/v2/admin/kill-switch/trigger`
- `POST /api/v2/admin/kill-switch/cancel`
- `POST /api/v2/admin/kill-switch/tasks/:sessionID/control`

## 4) Audit requirements

- 授權相關事件至少記錄：
  - initiator
  - action
  - permission (`kill_switch.trigger`)
  - result (`accepted|denied|challenge|partial`)
  - reason（例如 `operator_mismatch`, `capability_denied`）

## 5) Deployment policy

- 上線前需在 global config 顯式加入：`kill_switch.trigger = allow`（僅授權操作者環境）
- 若未配置 allow，預期所有操作返回 403（這是預期安全行為）
