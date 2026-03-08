import { describe, expect, test } from "bun:test"
import { tmpdir } from "../fixture/fixture"
import {
  createWorkspaceService,
  buildDerivedWorkspace,
  createInMemoryWorkspaceRegistry,
  normalizeWorkspaceDirectory,
  resolveWorkspaceViaService,
} from "../../src/project/workspace"

describe("project.workspace.service", () => {
  test("resolves and caches workspaces through service registry", async () => {
    await using tmp = await tmpdir({ git: true })
    const service = createWorkspaceService(createInMemoryWorkspaceRegistry())

    const first = await service.resolve({ directory: `${tmp.path}///` })
    const second = await service.getByDirectory(tmp.path)

    expect(second?.workspaceId).toBe(first.workspaceId)
    expect(second?.directory).toBe(normalizeWorkspaceDirectory(tmp.path))
  })

  test("register exposes manual upsert and project listing", async () => {
    const service = createWorkspaceService(createInMemoryWorkspaceRegistry())
    const workspace = buildDerivedWorkspace({
      projectId: "project-1",
      directory: "/tmp/workspace-derived",
    })

    await service.register(workspace)

    expect(await service.getById(workspace.workspaceId)).toEqual(workspace)
    expect((await service.listByProject("project-1")).map((item) => item.workspaceId)).toEqual([workspace.workspaceId])
  })

  test("resolveWorkspaceViaService uses provided service", async () => {
    await using tmp = await tmpdir({ git: true })
    const service = createWorkspaceService(createInMemoryWorkspaceRegistry())

    const workspace = await resolveWorkspaceViaService({
      directory: tmp.path,
      service,
    })

    expect(await service.getById(workspace.workspaceId)).toEqual(workspace)
  })
})
