# Published Web Sidebar

## 1. 問題陳述

OpenCode 透過 C Gateway 的 web registry 機制，讓使用者將 web app 發布到 subpath（如 `/cecelearn/`）。但目前：

- 使用者要記住自己發布了哪些 web app、在哪個 URL
- 沒有 GUI 入口可以管理（新增/移除/查看）已發布的路由
- 只能透過 CLI（`webctl.sh publish-route` / `list-routes`）操作

## 2. 目標

在 OpenCode web UI 的左側 sidebar 加入「Published Web」區塊，讓使用者：

1. 看到所有屬於自己的已發布 web app 列表
2. 點擊直接開啟對應網址
3. 透過「...」選單進行 CRUD 操作（開啟、複製 URL、移除）

## 3. 既有 Infrastructure

### 3.1 C Gateway — ctl.sock 協議

**位置**：`daemon/opencode-gateway.c`
**Socket**：`/run/opencode-gateway/ctl.sock`（AF_UNIX, 0666）
**協議**：JSON over newline-delimited

已實作的指令：

```jsonc
// 列出所有路由
→ {"action":"list"}
← {"ok":true,"routes":[{"prefix":"/cecelearn","host":"127.0.0.1","port":5173,"uid":1000}, ...]}

// 發布路由（Gateway 透過 SO_PEERCRED 取得 caller UID）
→ {"action":"publish","prefix":"/cecelearn","host":"127.0.0.1","port":5173}
← {"ok":true}

// 移除路由
→ {"action":"remove","prefix":"/cecelearn"}
← {"ok":true}
```

**持久化**：`/etc/opencode/web_routes.conf`（space-delimited: `prefix host port uid`）

### 3.2 前端 Sidebar 架構

**框架**：SolidJS
**既有模式**：`ScheduledTasksTile` + `TaskSidebar`

```
sidebar-shell.tsx          ← rail 上的 icon tiles + utility buttons
  └─ ScheduledTasksTile    ← 點擊 → navigate("/system/tasks")
layout.tsx
  ├─ isTasksRoute()        ← memo 判斷目前路由
  ├─ renderPanel()         ← 依 route 決定 panel 內容
  └─ push-sidebar Show     ← 桌面版 sidebar 展開邏輯
app.tsx
  └─ Route "/system/tasks" ← router 定義
task-list/
  ├─ api.ts                ← fetch wrapper（用 globalSDK.url + globalSDK.fetch）
  └─ task-sidebar.tsx      ← panel 元件（list + item + dropdown menu）
```

### 3.3 後端 API 架構

**框架**：Hono
**掛載**：`app.ts` 中 `api.route("/xxx", XxxRoutes())`
**慣例**：每個 route file export 一個 `lazy(() => new Hono().get(...).post(...))`

## 4. 架構設計

```
┌──────────────────────────────────────────────────────┐
│  Browser (SolidJS)                                   │
│                                                      │
│  sidebar-shell.tsx    layout.tsx    app.tsx           │
│  ┌─────────────┐     ┌──────────┐  ┌──────────────┐ │
│  │ 🌐 globe    │────▶│navigate  │──│Route         │ │
│  │ icon tile   │     │/system/  │  │/system/      │ │
│  └─────────────┘     │web-routes│  │web-routes    │ │
│                      └────┬─────┘  └──────────────┘ │
│                           │                          │
│  web-routes/              ▼                          │
│  ┌──────────────────────────────┐                    │
│  │ WebRouteSidebar              │                    │
│  │  ├─ fetch GET /web-route     │                    │
│  │  ├─ For each route:          │                    │
│  │  │   ├─ <a> clickable link   │                    │
│  │  │   └─ DropdownMenu (...)   │                    │
│  │  │       ├─ Open in new tab  │                    │
│  │  │       ├─ Copy URL         │                    │
│  │  │       └─ Remove route     │                    │
│  │  └─ groupRoutes() dedup      │                    │
│  └──────────────┬───────────────┘                    │
└─────────────────┼────────────────────────────────────┘
                  │ fetch
                  ▼
┌──────────────────────────────────────────────────────┐
│  Hono Backend (per-user daemon, UID=1000)            │
│                                                      │
│  routes/web-route.ts                                 │
│  ┌──────────────────────────────────┐                │
│  │ GET  /         → list (filtered) │                │
│  │ POST /publish  → publish         │                │
│  │ POST /remove   → remove          │                │
│  └──────────┬───────────────────────┘                │
│             │ net.createConnection                   │
│             ▼                                        │
│  /run/opencode-gateway/ctl.sock                      │
└─────────────┼────────────────────────────────────────┘
              │ JSON over Unix socket
              ▼
┌──────────────────────────────────────────────────────┐
│  C Gateway (root process)                            │
│  daemon/opencode-gateway.c                           │
│  ├─ ctl_handle_line() → JSON parse                   │
│  ├─ in-memory WebRoute[] (max 128)                   │
│  └─ flush_web_routes() → /etc/opencode/web_routes.conf│
└──────────────────────────────────────────────────────┘
```

