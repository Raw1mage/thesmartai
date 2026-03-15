# Spec

## Purpose

- 定義 `autorunner` autonomous agent 完成路線的第一個可落地行為契約。
- 這個 change 的第一階段不是直接完成整個 daemon architecture，而是先建立足夠可靠的 runtime evidence substrate，讓後續 reducer / lease / worker supervisor 重構有可追溯基礎。

## Product Direction

- 目前存在一個待驗證方向：24x7 daemon architecture，讓 runner 可在背景持續推進 session work，不依附於單一 TUI / Web attach 狀態。
- 另一個待驗證方向是 TUI / WebApp 可自由 attach / detach，且前端關閉、刷新、斷線或弱網不應成為 session execution 停止的主因。
- 這些方向在可行性分析完成前，仍屬 hypothesis，不視為已定案需求。

## Requirements

### Requirement: Runner SHALL only execute approved OpenSpec-compiled plans

runner 的自主執行權來源，必須是已完成 OpenSpec artifact set 並經使用者批准的計畫文件，而不是模糊對話或未編譯草稿。

#### Scenario: runner starts work from a `/specs` development plan

- **GIVEN** 某個 session 對應的 `/specs` 開發計畫已具備完整 OpenSpec artifacts
- **AND** 該計畫已被使用者批准
- **WHEN** runner 進入自主執行
- **THEN** runner 只能依該計畫所編譯出的 scope / tasks / stop gates / validation contract 推進
- **AND** 不得把未批准的對話內容直接視為自主執行授權

### Requirement: Runner SHALL support delegated execution of approved spec work

runner 的第一個真實產品用例，應是把已批准的 `/specs` 開發計畫轉成委派式 execution contract，並調用適合的 agents 持續推進。

#### Scenario: approved spec drives coding/testing/docs delegation

- **GIVEN** runner 已載入某個已批准的 OpenSpec 開發計畫
- **WHEN** 計畫中的下一個步驟需要不同 execution role
- **THEN** runner 應能依計畫內容委派適當的 coding/testing/docs/review agents
- **AND** 後續進度、等待點、失敗訊號都應回流到同一個 session runner truth

### Requirement: Runtime SHALL record autonomous workflow anomalies as explicit journal events

系統必須能把 autonomous workflow 中的重要 mismatch 狀態記錄成結構化 runtime event，而不是只散落在 todo / session status / process supervisor 的各自表面。

#### Scenario: stale wait_subagent after subagent task error

- **GIVEN** parent session 的 linked todo 仍處於 `waitingOn=subagent` 或對應 workflow stop reason 仍是 `wait_subagent`
- **AND** delegated subagent 已出現 task error、timeout、或 worker/process truth 已不存在
- **WHEN** runtime 重新評估 autonomous continuation
- **THEN** 系統必須發出可持久化的 anomaly event
- **AND** 該 event 必須至少帶出 session / todo / worker-or-process 缺口的關聯資訊

### Requirement: Runtime SHALL expose a deterministic minimal event schema for the first substrate slice

第一個切片必須使用固定 schema 記錄 event，避免只是自由文字 log。

#### Scenario: journal records an anomaly event

- **GIVEN** runtime 偵測到 autonomous mismatch
- **WHEN** 寫入 journal
- **THEN** event 至少包含：
  - `ts`
  - `level`
  - `domain`
  - `eventType`
  - `sessionID`
  - `todoID?`
  - `payload`
  - `anomalyFlags[]`

### Requirement: Autonomous execution SHALL be architecturally separable from UI attachment lifecycle

若 daemon 方向被採納，系統長期架構才需要允許 runtime 在沒有活躍 TUI / Web attach 的情況下仍持續存在與推進；在可行性分析完成前，此條先視為候選 requirement。

#### Scenario: operator detaches while runner continues

- **GIVEN** autonomous session 正在背景執行
- **WHEN** TUI 或 WebApp detach、刷新、重新連線或短暫失去網路
- **THEN** runtime truth 仍應由 background runner / daemon substrate 保持
- **AND** operator 重新 attach 後可以透過 runtime-derived state 與 event evidence 觀測目前進度

### Requirement: The intermediate architecture SHOULD support multi-access attachment to the same runtime

若 multi-access server hypothesis 成立，則在完整 24x7 daemon 完成之前，系統的中期目標可考慮允許同一個 background runtime 同時被 TUI 與 Web access surface 存取，以驗證該模型。

#### Scenario: TUI and Web connect to the same runner-owned server substrate

- **GIVEN** background runner runtime 已啟動 server substrate
- **WHEN** operator 以 TUI attach，且另一個 operator 或同一 operator 以 Web access 連入
- **THEN** 兩者應觀測與控制同一份 session/runtime truth
- **AND** 不應因為使用不同 access surface 而各自生成彼此不一致的 execution state

### Requirement: First slice SHALL avoid introducing silent fallback behavior

本切片不得以 fallback 掩蓋 mismatch；遇到 state inconsistency 時必須保留證據並轉為顯式 anomaly / stop signal。

#### Scenario: mismatch is detected during autonomous continuation

- **GIVEN** runtime 發現 `wait_subagent` 不再有真實 process / worker 支撐
- **WHEN** autonomous continuation 做決策
- **THEN** 系統不得僅因舊 todo metadata 就靜默繼續視為正常等待
- **AND** 不得以 fallback 自動修補成其他無證據狀態

## Acceptance Checks

- 至少新增一組測試，驗證 stale `wait_subagent` mismatch 會產生 anomaly event。
- 至少新增一組測試，驗證最小 journal schema 會以結構化形式持久化事件。
- 至少新增一組測試或驗證，確認本切片未導入 silent fallback，而是保留 explicit anomaly evidence。
