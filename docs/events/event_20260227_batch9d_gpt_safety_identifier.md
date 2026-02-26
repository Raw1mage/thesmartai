# Batch9D GPT safety_identifier for Zen OpenAI path (rewrite-only)

Date: 2026-02-27
Source: `origin/dev` (`1e48d7fe8228d94ded379e36975b2cce12f4a510`)
Target: `cms`

## Scope

- Port low-risk OpenAI request hardening in Zen handler/provider path.

## Changes

1. `packages/console/app/src/routes/zen/util/provider/provider.ts`
   - Extended provider helper contract:
     - `modifyBody(body, workspaceID?)`
2. `packages/console/app/src/routes/zen/util/provider/openai.ts`
   - OpenAI `modifyBody` now appends `safety_identifier` when `workspaceID` is present.
3. `packages/console/app/src/routes/zen/util/handler.ts`
   - Passes `authInfo?.workspaceID` into `modifyBody`.
   - Preserves payload modifier merge before provider-specific body adaptation.

## Validation

- `bun run typecheck` in `packages/console/app` ✅

## Safety

- Change only affects outbound OpenAI request payload shape for Zen requests.
- No impact on cms provider split/account rotation/admin panel logic.