## 5. 設計決策

### D1: Backend 代理 ctl.sock（非前端直連）

**原因**：瀏覽器無法連 Unix socket。Hono route 做中間層，同時負責 UID 過濾。

### D2: 用 `process.getuid()` 過濾路由

**原因**：per-user daemon 以該使用者 UID 執行。ctl.sock 的 `list` 回傳所有路由含 `uid` 欄位。backend filter `r.uid === process.getuid()` 確保每個使用者只看到自己的。

### D3: 複製 TaskSidebar 架構模式

**原因**：sidebar 的 tile → route → panel 模式已在 Tasks 中驗證。Published Web 的 UX 需求相似（列表 + item actions），直接套用可減少架構分歧。

### D4: Route grouping（去重）

**原因**：一個 web app 通常在 gateway 註冊兩條路由（frontend `/cecelearn` + backend `/cecelearn/api`）。sidebar 按 prefix stem 分組，只顯示最短的那條，避免使用者看到重複項目。移除時也一併移除 `/api` 子路由。

### D5: 不做 inline form（MVP）

**原因**：publish 操作需要知道 port 和 prefix，這是部署面的知識。MVP 階段 publish 仍走 CLI，UI 只做 list + open + remove。

## 6. 涉及檔案

### 6.1 新增

| 檔案 | 用途 |
|------|------|
| `packages/opencode/src/server/routes/web-route.ts` | Hono route：GET list, POST publish, POST remove，透過 ctl.sock 通訊 |
| `packages/app/src/pages/web-routes/api.ts` | 前端 fetch wrapper（list, publish, remove） |
| `packages/app/src/pages/web-routes/web-route-sidebar.tsx` | WebRouteSidebar panel + WebRouteItem 元件 |

### 6.2 修改

| 檔案 | 變更 |
|------|------|
| `packages/opencode/src/server/app.ts` | 加入 `import WebRouteRoutes` + `api.route("/web-route", ...)` |
| `packages/app/src/pages/layout/sidebar-shell.tsx` | SidebarContent props 加 `webRoutesLabel` + `onOpenWebRoutes`；utility bar 加 globe IconButton |
| `packages/app/src/pages/layout.tsx` | 加 `isWebRoutesRoute` memo + `openWebRoutes()` fn + renderPanel 分支 + push-sidebar 條件 |
| `packages/app/src/app.tsx` | 加 `/system/web-routes` Route |

## 7. API 規格

### GET /api/v2/web-route

回傳當前使用者的已發布路由。

```jsonc
// Response 200
{
  "ok": true,
  "routes": [
    { "prefix": "/cecelearn", "host": "127.0.0.1", "port": 5173, "uid": 1000 }
  ]
}
```

### POST /api/v2/web-route/publish

```jsonc
// Request body
{ "prefix": "/myapp", "host": "127.0.0.1", "port": 8080 }
// Response 200
{ "ok": true }
```

### POST /api/v2/web-route/remove

```jsonc
// Request body
{ "prefix": "/myapp" }
// Response 200
{ "ok": true }
```

### Error（gateway 不可達）

```jsonc
// Response 502
{ "ok": false, "routes": [], "error": "gateway unreachable: connect ENOENT ..." }
```

## 8. CRUD 操作對照

| 操作 | UI 觸發 | 前端呼叫 | 後端處理 | Gateway 指令 |
|------|---------|---------|---------|-------------|
| List | panel mount + Refresh 按鈕 | `api.list()` | GET / → ctl `{"action":"list"}` → filter by UID | `list` |
| Open | 點擊 route item | `window.open(url)` | — | — |
| Copy | ... menu → Copy URL | `navigator.clipboard.writeText()` | — | — |
| Remove | ... menu → Remove route | `api.remove(prefix)` | POST /remove → ctl `{"action":"remove"}` | `remove` |
| Publish | CLI only (MVP) | `api.publish()` (API ready) | POST /publish → ctl `{"action":"publish"}` | `publish` |

## 9. 實作狀態

- [x] Backend route (`web-route.ts`)
- [x] Frontend API client (`web-routes/api.ts`)
- [x] WebRouteSidebar panel + WebRouteItem
- [x] Sidebar shell globe tile
- [x] layout.tsx routing integration
- [x] app.tsx route registration
- [ ] 驗證：重啟 web server 後實際測試 sidebar 載入
- [ ] 驗證：點擊開啟連結、移除路由

## 10. 未來延伸

- Publish form：在 sidebar 加入 prefix + port 輸入表單
- 狀態指示：綠/紅燈顯示 backend 是否可達（health check）
- SSE 即時更新：gateway route 變更時推播到前端
- 多使用者視角：admin 可看到所有使用者的路由
