import { describe, expect, test } from "bun:test"
import { getAssistantSyncedSessionModel, isNarrationAssistantMessageLike } from "./session-model-sync"

describe("session-model-sync", () => {
  test("syncs rotated assistant model and account into session-local selection", () => {
    expect(
      getAssistantSyncedSessionModel({
        assistant: {
          id: "a1",
          role: "assistant",
          providerId: "openai",
          modelID: "gpt-5.4",
          accountId: "openai-subscription-ivon0829-gmail-com",
        },
        lastUserModel: {
          providerId: "openai",
          modelID: "gpt-5.4",
          accountId: "openai-subscription-yeatsluo-gmail-com",
        },
        currentSelection: {
          providerID: "openai",
          modelID: "gpt-5.4",
          accountID: "openai-subscription-yeatsluo-gmail-com",
        },
      }),
    ).toEqual({
      providerID: "openai",
      modelID: "gpt-5.4",
      accountID: "openai-subscription-ivon0829-gmail-com",
    })
  })

  test("does not override when user already changed session-local selection away from last user model", () => {
    expect(
      getAssistantSyncedSessionModel({
        assistant: {
          id: "a1",
          role: "assistant",
          providerId: "openai",
          modelID: "gpt-5.4",
          accountId: "acct-rotated",
        },
        lastUserModel: {
          providerId: "openai",
          modelID: "gpt-5.4",
          accountId: "acct-original",
        },
        currentSelection: {
          providerID: "google-api",
          modelID: "gemini-2.5-flash",
          accountID: "acct-manual",
        },
      }),
    ).toBeUndefined()
  })

  test("does not treat autonomous narration as a model switch signal", () => {
    const narration = {
      id: "a2",
      role: "assistant",
      providerId: "openai",
      modelID: "gpt-5.4",
      accountId: "acct-ai",
    }
    const parts = [
      {
        type: "text",
        synthetic: true,
        metadata: {
          autonomousNarration: true,
          excludeFromModel: true,
        },
      },
    ]

    expect(isNarrationAssistantMessageLike(narration, parts)).toBe(true)
    expect(
      getAssistantSyncedSessionModel({
        assistant: narration,
        parts,
        lastUserModel: {
          providerId: "openai",
          modelID: "gpt-5.4",
          accountId: "acct-user",
        },
        currentSelection: {
          providerID: "openai",
          modelID: "gpt-5.4",
          accountID: "acct-user",
        },
      }),
    ).toBeUndefined()
  })
})
