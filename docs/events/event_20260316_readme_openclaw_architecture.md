# Event: README openclaw architecture wording

Date: 2026-03-16
Status: Completed
Branch: cms
Workspace: /home/pkcs12/projects/opencode

## 需求

- 更新中文 `README.md`，補上 `openclaw` 架構導入後的運作原理。
- 說明需對齊目前已落地 runtime，不可把 deferred scheduler/daemon 能力寫成現況。
- 完成後推送到 GitHub 與 GitLab。

## 範圍

### IN

- `/home/pkcs12/projects/opencode/README.md`
- `/home/pkcs12/projects/opencode/docs/events/event_20260316_readme_openclaw_architecture.md`
- git push to configured remotes

### OUT

- 不修改 `workflow-runner` 或 scheduler runtime 行為
- 不新增 fallback mechanism
- 不把 OpenClaw deferred roadmap 直接實作

## 任務清單

- [x] 讀取 `docs/ARCHITECTURE.md` 與相關 openclaw event/spec
- [x] 比對現有 `README.md` 與目前 runtime 實作
- [x] 更新 `README.md` 的 openclaw 導入運作原理說明
- [x] 記錄本次 event 與 architecture sync 結論

## Debug Checkpoints

### Baseline

- root `README.md` 已是中文產品說明，但缺少 `openclaw` 導入後的 runtime 解釋。
- `specs/20260315_openclaw_reproduction/*` 已明確指出目前優先吸收的是 trigger/queue/orchestrator substrate，而非直接上 full daemon lifecycle。

### Evidence Read

- `docs/ARCHITECTURE.md`
- `docs/events/event_20260315_openclaw_reproduction.md`
- `specs/20260315_openclaw_reproduction/spec.md`
- `specs/20260315_openclaw_reproduction/design.md`
- `specs/20260315_openclaw_reproduction/implementation-spec.md`
- `packages/opencode/src/session/workflow-runner.ts`
- `refs/openclaw/docs/concepts/agent-loop.md`
- `refs/openclaw/docs/concepts/queue.md`
- `refs/openclaw/docs/concepts/multi-agent.md`
- `refs/openclaw/docs/cli/daemon.md`

### Root Cause

- README 目前只描述 `cms` 的 multi-account / rotation / admin-plane，尚未補上 OpenClaw 對標後的 orchestration 轉向。
- 若直接用「OpenClaw 導入」這種字眼而不區分已落地與 deferred 項目，容易讓讀者誤以為 `cms` 已經具備 always-on daemon、heartbeat/cron、host-wide isolated job scheduler。

### Execution

- 在 `README.md` 的架構總覽後新增 `4.1 openclaw 架構導入後，系統現在怎麼運作`。
- 說明目前已落地的四個主軸：
  - session 是唯一執行邊界
  - `workflow-runner` 是 orchestration 中心
  - continuation queue 是 trigger 吸收層
  - supervisor 提供 lease/retry/anomaly evidence
- 額外用流程圖說明 `mission/todos -> queue -> workflow-runner -> serialized turn -> supervisor -> Web/TUI health`。
- 明確區分已吸收與刻意延後的 OpenClaw 概念，避免 roadmap 漂移。

## Validation

- `README.md` 已新增 OpenClaw 導入後的運作原理段落，且內容對齊 `workflow-runner.ts` 與 `openclaw_reproduction` spec ✅
- 本輪未改 runtime 程式碼，因此未執行 typecheck/test；屬文件更新任務，可接受 ✅
- Architecture Sync: Verified (No doc changes)
- 依據：本輪僅補 README 對既有 runtime 的敘述，未改模組邊界、資料流或狀態機實作；`docs/ARCHITECTURE.md` 現況仍可作為長期架構真相來源。
