import { describe, expect, test } from "bun:test"
import { formatHttpError, formatTriggerResponse } from "../../src/cli/cmd/killswitch"

describe("killswitch cli helpers", () => {
  test("formatTriggerResponse prints explicit MFA challenge fields", () => {
    const lines = formatTriggerResponse({
      ok: true,
      mfa_required: true,
      request_id: "ks_req_123",
    })

    expect(lines[0]).toContain("MFA challenge required")
    expect(lines).toContain("mfa_required: true")
    expect(lines).toContain("request_id: ks_req_123")
  })

  test("formatHttpError preserves explicit server fields", () => {
    const message = formatHttpError(401, "Unauthorized", {
      error: "mfa_invalid",
      request_id: "ks_req_123",
      reason: "bad_code",
    })

    expect(message).toContain("401 Unauthorized")
    expect(message).toContain("mfa_invalid")
    expect(message).toContain("bad_code")
  })
})
