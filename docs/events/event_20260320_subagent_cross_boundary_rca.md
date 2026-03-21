# Event: Subagent Cross-Boundary Delegation RCA

**Date**: 2026-03-20
**Branch**: telemetry
**Scope**: subagent 無法跨 `opencode` / `opencode-beta` 聯合集合工作的根因追查

## Requirement

- 使用者要求追查：為什麼 subagent 無法從 `opencode` 主 session 委派到 `opencode-beta` 工作。
- 使用者明確指出：`opencode` 與 `opencode-beta` 雖然是不同資料夾，但屬於同一個 workspace 底下的聯合集合，不應被簡化成「不同 workspace」。

## Scope (IN / OUT)

### IN

- trace `task.ts`、`session/index.ts`、`project/instance.ts`、`cli/cmd/session.ts` 的實際 delegation / worker / instance 綁定路徑
- 釐清是 repo 規範、tool whitelist、還是 runtime instance boundary 導致 subagent 失敗
- 沉澱 root cause 與修正方向

### OUT

- 直接修改 subagent cross-boundary 行為
- 直接實作新的 workspace/delegation contract
- 對 telemetry slice 之外的執行器做大規模改動

## Baseline

- 從 `opencode` 主 session 呼叫 `task(subagent_type="coding")`，要求子代理操作 `/home/pkcs12/projects/opencode-beta`。
- subagent 回報：無法 inspect/edit 目標檔案，顯示 beta repo 路徑不在其可操作範圍內。
- 主代理本身可直接在 `/home/pkcs12/projects/opencode-beta` 工作，表示不是全域 filesystem denied。

## Instrumentation / Evidence Plan

- 讀 `packages/opencode/src/tool/task.ts`：看 subagent session 如何建立、worker 如何啟動。
- 讀 `packages/opencode/src/session/index.ts`：看 `Session.create()` / `createNext()` 如何綁定 directory/projectID。
- 讀 `packages/opencode/src/project/instance.ts`：看 path boundary 如何定義。
- 讀 `packages/opencode/src/cli/cmd/session.ts`：看 worker bootstrap 用哪個 cwd / instance。

## Execution Evidence

- 已讀：
  - `/home/pkcs12/projects/opencode-beta/packages/opencode/src/tool/task.ts`
  - `/home/pkcs12/projects/opencode-beta/packages/opencode/src/session/index.ts`
  - `/home/pkcs12/projects/opencode-beta/packages/opencode/src/project/instance.ts`
  - `/home/pkcs12/projects/opencode-beta/packages/opencode/src/cli/cmd/session.ts`

## Root Cause

### Direct cause

- subagent 不是依「workspace 聯合集合」建立執行上下文，而是依 **parent session 當下的 `Instance`** 派生 child session 與 worker。

### Causal chain

1. `task.ts` 中 `TaskTool.execute()` 建立 child session 時呼叫 `Session.create({ parentID, ... })`。
2. `session/index.ts` 中 `Session.create()` 會固定把 child session 建在 `Instance.directory`，進一步把 `projectID: Instance.project.id` 與 `directory: Instance.directory` 寫入 session。
3. `task.ts` 的 `spawnWorker()` 沒有指定 `cwd`，因此 worker process 繼承 parent process 的當前 cwd。
4. `cli/cmd/session.ts` 的 `SessionWorkerCommand` 再用 `bootstrap(process.cwd(), ...)` 建立 worker runtime，因此 worker 也落在 parent instance/project 上下文。
5. `project/instance.ts` 的 `Instance.containsPath()` 把邊界定義為 `Instance.directory` 或 `Instance.worktree` 內的路徑。
6. 因此即使 `opencode` 與 `opencode-beta` 在使用者語義上屬於同一 workspace 聯合集合，只要 `opencode-beta` 不在 parent `Instance.directory/worktree` 內，就會被當成 boundary 外。

### Why the earlier hypothesis was wrong

- 問題不是單純「不同 workspace」；真正問題是系統缺少 **同一 workspace 聯合集合下的跨 root delegation contract**。
- 現行 subagent model 只支援「parent instance boundary 內的 delegation」，不支援 sibling repo / sibling sandbox delegation。

## Key Findings

- 這不是 `coding` subagent tool whitelist 的問題；`task.ts` 已允許 `read/edit/write/apply_patch`。
- 這也不是主代理的 filesystem allowed dirs 問題；主代理可直接存取 beta repo。
- 核心缺口在於：subagent session metadata、worker bootstrap 與 tool boundary 全部綁在 parent `Instance` 上。

## Design Implication

- 系統目前缺少一個顯式 delegation scope 模型，例如：
  - current instance only
  - sibling sandbox in same workspace set
  - sibling repo in same workspace set
  - explicit external root
- 如果要讓 AI 能「跨越界線工作」，要修改的不只是 tool permission，而是 `Task -> Session -> Worker -> Instance` 這條 contract。

## Recommended Fix Direction

1. 在 `task` 層支援顯式 target directory / target workspace-set member。
2. child session 建立時不能永遠偷吃 parent `Instance.directory`；必須能綁定目標 root。
3. worker bootstrap 不能永遠只用 `process.cwd()`；要用 target session / target directory 建立 `Instance`。
4. `Instance.containsPath()` 需要從單一 root boundary 升級成可表示 workspace-set / sibling-root 的 delegation boundary。

## Validation

- RCA evidence traced to code: yes
- Main contributing files identified: yes
- Root cause isolated to runtime contract, not user prompt policy: yes
- Architecture Sync: Verified (No doc changes)
  - Basis: 這是針對執行器/委派邊界的 RCA event；尚未實作新 contract，因此先不改寫全域 architecture 文件。

## Next

- 若要落地修復，應新開一個 planning slice：`cross-boundary subagent delegation contract`
- 該 slice 需覆蓋 `task.ts`、`session/index.ts`、`cli/cmd/session.ts`、`project/instance.ts` 的 contract 變更
