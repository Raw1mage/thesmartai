import { describe, expect, it } from "bun:test"
import { Session } from "./index"
import { Instance } from "../project/instance"
import { tmpdir } from "../../test/fixture/fixture"

describe("session execution identity", () => {
  it("increments revision only when execution identity actually changes", () => {
    const first = Session.nextExecutionIdentity({
      model: {
        providerId: "openai",
        modelID: "gpt-5.4",
        accountId: "acct-a",
      },
      now: 100,
    })

    expect(first).toEqual({
      providerId: "openai",
      modelID: "gpt-5.4",
      accountId: "acct-a",
      revision: 1,
      updatedAt: 100,
    })

    const unchanged = Session.nextExecutionIdentity({
      current: first,
      model: {
        providerId: "openai",
        modelID: "gpt-5.4",
        accountId: "acct-a",
      },
      now: 200,
    })

    expect(unchanged).toEqual({
      providerId: "openai",
      modelID: "gpt-5.4",
      accountId: "acct-a",
      revision: 1,
      updatedAt: 200,
    })

    const changed = Session.nextExecutionIdentity({
      current: unchanged,
      model: {
        providerId: "github-copilot",
        modelID: "gpt-5.4",
        accountId: "acct-b",
      },
      now: 300,
    })

    expect(changed).toEqual({
      providerId: "github-copilot",
      modelID: "gpt-5.4",
      accountId: "acct-b",
      revision: 2,
      updatedAt: 300,
    })
  })

  it("persists approved mission contracts on the session", async () => {
    await using tmp = await tmpdir()
    await Instance.provide({
      directory: tmp.path,
      fn: async () => {
        const session = await Session.create({})
        await Session.setMission({
          sessionID: session.id,
          mission: {
            source: "openspec_compiled_plan",
            contract: "implementation_spec",
            approvedAt: 123,
            planPath: "plans/20260315_test/implementation-spec.md",
            executionReady: true,
            artifactPaths: {
              root: "plans/20260315_test",
              implementationSpec: "plans/20260315_test/implementation-spec.md",
              proposal: "plans/20260315_test/proposal.md",
              spec: "plans/20260315_test/spec.md",
              design: "plans/20260315_test/design.md",
              tasks: "plans/20260315_test/tasks.md",
              handoff: "plans/20260315_test/handoff.md",
            },
          },
        })

        const updated = await Session.get(session.id)
        expect(updated.mission).toEqual({
          source: "openspec_compiled_plan",
          contract: "implementation_spec",
          approvedAt: 123,
          planPath: "plans/20260315_test/implementation-spec.md",
          executionReady: true,
          artifactPaths: {
            root: "plans/20260315_test",
            implementationSpec: "plans/20260315_test/implementation-spec.md",
            proposal: "plans/20260315_test/proposal.md",
            spec: "plans/20260315_test/spec.md",
            design: "plans/20260315_test/design.md",
            tasks: "plans/20260315_test/tasks.md",
            handoff: "plans/20260315_test/handoff.md",
          },
        })

        await Session.clearMission(session.id)
        const cleared = await Session.get(session.id)
        expect(cleared.mission).toBeUndefined()
        await Session.remove(session.id)
      },
    })
  })
})
