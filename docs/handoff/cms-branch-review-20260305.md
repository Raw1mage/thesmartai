# CMS Branch Review (2026-03-05)

## Review Scope

- Target: `opencode` 現行工作樹（目前 branch: `work`）中可觀測的 `cms` 架構實作狀態。
- Method: 架構文件比對 + 程式抽樣靜態審查 + 可用測試嘗試。

## Executive Summary

- `cms` 核心特徵（provider 細分、family canonical resolution、rotation3d、admin control plane）在程式中可被觀測到，與 Architecture 文件主敘述一致。
- 本次未發現「直接違反 cms 架構主軸」的明顯阻斷問題。
- 但驗證深度受限於依賴安裝失敗（npm registry 403）；因此動態回歸測試尚未完成，結論屬 **有條件通過（Conditional Pass）**。

## Evidence Collected

1. **Branch / history snapshot**
   - `git rev-parse --abbrev-ref HEAD` → `work`
   - `git log --oneline -n 8` 顯示近期提交集中於 web auth/runtime 與文件整理。

2. **Architecture alignment (docs)**
   - `docs/ARCHITECTURE.md` 明確將 `cms` 定義為主產品線，包含 provider 拆分、rotation3d、`/admin` 控制平面與 family canonical resolver。

3. **Code-level spot checks (static)**
   - `packages/opencode/src/session/llm.ts`、`processor.ts`、`image-router.ts`：可見 `rotation3d` 與 `Account.resolveFamily` 參與 fallback / routing 決策。
   - `packages/opencode/src/auth/index.ts`：多處採 `Account.resolveFamilyOrSelf` 作 family 解析，與文件中的 canonical resolver 方向一致。
   - `packages/opencode/src/account/index.ts`：存在 `google-api`、`antigravity`、`gemini-cli` family 常數與解析/遷移相關邏輯，反映 provider 細分設計。

## Validation Attempt

- Executed:
  - `bun test packages/opencode/test/auth/family-resolution.test.ts packages/opencode/test/account/family-normalization.test.ts packages/opencode/test/provider/provider-cms.test.ts`
- Result:
  - 失敗，主因為本地缺依賴（`zod`, `xdg-basedir` 未安裝）。
- Recovery attempted:
  - `bun install`
- Recovery result:
  - 失敗，npm registry 多個套件回應 403，導致無法完成依賴解析。

## Risk Assessment

- **R1 — Validation coverage risk (Medium)**
  - 目前結論主要依賴靜態檢視；關鍵 regression tests 未跑通。
- **R2 — Environment dependency risk (Medium)**
  - CI/本地若同樣受 registry 存取限制，會阻斷常規品質閘門。

## Recommendations

1. 在具備可用 npm registry mirror/token 的環境重跑以下測試（優先）：
   - `provider-cms.test.ts`
   - `family-resolution.test.ts`
   - `family-normalization.test.ts`
2. 將本次審查視為 pre-check，待動態測試綠燈後再升級為 fully passed。
3. 若 403 為長期限制，建議新增內網 mirror 或 lockfile + cache pipeline，降低驗證不可用風險。

## Review Verdict

- **Conditional Pass**
  - Architecture alignment: Pass
  - Static code consistency: Pass
  - Dynamic regression validation: Blocked by environment (registry 403)
