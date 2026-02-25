# Event: origin/dev 新增功能行為盤點（排除 skipped / 忽略 bug 微調）

Date: 2026-02-25
Status: Done

## 1. Scope

- Source range: `aaf8317c8..origin/dev`
- Baseline rule:
  - 排除已 `skipped` commits
  - 只盤點「新增功能行為」類型
  - 不納入 bugfix / test / chore / ci / docs 微調類提交

## 2. Count Summary

- Total new commits in range: `75`
- Skipped commits: `11`
- Non-skipped pool: `64`
- Feature-behavior candidates identified: `9`

## 3. Feature-behavior Candidates

1. `fc6e7934b` feat(desktop): enhance Windows app resolution and UI loading states (#13320)
2. `5712cff5c` zen: track session in usage
3. `5596775c3` zen: display session in usage
4. `284251ad6` zen: display BYOK cost
5. `519058963` zen: remove alpha models from models endpoint
6. `f8cfb697b` zen: restrict alpha models to admin workspaces
7. `6fc550629` zen: go
8. `d7500b25b` zen: go
9. `a4ed020a9` upgrade opentui to v0.1.81 (#14605)

## 4. Import Recommendation (cms)

### P1 (recommended now)

1. `fc6e7934b`
   - Reason: 明確是可感知的桌面端行為提升（Windows 啟動解析 + 載入狀態 UX），對 cms 用戶價值直接。

### P2 (conditional, if cms follows zen/console governance)

1. `519058963`
2. `f8cfb697b`
   - Reason: 兩者屬於模型可見性/權限治理策略（alpha 模型限制），是產品策略層行為，不是純微調。

### P3 (defer)

1. `5712cff5c`
2. `5596775c3`
3. `284251ad6`
4. `6fc550629`
5. `d7500b25b`
6. `a4ed020a9`
   - Reason: 偏 console/zen 計費與呈現線路，或偏依賴升級，不是當前 cms 核心 runtime 必要行為。

## 5. Notes

- 此盤點故意不覆蓋 bugfix 類提交（例如 path/Windows 修復、test hardening、auth deadlock fix），以符合本輪「只看新功能行為」目標。
- 本輪僅做 inventory 與導入建議，未自動批次移植上述 feature commits。
