import { describe, expect, test } from "bun:test"
import { fetchWorkspaceCurrent, fetchWorkspaceStatus } from "./bootstrap"

describe("global-sync workspace bootstrap helpers", () => {
  test("fetchWorkspaceCurrent reads workspace snapshot from runtime API", async () => {
    const fetchMock = Object.assign(
      async () =>
        new Response(
          JSON.stringify({
            workspaceId: "workspace:1",
            directory: "/repo",
            kind: "root",
          }),
          { status: 200 },
        ),
      { preconnect: fetch.preconnect },
    ) as typeof fetch

    await expect(fetchWorkspaceCurrent({ baseUrl: "http://localhost:4096", fetch: fetchMock })).resolves.toEqual({
      workspaceId: "workspace:1",
      directory: "/repo",
      kind: "root",
    })
  })

  test("fetchWorkspaceStatus reads workspace summary from runtime API", async () => {
    const fetchMock = Object.assign(
      async () =>
        new Response(
          JSON.stringify({
            projectId: "project-1",
            total: 2,
            kinds: { root: 1, sandbox: 1, derived: 0 },
            attachments: { sessions: 3, ptys: 1, previews: 0, workers: 0 },
          }),
          { status: 200 },
        ),
      { preconnect: fetch.preconnect },
    ) as typeof fetch

    await expect(fetchWorkspaceStatus({ baseUrl: "http://localhost:4096", fetch: fetchMock })).resolves.toEqual({
      projectId: "project-1",
      total: 2,
      kinds: { root: 1, sandbox: 1, derived: 0 },
      attachments: { sessions: 3, ptys: 1, previews: 0, workers: 0 },
    })
  })

  test("workspace helpers no-op when fetch context is unavailable", async () => {
    await expect(fetchWorkspaceCurrent({})).resolves.toBeUndefined()
    await expect(fetchWorkspaceStatus({})).resolves.toBeUndefined()
  })
})
