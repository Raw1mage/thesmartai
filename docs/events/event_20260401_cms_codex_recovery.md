# Event: cms codex recovery

## 需求

- 追查 codex websocket / `LLM 狀態` `WS/HTTP` 顯示為何在目前 `cms` 消失。
- 判定 `cms` 是否發生 branch 偏移，並找回走歪前最新進度。
- 在不碰主工作樹未提交變更的前提下，建立 recovery branch 並開始救回最近 24 小時內值得保留的後續發展。

## 範圍

IN:

- `/home/pkcs12/projects/opencode/.git`
- `/home/pkcs12/projects/opencode/specs/architecture.md`
- `/home/pkcs12/projects/opencode/docs/events/`
- `cms` / `recovery/*` / `backup/*` branches
- `/home/pkcs12/projects/opencode-recovery-20260401-183212`

OUT:

- 不直接重寫 `cms` branch ref
- 不對主工作樹做 `reset` / `stash`
- 不一次性把目前 `cms` 整條 merge 回 recovery

## 任務清單

- [x] 追查 `WS/HTTP transport label` 是否曾存在於 `cms`
- [x] 確認 `cms` 是否被 branch-pointer 操作拉離舊 codex 線
- [x] 找出走歪前最新合理 recovery 基準點
- [x] 建立 backup / recovery branches
- [x] 建立獨立 recovery worktree
- [x] 救回低風險最近 24 小時後續提交
- [ ] 決定如何處理主工作樹未提交的 `claude-cli anthropic audit` 修補

## Debug Checkpoints

### Baseline

- 使用者觀察到 codex websocket status 判斷欄位曾顯示 `WS` 狀態，但目前 `LLM 狀態` 只剩 `OK`。
- 初步懷疑是近期 codex websocket 相關功能在測試／merge 後又被回退。

### Instrumentation Plan

- 用 `git log -S/-G`、`git branch --contains`、`git reflog show cms` 重建時間線。
- 對照目前 Web/TUI 狀態欄位來源，區分是「明確 revert」還是「branch 偏移導致目前主線看不到」。
- 在不碰髒工作樹的前提下，先保全 branch refs，再用獨立 worktree 做 recovery。

### Execution

- 確認 `c08b509b3`（`fix(codex): prevent cascade account burn + rotation-aware auth + WS/HTTP transport label`）曾直接出現在 `cms` reflog：
  - `cms@{2026-03-30 11:43:04 +0800}`
- 確認 `cms` 在 `2026-04-01 15:18:31 +0800` 出現：
  - `reset: moving to beta/llm-packet-debug`
- 判定這不是單純 merge 後被 revert，而是 `cms` branch pointer 被拉到另一條歷史，讓舊 codex 線脫離目前主線視角。
- 以 `081595aa1` 作為走歪前較新的 recovery 基準點。
- 建立 branch refs：
  - `backup/cms-current-20260401-183212` -> `33700417d`
  - `recovery/cms-codex-20260401-183212` -> `081595aa1`
- 確認主工作樹不乾淨，因此不在主工作樹執行 recovery：
  - modified: `packages/app/src/context/models.tsx`
  - untracked: `docs/events/event_20260401_claude_cli_anthropic_audit.md`
  - untracked: `packages/app/src/context/model-preferences.test.ts`
  - untracked: `packages/app/src/context/model-preferences.ts`
- 建立獨立 recovery worktree：
  - `/home/pkcs12/projects/opencode-recovery-20260401-183212`
- 已救回最近 24 小時內的低風險後續提交：
  - `e875eacfa` from `4b7afb699` `fix(webapp): stop anthropic blacklist from disabling claude-cli`
  - `cdcd0f823` `recovery(debug): manually integrate llm packet checkpoints`
- `f3d1a00f2` 不能直接 cherry-pick，因為在 `packages/opencode/src/session/llm.ts` 與 recovery 線演進衝突；已改用手動整合，只保留低風險 observability checkpoints。
- 後續盤點確認：`recovery` 已天然包含走歪前的 auth/provider、codex-ws、efficiency/compaction 主體；走歪後真正有價值的新功能性變更僅上述兩項，剩餘差集主要是 templates/refs/submodule 類後勤提交。
- 使用者要求新增硬規則：`beta/*` 與 `test/*` 分支在測試完成且 merge/fetch-back 回主線後必須立即刪除，不得長留。

### Root Cause

- 根因不是 `c08b509b3` 後續被單一 revert commit 回退。
- 根因是 `cms` 在 `2026-04-01 15:18:31 +0800` 被 `reset` 到 `beta/llm-packet-debug`，導致舊 codex/cms 線上的 61 個 commits 不再位於目前 `cms` 祖先鏈上。
- 使用者體感上的「測完 merge 回 cms 卻又不見」是因為該功能一度真的進過 `cms`，但之後 `cms` 指標被拉走。
- 促成事故的流程缺口之一，是 stale `beta/test` 分支在 merge-back 後仍然存活，後續 branch-pointer 操作有機會把 `cms` 誤拉回舊 execution surface。

### Validation

- reflog 證據：
  - `cms@{2026-03-30 11:43:04 +0800}: commit: fix(codex): prevent cascade account burn + rotation-aware auth + WS/HTTP transport label`
  - `cms@{2026-04-01 15:18:31 +0800}: reset: moving to beta/llm-packet-debug`
- branch / ancestry 證據：
  - `backup/cms-current-20260401-183212` -> `33700417d`
  - `recovery/cms-codex-20260401-183212` -> `081595aa1`
- recovery worktree 證據：
  - `/home/pkcs12/projects/opencode-recovery-20260401-183212`
  - recovery HEAD: `cdcd0f823`
