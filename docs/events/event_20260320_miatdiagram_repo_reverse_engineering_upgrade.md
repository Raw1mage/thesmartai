# Event: Upgrade miatdiagram for repo reverse engineering

Date: 2026-03-20
Status: In Progress

## Requirement

使用 skill-finder 搜尋與「reverse engineering」「從 GitHub repo 拆解出架構圖」相關的 skills，並擴充 `miatdiagram` 成為可將現有 repo 逆向拆解為 IDEF0 / GRAFCET 的綜合技能。

## Scope

### In
- 盤點既有 `miatdiagram` skill 與相關歷史 event
- 搜尋外部可借鏡 skills / workflow patterns
- 設計並更新 `miatdiagram` runtime/template skill 內容
- 視需要補充 bundled references
- 記錄驗證與 architecture sync 結論

### Out
- 不直接產出特定 repo 的最終 diagram JSON
- 不新增自動 fallback workflow
- 不修改 drawmiat renderer 本體

## Task Checklist

- [x] 建立本次 event 檔
- [x] 盤點既有 miatdiagram skill / references / event
- [x] 搜尋外部 reverse-engineering / architecture-diagram skills
- [x] 設計 repo -> IDEF0/GRAFCET 綜合技能流程
- [x] 更新 runtime/template skill 與必要 references
- [x] 驗證變更並同步 architecture

## Debug Checkpoints

### Baseline
- 現況：`miatdiagram` 偏向「從需求文字生成 diagram JSON」，尚未明確覆蓋「從既有 repo 逆向拆圖」工作流。
- 風險：若直接擴寫 skill 而無外部 pattern 參考，可能導致工作流定義過度模糊。

### Instrumentation Plan
- 讀取 architecture 與既有 skill/event 作為 repo 內 SSOT。
- 搜尋 GitHub 上 `SKILL.md` 類 reverse engineering / repo analysis 能力。
- 比對後沉澱成可操作的 repo reverse-engineering contract。

### Execution
- 讀取 `specs/architecture.md` 與既有 `miatdiagram` 歷史 event，確認現況偏向 requirement-to-diagram workflow。
- 使用 skill-finder 的 GitHub 搜尋思路，嘗試以 `gh search code`、GitHub search 頁面關鍵字擴展搜尋 `reverse engineering` / `architecture diagram` / `repo analysis` + `SKILL.md`。
- 結果未找到可直接安裝的高品質命中，因此改採「借鏡 workflow pattern」方式：保留 skill-finder 搜尋紀錄，並將缺口內建到 `miatdiagram` 自身 contract。
- 擴寫 `templates/skills/miatdiagram/SKILL.md` 與本機 runtime `~/.config/opencode/skills/miatdiagram/SKILL.md`：加入 Repo Reverse Engineering Mode、evidence-first workflow、stop conditions、required outputs。
- 補充 `templates/skills/miatdiagram/references/repo_reverse_engineering_pipeline.md`。
- 更新 `templates/skills/miatdiagram/references/normalization_pipeline.md` 使其支援 requirement mode 與 repo mode。
- 補齊 repo runtime skill pack：同步寫入 `.opencode/skills/miatdiagram/**`，使 template / repo runtime / 本機 runtime 三處一致。

### Root Cause
- 根因不是 skill 寫錯，而是既有 `miatdiagram` scope 明確偏向「從需求正向分解」。
- 針對「從既有 repo 逆向抽取架構圖」的能力，原 skill 缺少三個核心 contract：
  1. repo-first evidence order
  2. codebase boundary / flow / lifecycle 萃取流程
  3. reverse-engineering 專屬輸出（source inventory / traceability / confidence）
- 外部可重用 SKILL.md 生態在此主題上命中很少，因此最穩定做法是把 reverse-engineering contract 內建為 `miatdiagram` 第二入口模式，而不是依賴外部 skill fallback。

### Validation
- 已讀回 template / repo runtime / 本機 runtime skill，確認三處都包含 `Repo Reverse Engineering Mode`。
- 已讀回新增 reference，確認 `repo_reverse_engineering_pipeline.md` 存在且被 skill index 引用。
- 已驗證 `.opencode/skills/miatdiagram/**` 已存在，repo 內發布鏈不再缺漏。
- GitHub 搜尋結果：未取得可直接採納之外部 SKILL.md 命中；此結論已反映於本 event。
- Architecture Sync: Verified (No doc changes)；依據：本次只擴充 skill contract 與 reference / skill pack，不改 repo runtime/module boundary。
