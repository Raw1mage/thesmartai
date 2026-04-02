import { describe, expect, it } from "bun:test"
import { convertToOpenAIResponsesInput, summarizeResponsesInputForDebug } from "./convert-to-openai-responses-input"

describe("convertToOpenAIResponsesInput", () => {
  it("omits stored item references during stateless replay", async () => {
    const result = await convertToOpenAIResponsesInput({
      prompt: [
        {
          role: "assistant",
          content: [
            {
              type: "text",
              text: "hello",
              providerOptions: { openai: { itemId: "msg_text" } },
            },
            {
              type: "reasoning",
              text: "trace",
              providerOptions: {
                copilot: {
                  itemId: "msg_reasoning",
                  reasoningEncryptedContent: "enc",
                },
              },
            },
            {
              type: "tool-call",
              toolCallId: "call_1",
              toolName: "test_tool",
              input: { ok: true },
              providerOptions: { openai: { itemId: "msg_tool_call" } },
            },
            {
              type: "tool-result",
              toolCallId: "call_2",
              toolName: "web_search",
              output: { type: "json", value: { ok: true } },
            },
          ],
        },
      ],
      systemMessageMode: "system",
      store: false,
    })

    expect(result.input).toEqual([
      {
        role: "assistant",
        content: [{ type: "output_text", text: "hello" }],
        id: undefined,
      },
      {
        type: "reasoning",
        encrypted_content: "enc",
        summary: [{ type: "summary_text", text: "trace" }],
      },
      {
        type: "function_call",
        call_id: "call_1",
        name: "test_tool",
        arguments: JSON.stringify({ ok: true }),
        id: undefined,
      },
    ])
    expect(result.warnings).toContainEqual({
      type: "other",
      message: "Results for OpenAI tool web_search are not sent to the API when store is false",
    })
  })

  it("keeps local shell replay without stored remote id when store is false", async () => {
    const result = await convertToOpenAIResponsesInput({
      prompt: [
        {
          role: "assistant",
          content: [
            {
              type: "tool-call",
              toolCallId: "call_shell",
              toolName: "local_shell",
              input: {
                action: {
                  type: "exec",
                  command: ["pwd"],
                },
              },
              providerOptions: { openai: { itemId: "msg_shell" } },
            },
          ],
        },
      ],
      systemMessageMode: "system",
      store: false,
      hasLocalShellTool: true,
    })

    expect(result.input).toEqual([
      {
        type: "local_shell_call",
        call_id: "call_shell",
        id: undefined,
        action: {
          type: "exec",
          command: ["pwd"],
          timeout_ms: undefined,
          user: undefined,
          working_directory: undefined,
          env: undefined,
        },
      },
    ])
  })

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

  it("summarizes response input ids and item references for debug output", () => {
    const summary = summarizeResponsesInputForDebug([
      {
        role: "assistant",
        content: [{ type: "output_text", text: "hello" }],
        id: "msg_text",
      },
      {
        type: "item_reference",
        id: "rs_123",
      },
      {
        type: "function_call",
        call_id: "call_1",
        name: "test_tool",
        arguments: "{}",
        id: undefined,
      },
    ])

    expect(summary).toEqual({
      inputCount: 3,
      idCount: 2,
      itemReferenceCount: 1,
      itemTypes: {
        "role:assistant": 1,
        item_reference: 1,
        function_call: 1,
      },
    })
  })
})