- 救回提交驗證：
  - `git diff --check` on recovery worktree ✅
  - `git log -2` on recovery worktree:
    - `cdcd0f823 recovery(debug): manually integrate llm packet checkpoints`
    - `e875eacfa fix(webapp): stop anthropic blacklist from disabling claude-cli`
- 流程修補：
  - 已同步更新 repo/template beta workflow 規範，新增 `beta/*` / `test/*` merge-back 後必刪的 branch lifecycle rule。

## 結論

- 判定：`cms` 確實發生 branch 偏移；不是整個 codex branch 遺失，而是 `cms` branch ref 被拉到另一條歷史。
- 走歪前最新合理基準已保全並開出 recovery branch。
- recovery 線已先救回兩項最近 24 小時內的低風險後續發展：
  - claude-cli webapp blacklist 修補
  - llm packet debug checkpoints（手動整合版）
- 其餘 codex runtime / efficiency / prompt / compaction 大功能群經盤點後已確認屬於 recovery 祖先主體，不是當前缺口。
- 新的流程硬規則已確立：`beta/*`、`test/*` 分支一律在測試完成且 merge/fetch-back 回主線後立即刪除。

## 2026-04-01 Recovery 主工作樹切換與 runtime/config 修補續記

### 需求

- 將主工作樹切回 `recovery/cms-codex-20260401-183212` 作為新的實際工作面。
- 確認 `node` 無法執行是否為 shell 載入問題。
- 在不再擴大測試導向修補的前提下，保留有產品/runtime 價值的修復，並同步文件。

### 範圍

IN:

- `/home/pkcs12/projects/opencode`
- `recovery/cms-codex-20260401-183212`
- `packages/opencode/src/config/config.ts`
- `packages/opencode/src/project/instance.ts`
- `packages/opencode/src/bus/index.ts`
- `packages/opencode/src/server/killswitch/service.ts`
- `packages/opencode/src/mcp/apps/gauth.ts`
- `packages/opencode/src/server/routes/mcp.ts`
- `scripts/test-with-baseline.ts`

OUT:

- 不繼續擴大 `workflow-runner` / `planner-reactivation` / Smart Runner / route auth 等測試導向行為修補
- 不以 full-suite 全綠作為本輪收尾門檻

### 任務清單

- [x] 確認主工作樹切到 `recovery/cms-codex-20260401-183212`
- [x] 追查 `node` 執行失敗的環境根因
- [x] 在 login shell 下重跑並通過全 repo `typecheck`
- [x] 驗證 web runtime health
- [x] 修正 root test wrapper 的 repo root 計算
- [x] 修正 config migration / nested non-git config merge 邊界
- [x] 補強 `Instance.project` / Bus context fallback 韌性
- [x] 修正 managed app auth / error data contract 取值
- [x] 盤點目前變更並停止擴大測試導向修補
- [x] 同步 event / architecture 文件

### Debug Checkpoints

#### Environment

- non-login / non-interactive shell 下 `node` 不在 PATH。
- 根因是 `~/.bashrc` 以非互動 shell guard 提前 `return`，而 `nvm` 初始化在 guard 後方。
- `bash -lc` 可透過 `~/.profile` 載入 `nvm`，恢復 `node`：
  - `/home/pkcs12/.nvm/versions/node/v20.19.6/bin/node`

#### Execution

- 主工作樹已確認切到 `recovery/cms-codex-20260401-183212`。
- 全 repo `bun turbo typecheck` 已通過。
- `webctl.sh status` 顯示 gateway / daemon / health 正常。
- `scripts/test-with-baseline.ts` 的 repo root 從 `../..` 修正為 `..`，root test 入口不再因錯誤 cwd 失敗。
- `packages/opencode/src/config/config.ts` 已保留的產品向修補：
  - 恢復 `autoshare: true` → `share: "auto"` 相容遷移
  - 修正 non-git nested project 可向上合併父層 config 的搜尋邊界
- `packages/opencode/src/project/instance.ts` / `packages/opencode/src/bus/index.ts` 已補強缺值 fallback，避免 runtime context 缺值直接崩潰。
- `packages/opencode/src/server/killswitch/service.ts` 已把 seq 追蹤收斂到 `requestID + sessionID`。
- `packages/opencode/src/mcp/apps/gauth.ts` / `packages/opencode/src/server/routes/mcp.ts` 已對齊現行 managed app error contract。

#### Decision

- 使用者明確要求：延緩所有跟測試有關的程式修復。
- 因此本輪收尾只保留 branch/runtime/config/runtime-safety 類修補，不再延伸處理 workflow/planner/Smart Runner/route auth 等測試導向行為回歸。

### Validation

- Branch:
  - `git branch --show-current` -> `recovery/cms-codex-20260401-183212`
- Environment:
  - `bash -lc 'command -v node && node -v'` -> `v20.19.6`
- Typecheck:
  - `bash -lc 'cd /home/pkcs12/projects/opencode && bun turbo typecheck'` ✅
- Web runtime:
  - `bash -lc '"/home/pkcs12/projects/opencode/webctl.sh" status'` -> healthy ✅
- Config focused validation:
  - `bun test ./packages/opencode/test/config/config.test.ts` -> `60 pass, 0 fail`
- Architecture Sync:
  - Updated: `specs/architecture.md` 已補入 config resolution 與 runtime state initialization safety 的長期規則。

## Architecture Sync

- Updated: `specs/architecture.md` 已補入 beta/test disposable branch lifecycle 規則，明確禁止 merge-back 後長留 stale execution branches。
