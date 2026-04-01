import { describe, expect, test } from "bun:test"
import { buildUsersFromRemotePreferences, normalizePreferenceProviderFamily } from "./model-preferences"

describe("model preferences normalization", () => {
  test("keeps anthropic distinct from claude-cli", () => {
    expect(normalizePreferenceProviderFamily("anthropic")).toBe("anthropic")
    expect(normalizePreferenceProviderFamily("claude-cli")).toBe("claude-cli")
  })

  test("does not merge anthropic favorites into claude-cli", () => {
    const users = buildUsersFromRemotePreferences({
      favorite: [
        { providerId: "anthropic", modelID: "claude-sonnet-4" },
        { providerId: "claude-cli", modelID: "claude-sonnet-4" },
      ],
      hidden: [],
    })

    expect(users).toEqual([
      {
        providerID: "anthropic",
        modelID: "claude-sonnet-4",
        visibility: "show",
        favorite: true,
      },
      {
        providerID: "claude-cli",
        modelID: "claude-sonnet-4",
        visibility: "show",
        favorite: true,
      },
    ])
  })
})
