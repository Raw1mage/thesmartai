# Design：Kill-switch phase-1 technical design

## 1) Architecture boundary (current truth)

- Runtime authoritative paths:
  - `packages/opencode/src/server/routes/killswitch.ts`
  - `packages/opencode/src/server/killswitch/service.ts`
  - `packages/opencode/src/server/routes/session.ts`
- App mount:
  - `/api/v2/admin/kill-switch` via `packages/opencode/src/server/app.ts`

## 2) State & persistence strategy

- **Phase-1 strategy: Storage-first**
  - 使用現有 `Storage` 寫 state/audit/snapshot placeholder
  - 優先確保可在現行 runtime 直接部署與驗證
- **Phase-2 extension: adapterized Redis/MinIO**
  - 保留 control transport 與 snapshot backend adapter 契約
  - 不在 phase-1 強制導入 Redis/MinIO 運維依賴

## 3) Control protocol & fallback

- Control action: `pause|resume|cancel|snapshot|set_priority`
- ACK schema: `accepted|rejected|error`
- `seq` 要求：worker 僅接受高於 last_seq 的控制指令
- Orchestrator fallback:
  - `ack != accepted` -> `forceKill`
  - timeout/no-ack -> `forceKill`
- Fail-fast 原則：不以 silent fallback 掩蓋控制失敗

## 4) Scheduling gate model

- 在 session scheduling 入口加 gate：
  - `POST /session/:id/message`
  - `POST /session/:id/prompt_async`
- kill-switch active 時立即拒絕（`409 KILL_SWITCH_ACTIVE`）

## 5) Security model

- Boundary-1: auth-bound operator identity（`RequestUser` + `WebAuth`）
- Boundary-2: capability gate `kill_switch.trigger`
  - 來源：`Config.getGlobal().permission`
  - 判定：`PermissionNext.evaluate("kill_switch.trigger", "*")`
  - 政策：**deny-by-default**（未 allow 視同拒絕）
- MFA gate:
  - trigger 在無 `mfaCode` 時先 challenge
  - verify fail -> 401

## 6) Observability & audit

- 寫入 audit event：challenge、mfa fail、trigger accepted/partial、cancel、snapshot failure
- 所有 destructive/fallback path 必須具可追溯 `request_id`

## 7) Trade-offs

- 選擇 Storage-first，可最快落地且與現有 runtime 一致；代價是跨節點一致性能力延後到 adapter phase。
- 選擇 capability deny-by-default，提升安全基線；代價是部署需顯式開啟 permission。

## 8) Deferred items (explicit)

- Web Admin/TUI 操作流與 UX
- Redis transport reliability（pubsub QoS）
- MinIO signed URL 與 retention policy
