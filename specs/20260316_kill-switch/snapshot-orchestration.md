# Snapshot Orchestration（phase-1 / phase-2）

目的：定義 trigger/cancel/control 流程中 snapshot 證據的生成與可追溯性策略。

## Phase-1 (current milestone)

- 策略：Storage-first placeholder
- 行為：
  1. trigger accepted 後建立 snapshot placeholder URL（local/storage path）
  2. 將 `snapshot_url` 寫入 state 與 audit
  3. 若 placeholder 建立失敗，寫 `snapshot_failure` audit，但不阻塞 kill-switch 主流程

## Phase-2 (deferred adapter)

- 策略：MinIO/S3 adapter（可插拔）
- 目標：
  - snapshot job 收集 logs/sessions/tasks/provider sample
  - upload object store
  - 回填 signed `snapshot_url`

## Data contract

- snapshot metadata 最少包含：
  - `request_id`
  - `initiator`
  - `mode/scope`
  - `created_at`
  - `source`（placeholder|minio）

## Failure handling

- snapshot 失敗不阻斷 kill 流程
- 必須在 audit 可檢索到失敗原因與 request_id

## Security note

- phase-2 signed URL TTL 與 ACL 由部署策略決定；spec 不允許公開永久 URL
