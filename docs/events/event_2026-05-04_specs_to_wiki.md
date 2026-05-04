# 2026-05-04 — specs/ converted from plan packages to product wiki

## Summary

The `specs/` directory was reframed from "plan-builder spec packages
(forward-looking)" to "product wiki (descriptive of current code)".
The 41 original folders were consolidated into 11 wiki entries by
topic; originals were moved to `specs/_archive/<slug>/` to preserve
history. All cross-references in `architecture.md`, `docs/events/**`,
`README.md`, helper scripts, and inter-archive links were rewritten
from `specs/<slug>/...` to `specs/_archive/<slug>/...` so paths still
resolve.

## Motivation

User direction: "文件必須和實作對齊，也就是以現在版本的程式為主。
目的是將 specs 從實作計畫轉為產品 wiki" — followed by "能合併的要合
併，讓樹根自然收斂，不要那麼發散". The premise was that ~40 parallel
plan packages had drifted from the live code in two ways:

1. Many `living` packages described an intent that had since shipped,
   evolved, or been partially superseded — readers had to triangulate
   plan + diff + code to know the current state.
2. Adjacent packages (e.g. four compaction packages, three mobile
   packages, two question-tool fixes) covered overlapping ground; the
   real subsystem boundary was at a coarser grain than plan-builder
   slugs.

## What changed

### Folder structure

```
specs/
├── README.md                    (wiki index)
├── architecture.md              (cross-cutting narrative; unchanged)
├── compaction.md                ← compaction-redesign + compaction-improvements
│                                  + prompt-cache-and-compaction-hardening
│                                  + tool-output-chunking
├── session.md                   ← session-storage-db + session-rebind-…
│                                  + session-ui-freshness + session-poll-cache
│                                  + frontend-session-lazyload
│                                  + mobile-session-restructure
│                                  + mobile-tail-first-simplification
│                                  + mobile-submit-durability
│                                  + 20260501_frontend-dialog-stream-flattening
├── provider.md                  ← claude-provider-beta-fingerprint-realign
│                                  + codex-fingerprint-alignment + codex
│                                  + lmv2-decoupling
│                                  + provider-account-decoupling
├── account.md                   ← account-management + google-auth-integration
├── attachments.md               ← attachment-lifecycle
│                                  + repo-incoming-attachments
│                                  + docx-upload-autodecompose
├── mcp.md                       ← mcp_subsystem + mcp-idle-unload
│                                  + docxmcp-http-transport
├── agent-runtime.md             ← agent_framework + autonomous-opt-in
│                                  + responsive-orchestrator
│                                  + subagent-quota-safety-gate
│                                  + mandatory-skills-preload
│                                  + scheduler-channels
│                                  + question-tool-abort-fix
│                                  + question-tool-input-normalization
├── daemon.md                    ← daemonization + safe-daemon-restart
├── webapp.md                    ← webapp
├── app-market.md                ← app-market
├── meta.md                      ← plan-builder + global-architecture
│                                  + config-management
└── _archive/
    └── … 41 original folders, untouched
```

### Wiki-entry contract

Every entry follows the same shape:

1. `# <topic>` heading.
2. Top-of-file blockquote naming source folders + scope.
3. `## Status` — shipped / partial / abandoned + dates.
4. `## Current behavior` — H3 sub-sections describing what the live
   code does, NOT what was originally planned.
5. `## Code anchors` — file paths + approximate line numbers, grouped
   by area, for grep-jump.
6. `## Notes` — open work, deprecation surface, known caveats,
   cross-links to sibling wiki entries.

### Cross-reference rewrite

100 markdown files plus ~3 helper scripts were edited to rewrite paths
from `specs/<slug>/` to `specs/_archive/<slug>/`. The rewrite was done
with a Python regex pass keyed on the 41 known slugs; non-folder
matches (e.g. `specs/architecture.md`) were not affected.

`docs/events/` event logs were rewritten in place — they keep
historical accuracy and remain navigable.

## Why archive (not delete) the originals

Per [user-memory `feedback_xdg_backup_policy.md`] / general
"never auto-delete"  discipline: each original package contains
non-trivial design work (proposal.md, design.md, idef0.json,
grafcet.json, test-vectors.json) that may be useful for re-deriving
*why* a behaviour exists. The wiki tells you *what* the code does
now; the archive tells you *how the team got there*. Deletion would
collapse that distinction.

## Out of scope (deliberate)

- `architecture.md` was NOT split into per-topic chunks. It remains
  the cross-cutting narrative and decision log; the per-topic wiki
  entries are the new detail layer. A future task could restructure
  `architecture.md` further; that's not part of this conversion.
- The plan-builder skill itself is unchanged. New plans should still
  go through plan-builder, but landed in a separate `_active/<slug>/`
  area (or a similar convention) and folded into the relevant wiki
  entry on `living`. This event does not codify that convention; the
  meta wiki entry hints at it.
- No code under `packages/**` was changed.
- No XDG state was touched. Per AGENTS.md, this was a pure docs
  refactor with no `bun test` or daemon-mutating commands; XDG
  backup whitelist was therefore not required.

## Roll-back

`git revert <merge-commit>` restores the original 41 folders. The
wiki entries are net-new content; archived content is byte-identical
to pre-conversion.

## Authors

Conversation between user (`yeatsluo`) and Claude on 2026-05-04.
Pilot: `compaction.md` written by main agent. Other 10 wiki entries
drafted by parallel general-purpose subagents and reviewed by main.
