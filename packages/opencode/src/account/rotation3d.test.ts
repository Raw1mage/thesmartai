import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test"

const tempStatePath = `/tmp/opencode-rotation3d-test-${Date.now()}`

describe("rotation3d cross-provider fallback candidates", () => {
  beforeEach(() => {
    mock.module("./index", () => ({
      Account: {
        resolveFamily: async (providerId: string) => providerId,
        list: async (family: string) => {
          if (family === "github-copilot") return { "github-sub": { type: "subscription", name: "github-sub" } }
          if (family === "openai") return { "openai-sub": { type: "subscription", name: "openai-sub" } }
          return {}
        },
      },
    }))

    mock.module("../provider/provider", () => ({
      Provider: {
        list: async () => ({
          "github-copilot": {
            id: "github-copilot",
            models: {
              "gpt-4o": { id: "gpt-4o", status: "active" },
            },
          },
          openai: {
            id: "openai",
            models: {
              "gpt-5": { id: "gpt-5", status: "active" },
              "gpt-5-mini": { id: "gpt-5-mini", status: "active" },
            },
          },
        }),
        sort: (models: Array<{ id: string; status?: string }>) => models,
      },
    }))

    mock.module("../global", () => ({
      Global: {
        Path: {
          state: tempStatePath,
          cache: tempStatePath,
          user: tempStatePath,
          data: tempStatePath,
          home: tempStatePath,
        },
      },
    }))

    mock.module("./openai_quota", () => ({
      getOpenAIQuotas: async () => ({}),
    }))
  })

  afterEach(() => {
    mock.restore()
  })

  it("includes connected cross-provider candidates even when favorites are absent", async () => {
    const { buildFallbackCandidates } = await import("./rotation3d")
    const candidates = await buildFallbackCandidates({
      providerId: "github-copilot",
      accountId: "github-sub",
      modelID: "gpt-4o",
    })

    expect(
      candidates.some(
        (candidate) =>
          candidate.providerId === "openai" &&
          candidate.accountId === "openai-sub" &&
          (candidate.modelID === "gpt-5" || candidate.modelID === "gpt-5-mini"),
      ),
    ).toBe(true)
  })
})
