# Proposal

## Why

- 目前 runner 已有 `session.mission` authority contract，但 autonomous continuation 仍主要只依賴 todo graph 與 workflow state。
- `plan_exit` 雖然已把 OpenSpec artifact paths、materialized todos 與 handoff metadata 寫入 session/message，但 runtime 尚未真正「消費」這些 mission artifacts 作為後續 execution input。
- 這造成目前的 authority boundary 只有「有沒有批准計畫」，還沒有「runner 是否真的依批准計畫內容執行」。
- 若不先建立 mission consumption baseline，就無法安全推進後續 delegated execution baseline 或 cms sync 評估。

## What Changes

- 定義 runner 的第一個 mission consumption slice：讓 runtime 能把 approved mission 的 artifact set 讀成可驗證、可追溯的 execution input。
- 建立最小 mission-consumption contract，明確界定 implementation-spec / tasks / handoff 在 runtime 中各自提供什麼執行訊號。
- 規格化 fail-fast 行為：當 approved mission artifact 缺漏、不可讀、或與 session.mission 不一致時，runner 必須顯式停下並保留證據，而不是只靠舊 todos 繼續跑。
