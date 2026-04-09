import type { RootLoadArgs } from "./types"

export async function loadRootSessionsWithFallback(input: RootLoadArgs) {
  try {
    // Load ALL sessions (roots + children) so the UI can build the full
    // session tree after page reload / new tab.  The UI-side trimSessions()
    // already separates roots from children and applies its own limits.
    const result = await input.list({ directory: input.directory, limit: input.limit })
    return {
      data: result.data,
      limit: input.limit,
      limited: true,
    } as const
  } catch {
    input.onFallback()
    const result = await input.list({ directory: input.directory })
    return {
      data: result.data,
      limit: input.limit,
      limited: false,
    } as const
  }
}

export function estimateRootSessionTotal(input: { count: number; limit: number; limited: boolean }) {
  if (!input.limited) return input.count
  if (input.count < input.limit) return input.count
  return input.count + 1
}
