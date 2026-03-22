# Tasks

## 1. Builder Compatibility Guard

- [ ] 1.1 Inventory current builder responsibilities and preserve backward-compatible non-beta behavior
- [ ] 1.2 Define explicit beta-enabled mission metadata without regressing legacy build flows

## 2. Builder-Native Beta Primitives

- [ ] 2.1 Extract and internalize shared branch/worktree/runtime primitives from current beta-tool logic
- [ ] 2.2 Keep temporary compatibility adapters only as needed during migration away from beta/dev MCP

## 3. Build Entry Optimization

- [ ] 3.1 Extend `plan_exit` to bootstrap beta flow only when planner artifacts opt into it
- [ ] 3.2 Persist beta execution context in mission / handoff metadata for build mode

## 4. Routine Git Flow Optimization

- [ ] 4.1 Add builder-owned defaults for routine branch/checkout/commit/push/pull orchestration where policy allows
- [ ] 4.2 Keep explicit approval boundaries for remote/destructive operations that still require operator consent

## 5. Validation Flow Optimization

- [ ] 5.1 Add build-mode validation support for syncback-equivalent main-worktree updates
- [ ] 5.2 Add runtime policy execution / manual stop behavior for validation slices

## 6. Finalize Flow Optimization

- [ ] 6.1 Add builder-owned merge preflight after successful validation
- [ ] 6.2 Enforce explicit approval gate before merge / cleanup execution

## 7. Migration / Deprecation

- [ ] 7.1 Mark beta/dev MCP as non-required migration scaffolding
- [ ] 7.2 Plan final removal once builder-native workflow is validated

## 8. Regression + Token Validation

- [ ] 8.1 Add or update targeted tests for builder compatibility and beta-aware handoff
- [ ] 8.2 Verify builder-native deterministic primitives reduce routine AI orchestration and do not break existing builder flow

## 9. Documentation / Retrospective

- [ ] 9.1 Sync event log and architecture docs for builder/beta integration
- [ ] 9.2 Compare the final implementation against this plan’s effective requirement description
