# Vision: Long-Term Evolution of CMS

記錄長期方向的想法。不需要立刻實作，隨時補充，遇到小機會就順手推進。

---

## 一、可繁殖的智能體節點

### 目標形態

CMS 最終應該成為一個**可自我複製部署的智能體節點**：

- 一鍵打包自身（config、daemon 定義、agent 設定、工具集）
- 部署到任意主機（雲端 VM、NAS、Raspberry Pi、朋友的機器）
- 新節點 bootstrap 後自動偵測環境，調整配置，啟動 daemon
- 無需人工設定，立即可用

每個節點都是完整的智能體：有感知（daemon sense）、有判斷（LLM）、有行動（工具調用）、有通知（Bus → operator）。節點之間可以獨立運作，也可以協作。

### 這不是現在的 chatbot

現在大多數 AI 工具是被動的 chatbot——等待輸入，回答，結束。

CMS 的方向是**主動智能體**：
- 24x7 守著環境
- 感知變化，自主推進工作
- 人類設定目標與邊界，機器持續執行
- 遇到需要判斷的地方才暫停通知人類

---

## 二、純 C 重構願景

### 為什麼是 C

現在的 CMS DNA 很雜：TypeScript + Bun + npm，上千個外部套件。這決定了它能去哪裡——每台目標機器都需要 Bun runtime、npm 生態，部署複雜，難以真正輕量化。

**純 C 的意義不是效能，是自主性：**

- 靜態連結 → 單一 binary，零 runtime dependency
- `scp` 到任何機器就能跑：ARM、x86、RISC-V、嵌入式、未來硬體
- Binary 本身就是完整智能體，跟 SQLite 一樣——copy and run
- 真正實現「一鍵繁殖」

### LLM 改變了重構的可行性

傳統 C 重構代價極高：手工撰寫、記憶體管理、漫長 debug 週期。

**但 LLM 資源無限的假設下，這個成本曲線完全改變**——LLM 全程輔助生成和驗證 C 代碼，CMS 可以用自己來改寫自己。重構從「需要大量人力」變成「需要大量 LLM token + 時間」。

### 重構策略：漸進式去毒

不需要一次重寫。原則：**遇到小改就能脫離 dependency 的地方，順手改**。

**優先順序（從核心往外）：**

1. **Core runtime**（最重要的 DNA）
   - Session / Message 管理
   - Bus（pub/sub）
   - ProcessSupervisor
   - 這些是系統的骨幹，C 實作後其他層都可以替換

2. **IPC / Transport**
   - 目前用 Bun 的 stdin/stdout、Unix socket
   - C 的 socket + pipe 完全可以取代，而且更輕

3. **Storage**
   - 目前 JSON files via Bun filesystem API
   - C 的 fopen/fwrite 夠用；未來可考慮 SQLite（純 C，單檔案）

4. **Provider adapters**（最後換）
   - HTTP/WebSocket 用 libcurl 或自己寫
   - 這層改動最大，但也最可以慢慢來

5. **TUI / Web**（可以最後換，甚至保留 JS）
   - Web 界面繼續用 JS/React，後端換 C daemon
   - TUI 可用 ncurses 或自己的 terminal renderer

### 平時順手做的方向

- 看到用了某個 npm 套件只做一件很簡單的事（字串處理、file path、simple HTTP）→ 換成 stdlib 或自己寫幾行
- 看到可以用 Bun.file / standard fs 取代某個 abstraction library → 換掉
- 新寫的 utility function 優先不引入新 dependency
- 每次去掉一個 dependency 就記錄在 `docs/events/`

### 長期形態

```
cms-core (C binary, static)
  ├── daemon runtime
  ├── session manager
  ├── bus
  ├── tool executor
  └── provider adapters (HTTP/WS)

cms-web (JS, thin client)
  └── connects to cms-core via Unix socket / HTTP

cms-tui (C, ncurses or custom)
  └── connects to cms-core via Unix socket
```

Core 是純 C，UI 層可以是任何語言。部署時只需要帶 core binary。

---

## 三、想法總索引

本系列 vision 文件記錄的所有方向：

| 文件 | 主題 |
|---|---|
| [vision.md](vision.md) | Subagent evolution、Cache 優化、Daemon agent、Autonomous runner |
| [vision-long-term.md](vision-long-term.md)（本文） | 可繁殖智能體節點、純 C 重構願景 |

實作計畫在 [implementation-spec.md](implementation-spec.md)、[tasks.md](tasks.md)。
