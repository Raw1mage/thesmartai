# Mapping: spec → code locations

This file maps kill-switch spec items to concrete code locations and owners in the opencode repo.

## High-level mappings (runtime authoritative)

- Control protocol (seq/ACK): `specs/20260316_kill-switch/control-protocol.md`
  - Implementation: `packages/opencode/src/server/killswitch/service.ts` + `packages/opencode/src/server/routes/killswitch.ts`

- RBAC/capability hooks: `specs/20260316_kill-switch/rbac-hooks.md`
  - Implementation: `packages/opencode/src/server/routes/killswitch.ts`

- Persistent state / audit / snapshot substrate:
  - Implementation: `packages/opencode/src/server/killswitch/service.ts`
  - Backend substrate: `packages/opencode/src/storage/storage.ts`

- Scheduling gate:
  - Implementation: `packages/opencode/src/server/routes/session.ts`

## Files currently in active scope

- `packages/opencode/src/server/routes/killswitch.ts`
- `packages/opencode/src/server/killswitch/service.ts`
- `packages/opencode/src/server/routes/session.ts`
- `packages/opencode/src/server/app.ts`
- `packages/opencode/src/server/routes/killswitch.test.ts`
- `packages/opencode/src/server/routes/session.killswitch-gate.test.ts`
- `packages/opencode/src/server/killswitch/service.test.ts`

## Deferred adapter targets (phase-2)

- Redis control transport adapter
- MinIO/S3 snapshot adapter
- Enhanced worker runtime termination adapter (container/process specific)

## Config / policy knobs

- `permission.kill_switch.trigger` (global config) — required allow for authorized operation
- MFA dev behavior: controlled by runtime env flags already used in route path

## Notes

- 本 mapping 以 `packages/opencode/**` 為唯一真相來源；舊 `src/server/**` prototype 路徑不再作為交付目標。
