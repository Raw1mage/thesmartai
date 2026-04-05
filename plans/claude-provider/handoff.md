# Handoff

## Execution Contract

- Build agent must read implementation-spec.md first
- Build agent must read proposal.md / spec.md / design.md / tasks.md before coding
- Materialize tasks.md into runtime todos before coding

## Required Reads

- implementation-spec.md
- proposal.md
- spec.md
- design.md (特別是 DD-4 request signature + DD-8 reference-first validation)
- tasks.md
- idef0.json + grafcet.json (A0 context — 整體流程)
- diagrams/claude_a1_idef0.json + claude_a1_grafcet.json (逆向提取 pipeline — **Phase 6.0 的執行規範**)
- diagrams/claude_a3_idef0.json + claude_a3_grafcet.json (封包組裝 pipeline — **Phase 6.1-6.4 的執行規範**)
- diagrams/claude_a2_idef0.json + claude_a2_grafcet.json (OAuth handshake — **Phase 5 的執行規範**)
- diagrams/claude_a4_idef0.json + claude_a4_grafcet.json (Transport exchange — **Phase 7 的執行規範**)

## Current State

- Plan package 建立完成，所有 artifacts 就緒
- 尚未開始任何實作

## Stop Gates In Force

- 如果 Anthropic 變更 OAuth 端點或 scope 格式，需暫停重新評估
- 如果 Bun FFI 同時載入兩個 .so 有 symbol 衝突，需改 naming strategy
- 如果 Claude Code 協議（?beta=true、mcp_ prefix）被棄用或改版，需同步更新

## Build Entry Recommendation

- **Phase 6.0 (逆向提取) 必須最先做** — 從 official binary 提取所有協議常數，建立 test vectors。這是整個 transport layer 的真相來源。
- Phase 1 (ABI Contract) 可平行推進 — `claude_provider.h` 是所有 C 檔案的基礎
- Phase 1 完成後可平行推進 Phase 2 (Build System) + Phase 3 (Core Lifecycle)
- Phase 5 (OAuth) 依賴 Phase 4 (Storage) 完成
- Phase 6 (Request Signature) 依賴 6.0 完成，是最高優先級的實作
- Phase 7 (Transport) 依賴 Phase 6 完成
- Phase 9 (FFI Binding) 可在 Phase 3 完成後開始（ABI version check 即可測試）
- Phase 10 (Integration) 在其他 Phase 都完成後進行

**⚠️ 關鍵提醒：**
- `anthropic.ts` 有已知偏差（VERSION、cch 值、缺少 cc_workload、缺少 system prompt 變體）
- C plugin 不可直接抄 anthropic.ts 的常數
- 所有 request signature 相關常數必須從 official binary 提取

### 依賴圖

```
Phase 1 (ABI) ─────┬── Phase 2 (Build) ── Phase 5 check
                    ├── Phase 3 (Lifecycle) ─── Phase 9 (FFI) early test
                    ├── Phase 4 (Storage) ─── Phase 5 (OAuth)
                    ├── Phase 6 (Transform)
                    └── Phase 7 (Transport) ─── depends on Phase 6
Phase 8 (CLI) ── depends on Phase 3, 5, 7
Phase 10 (Integration) ── depends on all above
```

## Reference Implementation Map

每個 C 檔案都有 codex provider 中的對應參考，以及對應的 IDEF0 模組：

| Claude Provider | IDEF0 Module | Codex Reference | 差異重點 |
|---|---|---|---|
| claude_provider.h | A0 (全部) | codex_provider.h | 不同的 enum values、Anthropic SSE events |
| provider.c | A0 lifecycle | provider.c | 不同的 model catalog、config defaults |
| auth.c | A2 (A21-A27) | auth.c | Code paste mode (無 local server)、不同的 OAuth endpoints |
| transport.c | A4 (A41-A42) | transport.c | 不同的 URL pattern、headers |
| stream.c | A4 (A43-A45) | stream.c | Anthropic SSE format vs OpenAI Responses SSE |
| storage.c | A2 (A25) | storage.c | 幾乎相同，path 不同 |
| transform.c | **A3 (A31-A37)** | transform.c | **完全不同 — 真相來源是 A1 逆向產出，不是 codex** |
| originator.c | A3 (A34) | originator.c | "claude-code/VERSION" — VERSION 由 A1 提取 |
| main.c | — | main.c | 相同的 stdio bridge pattern |

### 文件依賴鏈

```
Official Binary ──(A1 逆向)──→ Protocol Datasheet
                              ├── Packet Composition Diagram  ──→ transform.c (A3)
                              ├── Handshake Chart              ──→ auth.c (A2)
                              ├── SSE Event Schema             ──→ stream.c (A4)
                              ├── Attribution Hash Algorithm   ──→ transform.c (A33)
                              └── Test Vectors                 ──→ 驗證全部 .c 檔案
```

## Execution-Ready Checklist

- [x] Implementation spec is complete
- [x] Companion artifacts are aligned
- [x] Validation plan is explicit
- [x] Runtime todo seed is present in tasks.md
- [x] Stop gates are documented
- [x] Reference implementation map is complete
- [x] Dependency graph is documented
