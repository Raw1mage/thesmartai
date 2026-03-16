import { beforeAll, beforeEach, describe, expect, it, mock } from "bun:test"
import z from "zod"

type AckLike = {
  requestID: string
  sessionID: string
  seq: number
  status: "accepted" | "rejected" | "error"
  reason?: string
  timestamp: number
}

let currentRequestUser: string | undefined = "tester"
let webAuthEnabled = false
let webAuthOperator: string | undefined = "tester"
let globalPermissionConfig: Record<string, any> | undefined

const checkCooldown = mock(async () => ({ ok: true, remainingMs: 0 }))
const idempotentRequestID = mock(async () => "ks_req_1")
const generateMfa = mock(async () => "123456")
const writeAudit = mock(async () => undefined)
const verifyMfa = mock(async () => true)
const createSnapshotPlaceholder = mock(async () => "local://killswitch/snapshot-ks_req_1.json")
const setState = mock(async () => undefined)
const getState = mock(async () => undefined)
const clearState = mock(async () => undefined)
const listBusySessionIDs = mock(() => [] as string[])
const publishControl = mock(
  async (..._args: any[]): Promise<AckLike> => ({
    requestID: "ks_req_1",
    sessionID: "ses_test",
    seq: Date.now(),
    status: "accepted" as const,
    timestamp: Date.now(),
  }),
)
const forceKill = mock(async () => undefined)

mock.module("../killswitch/service", () => ({
  KillSwitchService: {
    checkCooldown,
    idempotentRequestID,
    generateMfa,
    writeAudit,
    verifyMfa,
    createSnapshotPlaceholder,
    setState,
    getState,
    clearState,
    listBusySessionIDs,
    publishControl,
    forceKill,
  },
}))

mock.module("@/runtime/request-user", () => ({
  RequestUser: {
    username: () => currentRequestUser,
  },
}))

mock.module("../web-auth", () => ({
  WebAuth: {
    enabled: () => webAuthEnabled,
    username: () => webAuthOperator,
  },
}))

mock.module("@/config/config", () => ({
  Config: {
    getGlobal: async () => ({
      permission: globalPermissionConfig,
    }),
  },
}))

mock.module("@/session", () => ({
  Session: {
    get: {
      schema: z.string().startsWith("ses"),
    },
  },
}))

let KillSwitchRoutes: typeof import("./killswitch").KillSwitchRoutes

