import { Instance } from "../project/instance"
import { MessageV2 } from "./message-v2"
import { Session } from "."
import { SessionStatus } from "./status"

type RuntimeEntry = {
  abort: AbortController
  callbacks: {
    resolve(input: MessageV2.WithParts): void
    reject(reason?: any): void
  }[]
}

const state = Instance.state(
  () => {
    const data: Record<string, RuntimeEntry> = {}
    return data
  },
  async (current) => {
    for (const item of Object.values(current)) {
      item.abort.abort()
    }
  },
)

export function assertNotBusy(sessionID: string) {
  const match = state()[sessionID]
  if (match) throw new Session.BusyError(sessionID)
}

export function start(sessionID: string) {
  const s = state()
  if (s[sessionID]) return
  const controller = new AbortController()
  s[sessionID] = {
    abort: controller,
    callbacks: [],
  }
  return controller.signal
}

export function enqueueCallback(
  sessionID: string,
  callback: {
    resolve(input: MessageV2.WithParts): void
    reject(reason?: any): void
  },
) {
  const s = state()
  if (!s[sessionID]) {
    throw new Error(`No runtime session for ${sessionID}`)
  }
  s[sessionID].callbacks.push(callback)
}

export function consumeCallbacks(sessionID: string) {
  const s = state()
  return s[sessionID]?.callbacks ?? []
}

export function cancel(sessionID: string) {
  const s = state()
  const match = s[sessionID]
  if (!match) {
    SessionStatus.set(sessionID, { type: "idle" })
    return
  }
  match.abort.abort()
  delete s[sessionID]
  SessionStatus.set(sessionID, { type: "idle" })
}
