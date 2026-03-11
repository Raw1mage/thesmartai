import { describe, expect, it } from "bun:test"
import { convertToOpenAIResponsesInput } from "./convert-to-openai-responses-input"

describe("convertToOpenAIResponsesInput", () => {
  it("drops oversized ids when building responses input", async () => {
    const tooLong = "x".repeat(65)
    const result = await convertToOpenAIResponsesInput({
      prompt: [
        {
          role: "assistant",
          content: [
            {
              type: "text",
              text: "hello",
              providerOptions: { openai: { itemId: tooLong } },
            },
            {
              type: "reasoning",
              text: "trace",
              providerOptions: { copilot: { itemId: tooLong } },
            },
          ],
        },
      ],
      systemMessageMode: "system",
      store: true,
    })

    expect(result.input).toEqual([
      {
        role: "assistant",
        content: [{ type: "output_text", text: "hello" }],
        id: undefined,
      },
    ])
    expect(result.warnings.length).toBeGreaterThan(0)
  })
})
