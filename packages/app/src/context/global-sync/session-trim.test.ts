import { describe, expect, test } from "bun:test"
import type { PermissionRequest, Session } from "@opencode-ai/sdk/v2/client"
import { trimSessions } from "./session-trim"

const session = (input: { id: string; parentID?: string; created: number; updated?: number; archived?: number }) =>
  ({
    id: input.id,
    parentID: input.parentID,
    time: {
      created: input.created,
      updated: input.updated,
      archived: input.archived,
    },
  }) as Session

describe("trimSessions", () => {
  test("keeps base roots and recent roots beyond the limit", () => {
    const now = 1_000_000
    const list = [
      session({ id: "a", created: now - 100_000 }),
      session({ id: "b", created: now - 90_000 }),
      session({ id: "c", created: now - 80_000 }),
      session({ id: "d", created: now - 70_000, updated: now - 1_000 }),
      session({ id: "e", created: now - 60_000, archived: now - 10 }),
    ]

    const result = trimSessions(list, { limit: 2, permission: {}, now })
    expect(result.map((x) => x.id)).toEqual(["a", "b", "c", "d"])
  })

  test("base slots prioritize most recently updated sessions", () => {
    const now = 100_000_000
    // SESSION_RECENT_WINDOW = 14_400_000 (4 hours)
    const list = [
      session({ id: "old-1", created: now - 20_000_000 }), // >4h ago, ID sorts first
      session({ id: "old-2", created: now - 18_000_000 }), // >4h ago
      session({ id: "today-1", created: now - 10_000, updated: now - 5_000 }), // recent
      session({ id: "today-2", created: now - 8_000, updated: now - 3_000 }), // recent
      session({ id: "today-3", created: now - 6_000, updated: now - 1_000 }), // most recent
    ]

    // With limit=3, base should pick the 3 most recent (today-3, today-2, today-1)
    // remaining old-1 and old-2 are outside the 4h window, so NOT picked by takeRecentSessions
    const result = trimSessions(list, { limit: 3, permission: {}, now })
    expect(result.map((x) => x.id)).toEqual(["today-1", "today-2", "today-3"])
  })

  test("keeps children when root is kept, permission exists, or child is recent", () => {
    const now = 1_000_000
    const list = [
      session({ id: "root-1", created: now - 1000 }),
      session({ id: "root-2", created: now - 2000 }),
      session({ id: "z-root", created: now - 30_000_000 }),
      session({ id: "child-kept-by-root", parentID: "root-1", created: now - 20_000_000 }),
      session({ id: "child-kept-by-permission", parentID: "z-root", created: now - 20_000_000 }),
      session({ id: "child-kept-by-recency", parentID: "z-root", created: now - 500 }),
      session({ id: "child-trimmed", parentID: "z-root", created: now - 20_000_000 }),
    ]

    const result = trimSessions(list, {
      limit: 2,
      permission: {
        "child-kept-by-permission": [{ id: "perm-1" } as PermissionRequest],
      },
      now,
    })

    expect(result.map((x) => x.id)).toEqual([
      "child-kept-by-permission",
      "child-kept-by-recency",
      "child-kept-by-root",
      "root-1",
      "root-2",
    ])
  })
})
