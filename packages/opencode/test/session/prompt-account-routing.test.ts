import { afterEach, describe, expect, mock, spyOn, test } from "bun:test"
import { Instance } from "../../src/project/instance"
import { Session } from "../../src/session"
import { SessionPrompt } from "../../src/session/prompt"
import { LLM } from "../../src/session/llm"
import { tmpdir } from "../fixture/fixture"

describe("session.prompt account routing", () => {
  afterEach(() => {
    mock.restore()
  })

  test("passes session-scoped accountId into LLM stream input", async () => {
    let seenAccountId: string | undefined

    const streamSpy = spyOn(LLM, "stream").mockImplementation(async (input) => {
      seenAccountId = input.accountId
      return {
        fullStream: (async function* () {
          yield { type: "start" }
          yield { type: "start-step" }
          yield { type: "text-start", id: "text-1" }
          yield { type: "text-delta", id: "text-1", text: "ok" }
          yield { type: "text-end", id: "text-1" }
          yield {
            type: "finish-step",
            finishReason: "stop",
            usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
            providerMetadata: {},
          }
          yield { type: "finish" }
        })(),
      } as Awaited<ReturnType<typeof LLM.stream>>
    })

    await using tmp = await tmpdir({
      git: true,
      config: {
        agent: {
          build: {
            model: "openai/gpt-5.4",
          },
        },
      },
    })

    await Instance.provide({
      directory: tmp.path,
      fn: async () => {
        const session = await Session.create({})
        await SessionPrompt.prompt({
          sessionID: session.id,
          agent: "build",
          model: {
            providerId: "openai",
            modelID: "gpt-5.4",
            accountId: "openai-subscription-pincyluo-gmail-com",
          },
          parts: [{ type: "text", text: "Check routing" }],
        })
      },
    })

    expect(streamSpy).toHaveBeenCalled()
    expect(seenAccountId).toBe("openai-subscription-pincyluo-gmail-com")
  })
})
