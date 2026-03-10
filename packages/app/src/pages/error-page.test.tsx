import { describe, expect, test } from "bun:test"
import type { InitError } from "./error-format"
import { formatError } from "./error-format"

const t = (key: string, vars?: Record<string, string | number | boolean>) => {
  if (key === "error.chain.unknown") return "未知錯誤"
  if (key === "error.chain.causedBy") return "原因:"
  if (key === "error.chain.apiError") return "API 錯誤"
  if (key === "error.chain.status") return `狀態: ${vars?.status ?? ""}`
  if (key === "error.chain.retryable") return `可重試: ${vars?.retryable ?? ""}`
  if (key === "error.chain.responseBody") return `回應內容:\n${vars?.body ?? ""}`
  return key
}

describe("error page formatting", () => {
  test("surfaces unknown error summary and hints", () => {
    const error = {
      name: "UnknownError",
      data: {
        message:
          "An error occurred while processing your request. You can retry your request, or contact us through our help center at help.openai.com if the error persists. Please include the request ID 325e9e72-19d9-45d6-ac0d-8bf0d41aeadd in your message.",
        summary: "Provider openai returned an unknown error. Request ID 325e9e72-19d9-45d6-ac0d-8bf0d41aeadd.",
        hints: [
          "Request ID: 325e9e72-19d9-45d6-ac0d-8bf0d41aeadd",
          "Upstream provider asked for support escalation; include the request ID when reporting.",
        ],
      },
    } satisfies InitError

    expect(formatError(error, t)).toBe(
      [
        "UnknownError",
        "Provider openai returned an unknown error. Request ID 325e9e72-19d9-45d6-ac0d-8bf0d41aeadd.",
        "An error occurred while processing your request. You can retry your request, or contact us through our help center at help.openai.com if the error persists. Please include the request ID 325e9e72-19d9-45d6-ac0d-8bf0d41aeadd in your message.",
        "Request ID: 325e9e72-19d9-45d6-ac0d-8bf0d41aeadd",
        "Upstream provider asked for support escalation; include the request ID when reporting.",
      ].join("\n"),
    )
  })

  test("avoids duplicating unknown error message when summary matches", () => {
    const error = {
      name: "UnknownError",
      data: {
        message: "same text",
        summary: "same text",
      },
    } satisfies InitError

    expect(formatError(error, t)).toBe(["UnknownError", "same text"].join("\n"))
  })
})
