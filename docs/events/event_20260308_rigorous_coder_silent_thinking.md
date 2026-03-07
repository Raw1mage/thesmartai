# Event: Rigorous Coder Silent Thinking

Date: 2026-03-08
Status: Done

## 1. 需求

- 改善 `rigorous-coder` / `code-thinker` skill 的使用者體驗。
- 保留嚴謹檢查與雙階段操作精神，但不要再要求對使用者輸出固定的 `<thinking>...</thinking>` 鏈。
- 同步更新 runtime 與 template skill，避免 release 漂移。
- 檢查上游 prompt stack（drivers / SYSTEM.md / AGENTS.md）是否與 skill 衝突，必要時一併修正。

## 2. 範圍

### IN

- `/home/pkcs12/.config/opencode/skills/rigorous-coder/SKILL.md`（rename to `code-thinker`）
- `/home/pkcs12/.config/opencode/skills/code-thinker/SKILL.md`
- `/home/pkcs12/.config/opencode/AGENTS.md`
- `/home/pkcs12/projects/opencode/templates/skills/rigorous-coder/SKILL.md`（rename to `code-thinker`）
- `/home/pkcs12/projects/opencode/templates/skills/code-thinker/SKILL.md`
- `/home/pkcs12/projects/opencode/templates/AGENTS.md`
- `/home/pkcs12/projects/opencode/templates/prompts/SYSTEM.md`
- `/home/pkcs12/projects/opencode/packages/opencode/src/session/prompt/beast.txt`
- `/home/pkcs12/projects/opencode/packages/opencode/src/session/prompt/copilot-gpt-5.txt`

### OUT

- 其他 skill 規則
- tool routing 行為
- 不相關 runtime 模組

## 3. 任務清單

- [x] 盤點 runtime/template skill 現況
- [x] 建立 event 與 checkpoints
- [x] 更新 skill 使推理過程改為靜默內部檢查
- [x] 將 skill rename 為 `code-thinker` 並同步更新引用
- [x] 盤點上游 prompt stack 衝突點
- [x] 修正 AGENTS / SYSTEM / driver 對 `<thinking>` 的外顯暗示
- [x] 驗證 runtime/template 一致性與 architecture sync

## 4. Debug Checkpoints

### Baseline

- 現況：`rigorous-coder` 明確要求在任何變更前，對使用者輸出固定 `<thinking>...</thinking>` 文字區塊。
- 問題：這段內容大多是固定檢查清單，重複展示給使用者的資訊密度低、可讀性差。
- 進一步盤點後發現：`AGENTS.md` 仍把 `rigorous-coder` 描述成依賴 `<thinking>` 標籤；部分 driver 也鼓勵顯式 step-by-step thinking，但未限制對外可見性。
- 命名面也有問題：`rigorous-coder` 雖準確，但品牌感與可記憶性較弱，因此本次一併 rename 為 `code-thinker`。

### Execution

- 改為要求模型在內部完成同一套 SSOT / Blast Radius / Anti-Hallucination / Validation 檢查。
- 對外只需在必要時輸出精簡的「偵查結論 / 修改提案 / 驗證計畫」，不再暴露固定 `<thinking>` 模板。
- 補上更硬的對外輸出契約：禁止輸出 `<thinking>`、raw chain-of-thought、逐條內部審查紀錄。
- 依 `skill-creator` 思路重寫 frontmatter `description`，讓新名稱 `code-thinker` 仍清楚傳達「靜默內部審查 + 複雜改動」的觸發條件。
- 同步修正 `AGENTS.md` 與 `templates/AGENTS.md` 的 skill 導航文案，改為「靜默內部審查」。
- 在 `templates/prompts/SYSTEM.md` 與相關 driver 補入 reasoning visibility guardrail，避免上游 prompt 再度鼓勵外顯推理。

### Validation

- `diff -u /home/pkcs12/.config/opencode/skills/code-thinker/SKILL.md /home/pkcs12/projects/opencode/templates/skills/code-thinker/SKILL.md` ✅ 無差異
- 驗證重點：固定 `<thinking>...</thinking>` 對外輸出要求已改為「內部檢查、對外精簡摘要」，且上游 prompt stack 不再把 `<thinking>` 視為 `rigorous-coder` 的對外介面。
- 驗證重點：`AGENTS.md` 與 template 已改指向 `skill(name="code-thinker")`，新 skill 名稱與 description 已同步。
- 驗證重點：`templates/prompts/SYSTEM.md`、`packages/opencode/src/session/prompt/beast.txt`、`packages/opencode/src/session/prompt/copilot-gpt-5.txt` 已補上 internal reasoning 不得外顯的 guardrail。
- Architecture Sync: Verified (No doc changes)
  - 依據：本次僅調整 prompt/skill 行為契約與輸出規範，不影響系統架構、模組邊界與 runtime topology。
