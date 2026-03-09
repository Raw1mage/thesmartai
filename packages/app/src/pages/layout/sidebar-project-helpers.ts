import { workspaceKey } from "./helpers"

export const projectSelected = (currentDir: string, directories: string[]) => {
  const key = workspaceKey(currentDir)
  return directories.some((directory) => workspaceKey(directory) === key)
}

export const projectTileActive = (args: {
  menu: boolean
  preview: boolean
  open: boolean
  overlay: boolean
  hoverProject?: string
  worktree: string
}) => args.menu || (args.preview ? args.open : args.overlay && args.hoverProject === args.worktree)
