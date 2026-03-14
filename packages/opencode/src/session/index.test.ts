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
          },
        })

        const updated = await Session.get(session.id)
        expect(updated.mission).toEqual({
          source: "openspec_compiled_plan",
          contract: "implementation_spec",
          approvedAt: 123,
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
        })

        await Session.clearMission(session.id)
        const cleared = await Session.get(session.id)
        expect(cleared.mission).toBeUndefined()
        await Session.remove(session.id)
      },
    })
  })
})
