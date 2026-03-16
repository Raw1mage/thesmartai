# Spec: Kill-switch 行為需求與場景（runtime authoritative）

## 1) Status path

- Endpoint: `GET /api/v2/admin/kill-switch/status`
- When inactive:
  - 回 `200`
  - payload 至少包含 `ok=true`, `active=false`, 其餘欄位為 `null` 或缺省
- When active:
  - 回 `200`
  - payload 必含：`active`, `initiator`, `initiated_at`, `mode`, `scope`, `ttl`, `snapshot_url`, `request_id`, `state`

## 2) Trigger path

- Endpoint: `POST /api/v2/admin/kill-switch/trigger`
- Input minimal contract:
  - required: `reason`
  - optional: `initiator`, `mode`, `scope`, `ttl`, `requestID`, `mfaCode`
- Authorization contract:
  - auth-bound operator gate 通過
  - capability `kill_switch.trigger` 必須為 allow（deny/ask 一律拒絕）
- MFA contract:
  - 無 `mfaCode`：回 `202` + `mfa_required=true` + `request_id`
  - 有 `mfaCode` 且驗證成功：進入 trigger 主流程
  - 驗證失敗：回 `401 mfa_invalid`
- Success contract:
  - 回 `200`
  - 包含 `request_id`, `snapshot_url`

## 3) Soft-pause semantics

- Trigger accepted 後，狀態設為 active + `state=soft_paused`
- 新任務排程入口必須拒絕：
  - `POST /api/v2/session/:sessionID/message`
  - `POST /api/v2/session/:sessionID/prompt_async`
- 拒絕時回 `409` 並帶 `code=KILL_SWITCH_ACTIVE`

## 4) Task control / ACK semantics

- Endpoint: `POST /api/v2/admin/kill-switch/tasks/:sessionID/control`
- Action: `pause|resume|cancel|snapshot|set_priority`
- 協定要求：
  - 每次 control 具備 `seq`
  - worker 回 `ack.status in {accepted,rejected,error}`
- Fail-fast/fallback：
  - `ack.accepted` => success
  - `ack.rejected`/`ack.error` => `forceKill` + API 失敗返回
  - timeout/no-ack => `forceKill` + timeout 失敗返回

## 5) Cancel path

- Endpoint: `POST /api/v2/admin/kill-switch/cancel`
- Authorization same as trigger
- 行為：清除 active state，恢復新任務排程可用

## 6) Audit contract

- 下列事件必須寫 audit：
  - mfa_challenge_generated
  - mfa_failed
  - trigger accepted / partial
  - cancel
  - snapshot failure（若發生）

## 7) Idempotency + cooldown

- 同 initiator+reason 在 idempotency window 內可重用 request_id
- 同 initiator 短時間重複操作受 cooldown 保護（回 429）

## 8) Edge cases

- Snapshot 建立失敗不可阻塞 kill-switch 主流程（必須寫 failure audit）
- Capability 未明確 allow 視同 denied（deny-by-default policy）
