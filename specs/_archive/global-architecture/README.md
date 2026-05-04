# OpenCode Global Architecture — IDEF0 + GRAFCET

逆向工程產出，基於 MIAT 方法論（Machine Intelligence and Automation Technology）。

## 文件結構

### IDEF0 功能分解（靜態空間結構）

| 檔案 | 層級 | 範圍 |
|------|------|------|
| `diagrams/opencode_a0_idef0.json` | A0 (Context) | 6 大子系統：A1-A6 |
| `diagrams/opencode_a1_idef0.json` | L1 | A1 管理使用者介面 → A11-A15 |
| `diagrams/opencode_a2_idef0.json` | L1 | A2 處理 AI Session → A21-A26 |
| `diagrams/opencode_a3_idef0.json` | L1 | A3 路由 Provider 與帳號 → A31-A35 |
| `diagrams/opencode_a4_idef0.json` | L1 | A4 執行工具與 MCP → A41-A45 |
| `diagrams/opencode_a5_idef0.json` | L1 | A5 編排自主工作流 → A51-A55 |
| `diagrams/opencode_a6_idef0.json` | L1 | A6 管理系統基礎設施 → A61-A66 |
| `diagrams/opencode_a23_idef0.json` | L2 | A23 生成 AI 回應 → A231-A235 |
| `diagrams/opencode_a34_idef0.json` | L2 | A34 Rotation3D Fallback → A341-A345 |
| `diagrams/opencode_a44_idef0.json` | L2 | A44 MCP App 生命週期 → A441-A445 |
| `diagrams/opencode_a54_idef0.json` | L2 | A54 工作流編排 → A541-A545 |
| `diagrams/opencode_a62_idef0.json` | L2 | A62 Per-User Daemon → A621-A625 |

### GRAFCET 離散事件行為模型（動態時間軸）

| 檔案 | 範圍 | Steps |
|------|------|-------|
| `diagrams/opencode_session_grafcet.json` | AI Session 處理迴圈 | 9 steps |
| `diagrams/opencode_gateway_grafcet.json` | C Gateway TCP 連線處理 | 11 steps |
| `diagrams/opencode_daemon_grafcet.json` | Per-User Daemon 生命週期 | 9 steps |
| `diagrams/opencode_mcp_grafcet.json` | MCP App 狀態機 | 9 steps |
| `diagrams/opencode_rotation_grafcet.json` | Rotation3D 遞補迴圈 | 11 steps |
| `diagrams/opencode_workflow_grafcet.json` | Workflow Runner 繼續/排水 | 8 steps |
| `diagrams/opencode_tool_grafcet.json` | 工具執行迴圈 | 9 steps |

### 追溯性與元資料

| 檔案 | 用途 |
|------|------|
| `traceability_matrix.json` | GRAFCET Step ↔ IDEF0 ModuleRef 完整對照表 |
| `boundary_map.json` | 系統邊界：user-facing / API / persistence / provider |
| `evidence_trace.json` | 每個 IDEF0 活動的原始碼證據 |
| `source_inventory.json` | 原始碼目錄清單與架構角色 |
| `confidence_notes.json` | 信心等級、假設、決策追蹤 |

## 統計

- **IDEF0 活動總數**: 67 (A0: 6, L1: 31, L2: 25, 加上 A0 本身)
- **GRAFCET 模型**: 7 個獨立狀態機
- **GRAFCET Steps 總數**: 66
- **追溯性覆蓋率**: 100% — 每個 GRAFCET Step 都有有效的 IDEF0 ModuleRef

## drawmiat 相容性

所有 JSON 遵循 drawmiat canonical template format，可直接用於渲染。
