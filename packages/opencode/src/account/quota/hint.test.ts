import { describe, expect, it, mock } from "bun:test"

describe("quota hint routing", () => {
  it("does not fall back to active account when request accountId is absent", async () => {
    mock.module("../index", () => ({
      Account: {
        parseFamily(providerId: string) {
          return providerId
        },
      },
    }))

    const { getQuotaHint } = await import("./hint")
    const result = await getQuotaHint({ providerId: "openai", format: "footer" })

    expect(result).toEqual({
      family: "openai",
      accountId: undefined,
      hint: undefined,
    })
  })
})
