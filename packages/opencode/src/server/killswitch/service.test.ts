import { describe, expect, it } from "bun:test"
import { KillSwitchService } from "./service"

describe("KillSwitchService", () => {
  it("generates and verifies MFA", async () => {
    const requestID = await KillSwitchService.idempotentRequestID("tester", "reason", 1000)
    const code = await KillSwitchService.generateMfa(requestID, "tester")
    expect(code.length).toBe(6)
    const ok = await KillSwitchService.verifyMfa(requestID, "tester", code)
    expect(ok).toBe(true)
  })

  it("rejects stale seq", async () => {
    const requestID = await KillSwitchService.idempotentRequestID("tester", "seq-case", 1000)
    const sessionID = "ses_test_seq"
    const first = await KillSwitchService.publishControl({
      requestID,
      sessionID,
      seq: 100,
      action: "snapshot",
      initiator: "tester",
      timeoutMs: 2000,
    })
    expect(first.status).toBe("accepted")
    const second = await KillSwitchService.publishControl({
      requestID,
      sessionID,
      seq: 99,
      action: "snapshot",
      initiator: "tester",
      timeoutMs: 2000,
    })
    expect(second.status).toBe("rejected")
  })

  it("defaults control transport mode to local", () => {
    const prev = process.env.OPENCODE_KILLSWITCH_CONTROL_TRANSPORT
    delete process.env.OPENCODE_KILLSWITCH_CONTROL_TRANSPORT
    try {
      expect(KillSwitchService.resolveControlTransportMode()).toBe("local")
    } finally {
      if (prev === undefined) delete process.env.OPENCODE_KILLSWITCH_CONTROL_TRANSPORT
      else process.env.OPENCODE_KILLSWITCH_CONTROL_TRANSPORT = prev
    }
  })

  it("fails fast when redis control transport is selected without redis url", async () => {
    const prevMode = process.env.OPENCODE_KILLSWITCH_CONTROL_TRANSPORT
    const prevRedis = process.env.OPENCODE_REDIS_URL
    process.env.OPENCODE_KILLSWITCH_CONTROL_TRANSPORT = "redis"
    delete process.env.OPENCODE_REDIS_URL
    try {
      const requestID = await KillSwitchService.idempotentRequestID("tester", "redis-missing", 1000)
      await expect(
        KillSwitchService.publishControl({
          requestID,
          sessionID: "ses_test_redis",
          seq: 1,
          action: "snapshot",
          initiator: "tester",
          timeoutMs: 100,
        }),
      ).rejects.toThrow("OPENCODE_REDIS_URL")
    } finally {
      if (prevMode === undefined) delete process.env.OPENCODE_KILLSWITCH_CONTROL_TRANSPORT
      else process.env.OPENCODE_KILLSWITCH_CONTROL_TRANSPORT = prevMode
      if (prevRedis === undefined) delete process.env.OPENCODE_REDIS_URL
      else process.env.OPENCODE_REDIS_URL = prevRedis
    }
  })

  it("fails fast when minio snapshot backend is selected without required env", async () => {
    const prevBackend = process.env.OPENCODE_KILLSWITCH_SNAPSHOT_BACKEND
    const prevEndpoint = process.env.OPENCODE_MINIO_ENDPOINT
    const prevAK = process.env.OPENCODE_MINIO_ACCESS_KEY
    const prevSK = process.env.OPENCODE_MINIO_SECRET_KEY
    const prevBucket = process.env.OPENCODE_MINIO_BUCKET
    process.env.OPENCODE_KILLSWITCH_SNAPSHOT_BACKEND = "minio"
    delete process.env.OPENCODE_MINIO_ENDPOINT
    delete process.env.OPENCODE_MINIO_ACCESS_KEY
    delete process.env.OPENCODE_MINIO_SECRET_KEY
    delete process.env.OPENCODE_MINIO_BUCKET
    try {
      await expect(
        KillSwitchService.createSnapshotPlaceholder({
          requestID: "ks_req_minio_missing",
          initiator: "tester",
          mode: "global",
          scope: "global",
          reason: "test",
        }),
      ).rejects.toThrow("snapshot backend 'minio' selected")
    } finally {
      if (prevBackend === undefined) delete process.env.OPENCODE_KILLSWITCH_SNAPSHOT_BACKEND
      else process.env.OPENCODE_KILLSWITCH_SNAPSHOT_BACKEND = prevBackend
      if (prevEndpoint === undefined) delete process.env.OPENCODE_MINIO_ENDPOINT
      else process.env.OPENCODE_MINIO_ENDPOINT = prevEndpoint
      if (prevAK === undefined) delete process.env.OPENCODE_MINIO_ACCESS_KEY
      else process.env.OPENCODE_MINIO_ACCESS_KEY = prevAK
      if (prevSK === undefined) delete process.env.OPENCODE_MINIO_SECRET_KEY
      else process.env.OPENCODE_MINIO_SECRET_KEY = prevSK
      if (prevBucket === undefined) delete process.env.OPENCODE_MINIO_BUCKET
      else process.env.OPENCODE_MINIO_BUCKET = prevBucket
    }
  })
})
