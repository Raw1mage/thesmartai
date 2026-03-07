# Event: read-mode rollout

Date: 2026-03-07
Status: Cancelled

## 需求

- 原先嘗試將 `read-mode` 作為 cms 主線立即可用的 skill 與互動規範
- 後續決定撤回 cms branch 的 `read-mode` 導入
- 原因：目前互動節奏需求與 mobile/web 閱讀行為問題混雜，尚不適合作為 repo 預設規範

## 範圍

### IN

- `AGENTS.md`
- `templates/AGENTS.md`
- `.opencode/skills/read-mode/SKILL.md`
- `templates/skills/read-mode/SKILL.md`
- `packages/opencode/src/session/prompt/enablement.json`
- `templates/prompts/enablement.json`

### OUT

- 不修改核心 prompt runtime 程式碼
- 不修改 question tool schema
- 不強制所有回答都使用 read-mode

## 任務清單

- [x] 建立 read-mode rollout event
- [x] 定義主動觸發條件與排除條件（已撤回）
- [x] 新增 runtime/template skill（已撤回）
- [x] 更新 AGENTS / templates/AGENTS 使用規範（已撤回）
- [x] 更新 enablement registry（已撤回）
- [x] 記錄 cms branch 撤回決策

## Debug Checkpoints

### Baseline

- 目前專案沒有 repo 交付層級的 `read-mode` skill。
- 長篇說明性回覆容易一次輸出多頁文字，不利人類依閱讀速度逐段吸收。
- 需求重點是讓 agent 在「解釋型回答」場景主動切成分段互動模式，而非縮短所有回答。

### Execution

- Initial rollout was completed, but later user feedback showed the policy was not suitable as a repo-default cms behavior.
- The concrete issues mixed two different concerns:
  - explanatory text pacing
  - mobile/web reading behavior and bottom-stick UX
- Decision: remove `read-mode` from cms branch entirely and revisit later only if reintroduced as a better-scoped skill/policy.

### Validation

- `bun -e 'JSON.parse(...)'` 驗證 rollback 後的 `packages/opencode/src/session/prompt/enablement.json` 與 `templates/prompts/enablement.json` 均為有效 JSON。
- `templates/skills/read-mode/SKILL.md` 已自 repo 移除；cms branch 不再交付 `read-mode`。
- Architecture Sync: Verified (No doc changes)
  - 依據：本輪為技能/規範 rollback，不涉及 runtime architecture 邊界變更。
