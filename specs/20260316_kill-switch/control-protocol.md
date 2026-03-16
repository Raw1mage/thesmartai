# Control Protocol（phase-1 authoritative）

目的：定義 `KillSwitchService.publishControl(...)` 與 worker 控制回應的最低契約，確保 seq/ACK 可驗證且失敗可 fallback。

## 1) Control message contract

- Source: orchestrator / admin route
- Shape:
  - `{ requestID, sessionID, seq, action, initiator, timeoutMs }`
  - `action ∈ {pause,resume,cancel,snapshot,set_priority}`

## 2) ACK contract

- Worker ACK shape:
  - `{ requestID, sessionID, seq, status, reason?, timestamp }`
  - `status ∈ {accepted,rejected,error}`

## 3) Sequence semantics

- Worker 必須維護 per-session `last_seq`
- 僅接受 `seq > last_seq`
- 舊序列應回 `rejected`（reason: `seq_not_higher` 類型）

## 4) Timeout & fallback semantics

- `timeoutMs` 預設 5000ms
- ACK 超時或異常時：orchestrator 進入 fallback (`forceKill`)
- ACK `rejected/error`：視為控制失敗，直接 fallback (`forceKill`)

## 5) Transport strategy

- Phase-1: runtime-native implementation（Storage-first，不強綁 Redis）
- Phase-2: 可插拔 transport adapter（Redis/NATS/WebSocket）

## 6) Audit requirements

- control receive / ack result / fallback action 皆應可寫 audit（至少在 route 層記錄）
- destructive fallback 必須帶 `requestID`, `sessionID`, `initiator`, `reason`
