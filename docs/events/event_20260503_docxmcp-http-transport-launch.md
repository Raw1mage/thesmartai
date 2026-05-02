# 2026-05-03 — docxmcp-http-transport launch

## What landed

Replaces docxmcp's bind-mount-based MCP transport with HTTP Streamable
transport over a Unix domain socket. Cross-cutting policy: bind mount
banned across the mcp ecosystem with one narrow exception for IPC
rendezvous dirs (`/run/user/<uid>/opencode/sockets/<app>/`).

## Verified

| Check | Result |
|---|---|
| docxmcp connects via `unix:///run/user/1000/opencode/sockets/docxmcp/docxmcp.sock:/mcp` | ✅ daemon log: `mcp-apps.json http app connected transport:streamable-http` |
| 20 tools registered through HTTP MCP | ✅ |
| Other mcp apps (gmail / google-calendar / system-manager / memory / sequential-thinking) still on stdio | ✅ |
| Container `docker inspect Mounts`: zero data-dir bind mounts | ✅ only IPC bind + named volume |
| Bind-mount lint rejects data-dir bind mount | ✅ `McpAppStoreError` 400 on POST with `-v /home/x:/y` |
| Bind-mount lint accepts IPC dir bind mount | ✅ register succeeds |
| File API endpoints over UDS | ✅ `POST /files` / `GET /files/{token}` / `DELETE /files/{token}` / `/healthz` all 200 |
| Token store TTL + LRU + cap | ✅ 10/10 unit tests |
| 18 tools rewritten to accept `token` schema, 2 exempt (pack_docx, scaffold_doc) | ✅ 9/9 schema tests |
| opencode incoming/ unit + integration | ✅ 43/43 |

## docxmcp pytest summary

```
tests/test_token_store.py ..........  (10)
tests/test_tool_registry_token.py ......... (9)
========================== 19 passed ==========================
```

## opencode bun test summary

```
test/incoming/paths.test.ts          (12)
test/incoming/history.test.ts        (10)
test/incoming/upload.test.ts         (6)
test/incoming/tool-hook.test.ts      (4)
test/incoming/bind-mount-lint.test.ts (11)
========================== 43 passed ==========================
```

## Commits

| Repo | Commit | Scope |
|---|---|---|
| docxmcp | (phases 1-4) | token store + HTTP file API + 20 tool schema rewrite + Dockerfile/compose for UDS + bin-wrappers + install.sh |
| docxmcp | `b04c0df` | mcp.json → URL form |
| opencode | `5e868c44c` (later amended `64cd9bc79`) | manifest schema + bind-mount lint + dispatcher rewrite + tests |

## Observation: AI's resourcefulness

During smoke testing the AI in a real session called `Bash("unzip -p
incoming/rebuilt.docx word/document.xml | head")` to extract a docx
title — bypassing docxmcp entirely. This is **expected and good**.
docxmcp's value lies in structural *writes* (rebuild, apply_styles,
patch_paragraph, image manipulations) rather than structural reads,
which the AI handles with general-purpose shell tooling. The transport
infrastructure is therefore correctly priced: zero overhead when AI
doesn't need it, available the moment it does.

## What still needs the user / system admin

- All other system users (cece / rooroo / liam / yeatsluo / chihwei)
  need to be added to `docker` group: `sudo usermod -aG docker <user>`
  one-shot per user, then re-login. Then each runs
  `cd ~/projects/docxmcp && docker compose -p docxmcp-${USER} up -d`
  + `./install.sh` from their own session. **Per-spec this is a stop
  gate; not auto-executed.**

## Follow-up

`mcp-bind-mount-audit-purge` — periodic sweep + UI banner if violations
appear. Open after this spec promotes to living. Currently only docxmcp
ever had a bind mount; with this commit the ecosystem is bind-mount-free.
