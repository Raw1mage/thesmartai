import { describe, expect, it } from "bun:test"
import { buildSuggestedBetaBranchName, resolvePlanExitBetaMission, shouldCollectBetaMissionFields } from "./plan"

describe("plan_exit beta mission resolution", () => {
  it("preserves existing user-approved implementation branch", () => {
    const result = resolvePlanExitBetaMission({
      session: { slug: "witty-wolf" },
      existing: {
        branchName: "persistent-cron",
        baseBranch: "cms",
        repoPath: "/repo",
        mainWorktreePath: "/repo",
        betaPath: "/repo-beta",
        runtimePolicy: "manual",
      },
      defaults: {
        branchName: "feature/witty-wolf-beta",
        baseBranch: "cms",
        repoPath: "/repo",
        mainWorktreePath: "/repo",
        betaPath: "/repo-beta",
        runtimePolicy: "manual",
      },
    })

    expect(result.branchName).toBe("persistent-cron")
    expect(result.betaPath).toBe("/repo-beta")
  })

  it("uses suggested slug branch only when existing branch is missing", () => {
    const suggested = buildSuggestedBetaBranchName({ slug: "witty-wolf" })
    const result = resolvePlanExitBetaMission({
      session: { slug: "witty-wolf" },
      existing: undefined,
      defaults: {
        branchName: suggested,
        baseBranch: "cms",
        repoPath: "/repo",
        mainWorktreePath: "/repo",
        betaPath: "/repo-beta",
        runtimePolicy: "manual",
      },
    })

    expect(suggested).toBe("feature/witty-wolf-beta")
    expect(result.branchName).toBe("feature/witty-wolf-beta")
  })

  it("re-opens branch collection when stale forced branch previously failed admission", () => {
    expect(
      shouldCollectBetaMissionFields({
        session: { slug: "witty-wolf" },
        mission: {
          branchName: "feature/witty-wolf-beta",
          baseBranch: "cms",
          repoPath: "/repo",
          mainWorktreePath: "/repo",
          betaPath: "/repo-beta",
          runtimePolicy: "manual",
        },
        admission: {
          betaQuiz: {
            status: "failed",
            reflectionUsed: true,
            mismatchCount: 1,
            lastMismatches: [
              {
                field: "implementationBranch",
                expected: "feature/witty-wolf-beta",
                actual: "persistent-cron",
              },
            ],
          },
        },
      }),
    ).toBe(true)
  })

  it("does not reopen branch collection for healthy suggested branch authority", () => {
    expect(
      shouldCollectBetaMissionFields({
        session: { slug: "witty-wolf" },
        mission: {
          branchName: "feature/witty-wolf-beta",
          baseBranch: "cms",
          repoPath: "/repo",
          mainWorktreePath: "/repo",
          betaPath: "/repo-beta",
          runtimePolicy: "manual",
        },
        admission: {
          betaQuiz: {
            status: "pending",
            reflectionUsed: false,
            mismatchCount: 0,
            lastMismatches: [],
          },
        },
      }),
    ).toBe(false)
  })
})
