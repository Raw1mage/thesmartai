# Session Dialog DB Tool Refactor Proposal

## 需求

使用者指出 session 已全面改為 DB 儲存；本次工作要重構 system-manager 相關 session/dialog tool，使其讀取 DB 內的 session dialog，而不是舊式檔案/記憶體路徑。

## 範圍

IN:

- 偵查 system-manager MCP session 相關工具目前讀取路徑。
- 對齊 opencode runtime DB-backed session/message/dialog API。
- 最小修改 system-manager tool，讓 session dialog 讀取 DB 資料。
- 補上必要驗證與事件紀錄。

OUT:

- 不新增 fallback mechanism。
- 不改 daemon/gateway lifecycle。
- 不做 UI 行為改版，除非 DB contract 需要同步型別。

## 約束

- fail fast；缺少 session/dialog DB 資料時回明確錯誤或空結果語意，不從舊路徑 silent fallback。
- 不暴露 secrets。
- 不自行重啟 daemon。
