import { test as base, expect } from "@playwright/test"
import { createSdk, dirSlug, getWorktree, promptSelector, serverUrl, sessionPath } from "./utils"

type TestFixtures = {
  sdk: ReturnType<typeof createSdk>
  gotoSession: (sessionID?: string) => Promise<void>
}

type WorkerFixtures = {
  directory: string
  slug: string
}

export const test = base.extend<TestFixtures, WorkerFixtures>({
  directory: [
    async ({}, use) => {
      const directory = await getWorktree()
      await use(directory)
    },
    { scope: "worker" },
  ],
  slug: [
    async ({ directory }, use) => {
      await use(dirSlug(directory))
    },
    { scope: "worker" },
  ],
  sdk: async ({ directory }, use) => {
    await use(createSdk(directory))
  },
  gotoSession: async ({ page, directory }, use) => {
    page.on("console", (msg) => {
      if (msg.type() === "log") console.log(`[BROWSER LOG] ${msg.text()}`)
      if (msg.type() === "error") console.error(`[BROWSER ERROR] ${msg.text()}`)
    })
    await page.addInitScript(
      (input: { directory: string; serverUrl: string }) => {
        localStorage.setItem(
          "opencode.global.dat:model",
          JSON.stringify({
            user: [{ providerId: "opencode", modelID: "gpt-5-nano", visibility: "show" }],
            recent: [{ providerId: "opencode", modelID: "gpt-5-nano" }],
            variant: {},
          }),
        )
        const key = "opencode.global.dat:server"

        const raw = localStorage.getItem(key)
        const parsed = (() => {
          if (!raw) return undefined
          try {
            return JSON.parse(raw) as unknown
          } catch {
            return undefined
          }
        })()

        const store = parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : {}
        const list = Array.isArray(store.list) ? store.list : []
        const lastProject = store.lastProject && typeof store.lastProject === "object" ? store.lastProject : {}
        const projects = store.projects && typeof store.projects === "object" ? store.projects : {}
        const nextProjects = { ...(projects as Record<string, unknown>) }

        const add = (origin: string) => {
          const current = nextProjects[origin]
          const items = Array.isArray(current) ? current : []
          const existing = items.filter(
            (p): p is { worktree: string; expanded?: boolean } =>
              !!p &&
              typeof p === "object" &&
              "worktree" in p &&
              typeof (p as { worktree?: unknown }).worktree === "string",
          )

          if (existing.some((p) => p.worktree === input.directory)) return
          nextProjects[origin] = [{ worktree: input.directory, expanded: true }, ...existing]
        }

        add("local")
        add(input.serverUrl)

        localStorage.setItem(
          key,
          JSON.stringify({
            list,
            projects: nextProjects,
            lastProject,
          }),
        )
      },
      { directory, serverUrl },
    )

    const gotoSession = async (sessionID?: string) => {
      await page.goto(sessionPath(directory, sessionID))
      await expect(page.locator(promptSelector)).toBeVisible()
    }
    await use(gotoSession)
  },
})

export { expect }
