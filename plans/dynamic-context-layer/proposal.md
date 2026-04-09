# Proposal

## Why

- Skill prompt 載入後無法卸載，佔 context token 直到 compaction
- Lazy tool catalog 有自己一套 active/inactive 邏輯，跟 skill 管理完全脫鉤
- Instruction prompts、environment prompts 永遠在，即使當回合不需要
- 四套機制各自為政，沒有統一的生命週期管理

## Original Requirement Wording (Baseline)

- "現在，創一個plan，來討論\"unload idle context\"的議題。問題：很多toolcall、skill載入context後用完了，就一直留在context裏一直陪著對話到最後，很浪費token。所以我們想到在prompt injection其實是每次對話都重組，而且是多層組合。那我們可以在prompt injection的地方多一個skill layer，並管理其內容的生命週期。"

## Effective Requirement Description

1. 統一 system prompt 中所有可選內容為同一套 dynamic context layer 機制
2. 每回合組裝 system prompt 時，根據各 layer 的 active/inactive 狀態決定是否注入
3. 設計 unload policy——誰決定、什麼時候、unload 後留什麼
4. 先以 `skill layer` 為第一個受管層，避免直接一次改寫所有 prompt blocks
5. unload 的目標是減少持續性 token 負擔，不是讓 agent 失去必要的安全/流程約束
6. unload 只應預設作用在 token-based 計費 provider；by-request provider 應預設保守

## Scope

### IN

- System prompt 動態組裝管線重構
- Skill prompt 生命週期（load / unload）
- Lazy tool catalog 納入統一管理
- Unload policy 設計
- Skill layer 的 session/runtime metadata 設計（active、idle、sticky、summary、lastUsedAt）
- Prompt injection 組裝責任切分（always-on vs managed layers）
- Provider pricing mode gating（token-based vs by-request）

### OUT

- Message history 的 compaction 機制（已有，不碰）
- 新 skill 開發
- Provider 層的 API 呼叫方式
- 一次把所有 tool output / event log / shared context 都改成新記憶體系統
- 未經驗證就把 core system / safety boundary 做成可卸載層

## Constraints

- 必須向後相容現有 skill 載入行為
- 不能影響 prompt caching 效率（stable prefix 原則）
- Unload 後 AI 不應失憶——需保留摘要或 metadata
- 禁止新增 silent fallback：若 layer state 無法解析，必須 fail fast 或明確降級記錄
- 需尊重現有 per-round prompt rebuild 事實，不假設 in-flight hot swap
- by-request provider 若缺乏成本證據，不應啟用積極 unload

## What Changes

- `prompt.ts` 中的 system 陣列組裝邏輯
- Skill 載入機制（從 message 注入改為 system layer 注入）
- Lazy tool catalog 整合進同一套 layer API
- 新增 managed context layer registry / assembler / lifecycle policy surfaces
- 將 unload 決策從「append-only message 歷史」轉為「下一輪組裝是否再注入」

## Capabilities

### New Capabilities

- Skill unload：用完的 skill 可以從下一輪 system prompt 中移除
- Unified layer API：activate / deactivate / promote / demote
- Unload policy：程式化或使用者觸發的卸載決策
- Layer summary residue：被 unload 的 skill 保留最小可追溯摘要而不是整塊 prompt 常駐
- Layer telemetry：可觀測每輪注入哪些 layer、哪些被跳過、token 佔比多少
- Provider-aware unload gate：依計費模式決定是否值得啟動 unload

### Modified Capabilities

- Skill 載入：從 append-only message 改為 dynamic system layer
- Lazy tool catalog：從獨立邏輯改為 layer 管理的一個 instance
- Prompt assembly：從固定串接 system parts 擴展為「固定核心 + managed layers + policy-driven residue」
- Unload decision：從靜態閾值改為 AI/runtime 聯合判斷，並受 provider pricing gate 約束

## Impact

- `packages/opencode/src/session/llm.ts` — system part assembly 與 prompt telemetry
- `packages/opencode/src/session/prompt.ts` — per-round orchestration / message preparation
- `packages/opencode/src/session/resolve-tools.ts` — lazy tool catalog 與 on-demand lifecycle 參考實作
- `packages/opencode/src/tool/skill.ts` — skill load output 與 metadata 接線
- `packages/opencode/src/session/system.ts` — always-on core prompt boundary
- `docs/events/event_20260409_unload_idle_context_planning.md`
