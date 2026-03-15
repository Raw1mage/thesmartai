# Handoff

## Execution Contract

- Treat this package as research-to-planning authority for the OpenClaw benchmark slice.
- Do not begin large runner implementation until the benchmark explicitly identifies approved slices.
- Preserve fail-fast / no-silent-fallback policy when evaluating any external design for portability.

## Required Reads

- `/home/pkcs12/projects/opencode/specs/20260315_openclaw_runner_benchmark/implementation-spec.md`
- `/home/pkcs12/projects/opencode/specs/20260315_openclaw_runner_benchmark/proposal.md`
- `/home/pkcs12/projects/opencode/specs/20260315_openclaw_runner_benchmark/spec.md`
- `/home/pkcs12/projects/opencode/specs/20260315_openclaw_runner_benchmark/design.md`
- `/home/pkcs12/projects/opencode/specs/20260315_openclaw_runner_benchmark/tasks.md`
- `/home/pkcs12/projects/opencode/docs/events/event_20260315_openclaw_runner_benchmark.md`

## Stop Gates In Force

- Stop if benchmark evidence is too weak to support concrete runner recommendations.
- Stop before build mode if the next phase requires daemon / scheduler / persistence substrate rewrites without explicit phase approval.
- Reject external patterns that depend on silent fallback, ambiguous authority boundaries, or undocumented crash recovery behavior.

## Recommended Build Entry

- Recommended first build slice: **Trigger model extraction + queue substrate generalization**.
- Concretely this means:
  - extract run-trigger typing from current mission continuation flow
  - generalize pending continuation queue into lane-aware run queue
  - keep current approved mission / todo semantics as one trigger source rather than the only source

## Deferred Slices Requiring Explicit Approval

- isolated autonomous job sessions
- recurring scheduler / wakeup persistence
- daemon lifecycle / restart drain / host-wide scheduler health

## Execution-Ready Checklist

- [x] Benchmark evidence is concrete
- [x] Portable vs non-portable classification is explicit
- [x] Validation strategy for next runner phase is defined
- [x] Approval boundary for substrate-heavy work is explicit
