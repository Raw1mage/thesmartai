import z from "zod"
import { Storage } from "@/storage/storage"
import { Identifier } from "@/id/id"

export namespace RuntimeEventService {
  export const Level = z.enum(["info", "warn", "error"])
  export const Domain = z.enum(["runner", "workflow", "subagent", "mission", "anomaly"])

  export const Event = z.object({
    id: z.string(),
    ts: z.number(),
    level: Level,
    domain: Domain,
    eventType: z.string(),
    sessionID: Identifier.schema("session"),
    todoID: z.string().optional(),
    anomalyFlags: z.array(z.string()).default([]),
    payload: z.record(z.string(), z.any()).default({}),
  })
  export type Event = z.infer<typeof Event>

  function key(sessionID: string) {
    return ["session_runtime_event", sessionID]
  }

  export async function append(
    input: Omit<Event, "id" | "ts"> & {
      id?: string
      ts?: number
    },
  ) {
    const event = Event.parse({
      ...input,
      id: input.id ?? `rte_${Identifier.create("tool", false).slice(5)}`,
      ts: input.ts ?? Date.now(),
    })
    const existing = ((await Storage.read<Event[]>(key(event.sessionID)).catch(() => [] as Event[])) ?? []) as Event[]
    existing.push(event)
    await Storage.write(key(event.sessionID), existing)
    return event
  }

  export async function list(sessionID: string, input?: { limit?: number }) {
    const events = ((await Storage.read<Event[]>(key(sessionID)).catch(() => [] as Event[])) ?? []) as Event[]
    const sorted = [...events].sort((a, b) => a.ts - b.ts)
    if (!input?.limit) return sorted
    return sorted.slice(-input.limit)
  }

  export async function clear(sessionID: string) {
    await Storage.remove(key(sessionID)).catch(() => undefined)
  }
}
