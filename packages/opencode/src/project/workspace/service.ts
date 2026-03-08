import type { WorkspaceAggregate } from "./types"
import { createInMemoryWorkspaceRegistry, type WorkspaceRegistry } from "./registry"
import { normalizeWorkspaceDirectory } from "./identity"
import { resolveWorkspace, resolveWorkspaceWithRegistry } from "./resolver"

export interface WorkspaceService {
  registry: WorkspaceRegistry
  resolve(input: { directory: string }): Promise<WorkspaceAggregate>
  register(workspace: WorkspaceAggregate): Promise<WorkspaceAggregate>
  getByDirectory(directory: string): Promise<WorkspaceAggregate | undefined>
  getById(workspaceId: string): Promise<WorkspaceAggregate | undefined>
  listByProject(projectId: string): Promise<WorkspaceAggregate[]>
}

export function createWorkspaceService(
  registry: WorkspaceRegistry = createInMemoryWorkspaceRegistry(),
): WorkspaceService {
  return {
    registry,
    resolve(input) {
      return resolveWorkspaceWithRegistry({
        directory: input.directory,
        registry,
      })
    },
    register(workspace) {
      return registry.upsert(workspace)
    },
    getByDirectory(directory) {
      return registry.getByDirectory(normalizeWorkspaceDirectory(directory))
    },
    getById(workspaceId) {
      return registry.getById(workspaceId)
    },
    listByProject(projectId) {
      return registry.listByProject(projectId)
    },
  }
}

export const WorkspaceService = createWorkspaceService()

export async function resolveWorkspaceViaService(input: { directory: string; service?: WorkspaceService }) {
  const service = input.service ?? WorkspaceService
  return service.resolve({ directory: input.directory })
}

export async function resolveWorkspaceDirect(input: { directory: string }) {
  return resolveWorkspace(input)
}
