# Spec

## Purpose

- 降低長 session 中因 compaction 引起的 LLM cache invalidation，減少 token 浪費

## Requirements

### Requirement: Compaction 觸發閾值提高（方案 A）

系統 SHALL 在 context 使用率更高時才觸發 compaction，以延長每個 compaction cycle 的有效工作 rounds。

#### Scenario: gpt-5.4 (272k context) 正常對話

- **GIVEN** 模型 context limit 為 272,000 tokens，reserved 為 20,000
- **WHEN** observed tokens 達到 252,000（當前閾值）
- **THEN** 系統不應立即觸發 compaction；應等到更高比例（如 context limit - 8,000）才觸發

#### Scenario: 小 context 模型安全

- **GIVEN** 模型 context limit 為 32,000 tokens
- **WHEN** 使用新閾值
- **THEN** 仍應保留足夠 buffer 避免 context overflow error

### Requirement: Compaction 冷卻期（方案 B）

系統 SHALL 在 compaction 完成後強制等待最小 round 數，才允許再次觸發 compaction。

#### Scenario: compaction 後立即接近閾值

- **GIVEN** compaction 剛完成，roundsSinceLastCompaction = 0
- **WHEN** context 再次接近 overflow 閾值
- **THEN** 系統不觸發 compaction，繼續正常處理（即使 overflow 為 true）
- **AND** 直到 roundsSinceLastCompaction >= MIN_ROUNDS_BETWEEN_COMPACTION 才允許下次 compaction

#### Scenario: 冷卻期到期

- **GIVEN** roundsSinceLastCompaction >= MIN_ROUNDS_BETWEEN_COMPACTION
- **WHEN** context 超過 overflow 閾值
- **THEN** 正常觸發 compaction

### Requirement: Prefix-preserving compaction（方案 C）

系統 SHALL 在 compaction 時保留 system prompt prefix 和最近 N 個 messages，只壓縮中間部分。

#### Scenario: compaction 後的第一個 round

- **GIVEN** compaction 剛完成，採用 prefix-preserving 策略
- **WHEN** 下一個 round 發送 prompt 到 LLM
- **THEN** system prompt 部分與 compaction 前相同（cache prefix 保留）
- **AND** cacheReadTokens > 0（至少 system prompt 部分命中 cache）

#### Scenario: summary message 位置

- **GIVEN** compaction 觸發
- **WHEN** 生成 summary
- **THEN** summary 插在 system prompt 之後、最近 N messages 之前
- **AND** 最近 N 個 user/assistant messages 保留原樣

### Requirement: System prompt 去冗餘（方案 D）

系統 SHALL 減少 Global AGENTS.md、Project AGENTS.md、SYSTEM.md 之間的重複指令。

#### Scenario: 去冗餘後的 token 計數

- **GIVEN** 精簡後的 AGENTS.md 和 SYSTEM.md
- **WHEN** 計算 dynamic_system + core_system_prompt 的 token 數
- **THEN** 合計應 < 5,500 tokens（從 ~7,720 降低 ~30%）

#### Scenario: 指令完整性

- **GIVEN** 精簡後的文件
- **WHEN** 比對精簡前的有效指令集
- **THEN** 所有有效指令都保留在某一層（Global/Project/SYSTEM.md）中，無遺漏

## Acceptance Checks

- 同一個 130-round session 場景下，compaction 次數從 229 降到 < 50
- Cache-miss rounds 從 14 降到 < 5
- Cache-miss input tokens 佔比從 61.7% 降到 < 20%
- System prompt total tokens 從 ~7,720 降到 < 5,500
- 無 context overflow error
- 精簡後的 AGENTS.md 指令無遺漏（逐條比對）
