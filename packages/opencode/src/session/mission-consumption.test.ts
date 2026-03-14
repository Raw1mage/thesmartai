import { describe, expect, it } from "bun:test"
import path from "path"
import { tmpdir } from "../../test/fixture/fixture"
import { Instance } from "../project/instance"
import { consumeMissionArtifacts } from "./mission-consumption"

function approvedMission() {
  return {
    source: "openspec_compiled_plan" as const,
    contract: "implementation_spec" as const,
    approvedAt: 1,
    planPath: "specs/changes/test/implementation-spec.md",
    executionReady: true,
    artifactPaths: {
      root: "specs/changes/test",
      implementationSpec: "specs/changes/test/implementation-spec.md",
      proposal: "specs/changes/test/proposal.md",
      spec: "specs/changes/test/spec.md",
      design: "specs/changes/test/design.md",
      tasks: "specs/changes/test/tasks.md",
      handoff: "specs/changes/test/handoff.md",
    },
  }
}

describe("mission consumption", () => {
  it("reads approved mission artifacts into compact execution input", async () => {
    await using tmp = await tmpdir({ git: true })
    await Instance.provide({
      directory: tmp.path,
      fn: async () => {
        const planRoot = path.join(tmp.path, "specs", "changes", "test")
        await Bun.write(
          path.join(planRoot, "implementation-spec.md"),
          "# Implementation Spec\n\n## Goal\n- Ship mission consumption\n\n## Scope\n### IN\n- mission runtime\n\n### OUT\n- daemon rewrite\n\n## Assumptions\n- artifacts exist\n\n## Stop Gates\n- stop on mismatch\n\n## Critical Files\n- packages/opencode/src/session/mission-consumption.ts\n\n## Structured Execution Phases\n- Read mission\n\n## Validation\n- Run mission-consumption tests\n\n## Handoff\n- Continue from approved mission\n",
        )
        await Bun.write(
          path.join(planRoot, "tasks.md"),
          "# Tasks\n\n- [ ] Read mission\n- [ ] Continue implementation\n",
        )
        await Bun.write(
          path.join(planRoot, "handoff.md"),
          "# Handoff\n\n## Execution Contract\n- Read approved mission first\n\n## Required Reads\n- implementation-spec.md\n- tasks.md\n- handoff.md\n\n## Stop Gates In Force\n- Preserve approval gates\n\n## Execution-Ready Checklist\n- [ ] Mission approved\n",
        )

        const result = await consumeMissionArtifacts(approvedMission())
        expect(result.ok).toBe(true)
        if (!result.ok) throw new Error("expected successful mission consumption")
        expect(result.trace.goal).toContain("Ship mission consumption")
        expect(result.trace.executionChecklist).toEqual(["Read mission", "Continue implementation"])
        expect(result.trace.requiredReads).toContain("implementation-spec.md")
      },
    })
  })

  it("fails when required mission artifacts are missing", async () => {
    await using tmp = await tmpdir({ git: true })
    await Instance.provide({
      directory: tmp.path,
      fn: async () => {
        const result = await consumeMissionArtifacts(approvedMission())
        expect(result.ok).toBe(false)
        if (result.ok) throw new Error("expected failed mission consumption")
        expect(result.issues.some((issue) => issue.includes("implementationSpec missing"))).toBe(true)
      },
    })
  })
})
