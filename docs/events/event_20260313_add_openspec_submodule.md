## Requirements

- 使用者要求新增 `openspec` submodule。
- 上游來源指定為 `https://github.com/Fission-AI/OpenSpec`。

## Scope

### In

- `.gitmodules`
- `refs/openspec` submodule 掛載
- event ledger / validation

### Out

- submodule 內容修改
- 其他 refs 更新或同步
- commit / push

## Task List

- [x] 確認既有 refs submodule 納管位置
- [x] 建立本次 event 檔
- [x] 新增 `refs/openspec` git submodule
- [x] 驗證 repo 狀態並補完 event validation

## Baseline

- 既有外部 plugin / 參考 repo 以 git submodule 形式集中於 `refs/`。
- `.gitmodules` 目前已納管多個 `refs/*` submodule，尚未包含 `refs/openspec`。

## Changes

- `.gitmodules`
  - 新增 `refs/openspec` submodule 項目
- `refs/openspec`
  - 掛載 `https://github.com/Fission-AI/OpenSpec` 作為 git submodule

## Decisions

1. 依現有 repo 慣例，新的外部參考 repo 掛載於 `refs/openspec`。
2. 本次僅新增 submodule 指標，不對 OpenSpec 內容做額外改動。

## Validation

- `git submodule add -f https://github.com/Fission-AI/OpenSpec refs/openspec` 成功完成。✅
- `.gitmodules` 已出現 `refs/openspec` 對應 path/url。✅
- `git submodule status -- refs/openspec` 顯示目前鎖定 commit `afdca0d5dab1aa109cfd8848b2512333ccad60c3`。✅
- `git status --short` 顯示本次相關變更為 `.gitmodules` 與 `refs/openspec`；另有既存未關聯變更 `packages/ui/src/hooks/create-auto-scroll.tsx`。✅
- Architecture Sync: Verified (No doc changes)；本次僅新增外部參考 submodule，未改變 runtime 模組邊界或資料流。✅

## Next

- 若後續要引用 OpenSpec 內容，另開 task 分析其結構與同步策略。
