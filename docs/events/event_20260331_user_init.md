# 20260331_user-init-plan

## 1. 需求分析 (Requirement Analysis)
- **核心目標**：確保新使用者（如 `cece`）在透過 OpenCode Gateway 登入後，其環境能自動具備完整的設定檔與目錄結構。
- **背景問題**：目前的 `src/global/index.ts` 依賴相對於原始碼目錄的 `templates/` 路徑，當編譯為單一 binary 並跨使用者執行時，會因為找不到模板而無法初始化。
- **解決方案**：
    1.  建立「系統級模板目錄」(System-wide Templates)，供所有使用者讀取。
    2.  在 `opencode` binary 中加入動態路徑檢索邏輯。
    3.  實作 Shell Profile 自動注入，確保 CLI 命令環境。

## 2. 範圍 (Scope)
### IN
- `src/global/index.ts`: 強化模板路徑解析邏輯。
- `templates/shell-profile.sh`: 定義 CLI 注入內容。
- `packages/opencode/script/install.ts`: 支援安裝系統級模板。
- `UserInit` 服務：在 Daemon 啟動時執行 Shell 檢查。

### OUT
- Gateway 面板的功能修改。
- `pincyluo@gmail.com` 的身份驗證邏輯。

## 3. 變更盤點 (Changes)

### 3.1 系統目錄規劃
- **System Templates**: `/usr/local/share/opencode/templates/`
- **User Config**: `~/.config/opencode/`
- **User Data**: `~/.local/share/opencode/`
- **User Cache**: `~/.cache/opencode/`

### 3.2 任務清單 (Task List)
- [ ] **Task 1: 調查目前的安裝腳本** - 確認模板部署位置。
- [ ] **Task 2: 修改 `src/global/index.ts`** - 加入 `findTemplatesDir` 函數。
- [ ] **Task 3: 實作 `UserInit` 模組** - 負責 Shell Profile 檢查與 `.bashrc` 注入。
- [ ] **Task 4: 更新 `templates/system/opencode-user-daemon-launch.sh`** - 確保環境變數傳遞。
- [ ] **Task 5: 驗證 `cece` 使用者初始化** - 使用 `sudo -u cece opencode version` 觸發。

## 4. 關鍵設計 (Critical Design)

### findTemplatesDir 邏輯
1.  `env.OPENCODE_TEMPLATES_DIR` (優先度 1)
2.  `path.join(process.cwd(), "templates")` (優先度 2, 開發模式)
3.  `path.join(import.meta.dir, "../../../../templates")` (優先度 3, Repo 內執行)
4.  `/usr/local/share/opencode/templates` (優先度 4, 正式環境)

### Shell 注入
當 Daemon 啟動時，檢查 `~/.bashrc` 是否包含 `opencode init` 或是 `source ~/.config/opencode/shell-profile.sh` 的呼叫。若無，則自動追加。