describe("KillSwitchRoutes", () => {
  beforeAll(async () => {
    ;({ KillSwitchRoutes } = await import("./killswitch"))
  })

  beforeEach(() => {
    currentRequestUser = "tester"
    webAuthEnabled = false
    webAuthOperator = "tester"
    globalPermissionConfig = {
      kill_switch: {
        trigger: "allow",
      },
      "kill_switch.trigger": "allow",
    }

    checkCooldown.mockReset()
    idempotentRequestID.mockReset()
    generateMfa.mockReset()
    writeAudit.mockReset()
    verifyMfa.mockReset()
    createSnapshotPlaceholder.mockReset()
    setState.mockReset()
    getState.mockReset()
    clearState.mockReset()
    listBusySessionIDs.mockReset()
    publishControl.mockReset()
    forceKill.mockReset()

    checkCooldown.mockImplementation(async () => ({ ok: true, remainingMs: 0 }))
    idempotentRequestID.mockImplementation(async () => "ks_req_1")
    generateMfa.mockImplementation(async () => "123456")
    writeAudit.mockImplementation(async () => undefined)
    verifyMfa.mockImplementation(async () => true)
    createSnapshotPlaceholder.mockImplementation(async () => "local://killswitch/snapshot-ks_req_1.json")
    setState.mockImplementation(async () => undefined)
    getState.mockImplementation(async () => undefined)
    clearState.mockImplementation(async () => undefined)
    listBusySessionIDs.mockImplementation(() => [])
    publishControl.mockImplementation(
      async (): Promise<AckLike> => ({
        requestID: "ks_req_1",
        sessionID: "ses_test",
        seq: Date.now(),
        status: "accepted" as const,
        timestamp: Date.now(),
      }),
    )
    forceKill.mockImplementation(async () => undefined)
  })

  it("returns inactive status when no active state exists", async () => {
    const app = KillSwitchRoutes()
    const res = await app.request("http://localhost/status")
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body).toMatchObject({
      ok: true,
      active: false,
      initiator: null,
    })
  })

  it("requires MFA challenge on trigger without mfaCode", async () => {
    const app = KillSwitchRoutes()
    const res = await app.request("http://localhost/trigger", {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        reason: "incident",
      }),
    })
    const body = await res.json()

    expect(res.status).toBe(202)
    expect(body.ok).toBe(true)
    expect(body.mfa_required).toBe(true)
    expect(body.request_id).toBe("ks_req_1")
    expect(generateMfa).toHaveBeenCalledTimes(1)
  })

  it("falls back to force-kill when ACK is rejected or timeout", async () => {
    listBusySessionIDs.mockImplementation(() => ["ses_a", "ses_b"])
    publishControl.mockImplementation(async (input: { sessionID: string }) => {
      if (input.sessionID === "ses_a") {
        return {
          requestID: "ks_req_1",
          sessionID: "ses_a",
          seq: Date.now(),
          status: "rejected" as const,
          reason: "busy",
          timestamp: Date.now(),
        }
      }
      throw new Error("ACK timeout")
    })

    const app = KillSwitchRoutes()
    const res = await app.request("http://localhost/trigger", {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        reason: "incident",
        mfaCode: "123456",
      }),
    })
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.ok).toBe(true)
    expect(forceKill).toHaveBeenCalledTimes(2)
    expect(setState).toHaveBeenCalledTimes(1)
  })

  it("returns 401 when operator auth is enabled but request user missing", async () => {
    webAuthEnabled = true
    currentRequestUser = undefined

    const app = KillSwitchRoutes()
    const res = await app.request("http://localhost/trigger", {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({ reason: "incident" }),
    })
    const body = await res.json()

    expect(res.status).toBe(401)
    expect(body).toMatchObject({ ok: false, error: "auth_required" })
  })

  it("returns 403 when request user does not match configured operator", async () => {
    webAuthEnabled = true
    webAuthOperator = "root"
    currentRequestUser = "tester"

    const app = KillSwitchRoutes()
    const res = await app.request("http://localhost/trigger", {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({ reason: "incident" }),
    })
    const body = await res.json()

    expect(res.status).toBe(403)
    expect(body).toMatchObject({ ok: false, error: "forbidden", reason: "operator_mismatch" })
  })

  it("returns 403 when capability kill_switch.trigger is not allowed", async () => {
    webAuthEnabled = true
    webAuthOperator = "tester"
    currentRequestUser = "tester"
    globalPermissionConfig = {
      "kill_switch.trigger": "deny",
    }

    const app = KillSwitchRoutes()
    const res = await app.request("http://localhost/trigger", {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({ reason: "incident" }),
    })
    const body = await res.json()

    expect(res.status).toBe(403)
    expect(body).toMatchObject({
      ok: false,
      error: "forbidden",
      reason: "capability_denied",
      permission: "kill_switch.trigger",
      action: "deny",
    })
  })

  it("force-kills on rejected task control ACK", async () => {
    publishControl.mockImplementation(async (..._args: any[]) => ({
      requestID: "ks_req_1",
      sessionID: "ses_task_1",
      seq: Date.now(),
      status: "rejected" as const,
      reason: "seq_not_higher",
      timestamp: Date.now(),
    }))

    const app = KillSwitchRoutes()
    const res = await app.request("http://localhost/tasks/ses_task_1/control", {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({ action: "cancel" }),
    })
    const body = await res.json()

    expect(res.status).toBe(502)
    expect(body.ok).toBe(false)
    expect(body.error).toBe("worker_ack_rejected")
    expect(forceKill).toHaveBeenCalledTimes(1)
  })

  it("cancels kill-switch state", async () => {
    const app = KillSwitchRoutes()
    const res = await app.request("http://localhost/cancel", {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({}),
    })
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.ok).toBe(true)
    expect(clearState).toHaveBeenCalledTimes(1)
  })
})
