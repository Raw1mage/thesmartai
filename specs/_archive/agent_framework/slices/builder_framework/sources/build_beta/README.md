# build_beta

This spec root is the semantic family that absorbed the completed active plan originally authored under `/plans/20260321_beta-tool/`. That historical promotion was manual; the current beta workflow now requires equivalent post-merge closeout into the related spec family after the final test-branch merge.

## Scope

Builder-native beta workflow integration for:
- beta bootstrap
- routine git orchestration (`checkout` / `commit` / `pull` / `push` with approval boundaries)
- syncback validation
- branch-drift remediation
- approval-gated finalize
- beta/dev MCP migration to compatibility-scaffolding status

## Promotion Record

- Source plan root: `/plans/20260321_beta-tool/`
- Legacy record: promoted manually after execution completed and plan tasks were closed
- Legacy record: promotion requested by user in that session
- Current workflow rule: future beta-completed plan roots should be closed out into the related semantic spec family as part of post-merge finalize

## Notes

- `specs/architecture.md` remains the architecture single source of truth.
- The original `/plans/20260321_beta-tool/` package is retained as historical execution evidence unless removed in a separate explicit cleanup step.
