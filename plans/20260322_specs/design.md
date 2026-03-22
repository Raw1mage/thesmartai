# Design

## Context

- The repo already formalized the rule that dated active plan/build workspaces live under `/plans`, while `/specs` stores long-lived semantic roots plus `specs/architecture.md`.
- Legacy dated roots created before or during the lifecycle transition still remain under `/specs`.
- Some dated roots are pure plans, while others correspond to implemented features that should be normalized into semantic roots.

## Goals / Non-Goals

**Goals:**
- Reclassify legacy dated roots using commit-first evidence.
- Normalize implemented dated roots into conservative semantic spec roots.
- Demote shelved or unimplemented dated roots into `/plans`.
- Preserve enough provenance that historical intent is still traceable.

**Non-Goals:**
- Rewriting all historical documents into a single editorial voice.
- Using `tasks.md` completion state as the authority for migration.

## Decisions

- Use commit history (`git log --follow`, `git show --stat`) and code blame as the primary implementation-status authority.
- Use event verification/closeout records as secondary evidence.
- Use direct semantic root names rather than long historical names.
- Fold telemetry implementation and telemetry optimization into the existing semantic `specs/telemetry/` root.

## Data / State / Control Flow

- User requirement -> orchestrator plan update -> commit/event/code triage -> file-system reorganization -> event sync -> architecture sync.
- Dated legacy roots are evaluated one-by-one and routed to either `/plans/<date_slug>/` or `/specs/<semantic-root>/`.
- Provenance remains in event documentation and any retained superseded/reference notes.

## Risks / Trade-offs

- Over-consolidation risk -> use only conservative semantic merges backed by strong commit evidence.
- Partial documentation drift -> sync the event first, then verify `specs/architecture.md` after the final directory shape is known.
- Historical provenance loss -> preserve meaningful subordinate files or superseded notes when merging dated roots.

## Critical Files

- /home/pkcs12/projects/opencode/specs/architecture.md
- /home/pkcs12/projects/opencode/docs/events/event_20260322_specs_reorganization.md
- /home/pkcs12/projects/opencode/specs/20260321_inline-agent-switch/
- /home/pkcs12/projects/opencode/specs/20260320_remote-terminal/
- /home/pkcs12/projects/opencode/specs/20260318_account-management-refactor/
- /home/pkcs12/projects/opencode/specs/20260320_telemetry-implementation/
- /home/pkcs12/projects/opencode/specs/20260321_telemetry-optimization/
- /home/pkcs12/projects/opencode/specs/20260321_specs/
