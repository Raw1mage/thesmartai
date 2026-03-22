# Spec

## Purpose

確保 Account module 的資料完整性、accountId 人類可讀，並建立部署驗證閘門。Event bus consumer 延後到 daemon 重構。

## Requirements

### Requirement: Read-Path Immutability (R1)

Account module 的 read-path functions SHALL 回傳 structuredClone，caller 無法透過修改回傳值影響 in-memory cache。

#### Scenario: Caller mutates returned account list

- **GIVEN** Account.list("openai") 回傳 `{ "acct-1": { name: "work", ... } }`
- **WHEN** caller 執行 `result["acct-1"].name = "hacked"`
- **THEN** 後續 Account.list("openai") 仍回傳 `{ name: "work" }`（cache 未被汙染）

#### Scenario: Caller mutates returned provider map

- **GIVEN** Account.listAll() 回傳包含 "openai" provider 的 map
- **WHEN** caller 執行 `delete result["openai"]`
- **THEN** 後續 Account.listAll() 仍包含 "openai" provider

#### Scenario: Caller mutates returned single account

- **GIVEN** Account.get("openai", "work") 回傳 `{ name: "work", apiKey: "sk-..." }`
- **WHEN** caller 執行 `result.apiKey = "tampered"`
- **THEN** 後續 Account.get("openai", "work") 仍回傳原始 apiKey

### Requirement: Remove Fail-Fast (R2)

Account.remove() SHALL 在目標帳號不存在時 throw AccountRemoveError。

#### Scenario: Remove non-existent account

- **GIVEN** provider "openai" 下無 accountId "ghost"
- **WHEN** 呼叫 Account.remove("openai", "ghost")
- **THEN** throw AccountRemoveError（message 包含 providerKey 和 accountId）

### Requirement: Active Removal No Fallback (R3)

Account.remove() 刪除 active account 後 SHALL 設 activeAccount = undefined。

#### Scenario: Remove active account with remaining accounts

- **GIVEN** provider "openai" 下有帳號 A（active）和帳號 B
- **WHEN** 呼叫 Account.remove("openai", "A")
- **THEN** activeAccount === undefined（不自動 fallback 到 B）

#### Scenario: Remove last account

- **GIVEN** provider "openai" 下只有帳號 A（active）
- **WHEN** 呼叫 Account.remove("openai", "A")
- **THEN** activeAccount === undefined，accounts 為空

### Requirement: Human-Readable accountId (R4)

新建帳號的 accountId SHALL 等於 normalizeAccountName(使用者輸入的名稱)。

#### Scenario: New API key account

- **GIVEN** 使用者輸入帳號名稱 "My Work Key"
- **WHEN** AccountManager.connectApiKey("openai", "My Work Key", "sk-...")
- **THEN** accountId === "my-work-key"

#### Scenario: Name with special characters

- **GIVEN** 使用者輸入帳號名稱 "Test@Account #1!"
- **WHEN** 正規化處理
- **THEN** accountId === "test-account-1"

#### Scenario: Empty name

- **GIVEN** 使用者輸入空名稱 ""
- **WHEN** 正規化處理
- **THEN** accountId === "default"

### Requirement: accountId Collision Handling (R5)

同 provider 下 accountId 衝突時 SHALL 自動加 suffix。

#### Scenario: Duplicate name under same provider

- **GIVEN** provider "openai" 下已有 accountId "work"
- **WHEN** 使用者新增名稱 "work" 的帳號
- **THEN** accountId === "work-2"

#### Scenario: Multiple duplicates

- **GIVEN** provider "openai" 下已有 "work" 和 "work-2"
- **WHEN** 使用者新增名稱 "work" 的帳號
- **THEN** accountId === "work-3"

### Requirement: Migration Safety (R6)

既有帳號 accountId migration SHALL 有備份和完整性檢查。

#### Scenario: Migration with backup

- **GIVEN** accounts.json 存在且包含 3 個帳號
- **WHEN** load() 觸發 accountId normalization migration
- **THEN** accounts.json.pre-migration 被建立，內容等同遷移前的 accounts.json

#### Scenario: Migration integrity check

- **GIVEN** migration 完成
- **WHEN** 完整性檢查執行
- **THEN** 遷移後帳號數量 === 遷移前帳號數量，且所有 activeAccount 指標指向有效帳號或 undefined

#### Scenario: Migration idempotent

- **GIVEN** accounts.json 已經過 migration（所有 ID 已是 normalized 格式）
- **WHEN** load() 再次執行
- **THEN** 不觸發 migration、不建立新備份

### Requirement: Deploy Verification Gate (R7)

webctl.sh verify_deploy() SHALL 比對前端 bundle SHA256 hash。

#### Scenario: Hash match

- **GIVEN** dist/ 和 OPENCODE_FRONTEND_PATH 內容一致
- **WHEN** verify_deploy() 執行
- **THEN** 靜默通過（exit 0）

#### Scenario: Hash mismatch

- **GIVEN** dist/ 和 OPENCODE_FRONTEND_PATH 內容不一致
- **WHEN** verify_deploy() 執行
- **THEN** 輸出 expected hash / actual hash detail 並 exit 1

## Acceptance Checks

- Account.list() 回傳值被 caller 修改後，cache 不變
- Account.remove() 對不存在帳號 throw AccountRemoveError
- 刪除 active account 後 activeAccount === undefined
- 新建帳號 accountId === normalizeAccountName(name)
- 衝突時自動加 suffix（-2, -3）
- migration 前 accounts.json.pre-migration 備份存在
- migration 後帳號數量不變
- webctl.sh verify_deploy() 在 hash mismatch 時 exit 1
- tsc --noEmit EXIT 0
- architecture.md 與 codebase 一致
