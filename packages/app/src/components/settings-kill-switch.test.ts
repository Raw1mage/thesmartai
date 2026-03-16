import { describe, expect, test } from "bun:test"
import { buildTriggerPayload, normalizeKillSwitchStatus } from "./settings-kill-switch"

describe("settings kill-switch helpers", () => {
  test("normalizes status fields with API names", () => {
    const normalized = normalizeKillSwitchStatus({
      active: true,
      request_id: "ks_req_123",
      state: "soft_paused",
      snapshot_url: "local://killswitch/snapshot-ks_req_123.json",
    })

    expect(normalized).toEqual({
      active: true,
      requestID: "ks_req_123",
      state: "soft_paused",
      snapshotURL: "local://killswitch/snapshot-ks_req_123.json",
    })
  })

  test("builds trigger payload and keeps optional fields minimal", () => {
    expect(buildTriggerPayload({ reason: "incident" })).toEqual({ reason: "incident" })
    expect(buildTriggerPayload({ reason: "incident", requestID: "req-1", mfaCode: "123456" })).toEqual({
      reason: "incident",
      requestID: "req-1",
      mfaCode: "123456",
    })
  })
})
