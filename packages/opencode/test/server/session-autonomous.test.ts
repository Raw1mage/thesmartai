import { describe, expect, test } from "bun:test"
import path from "path"
import { Instance } from "../../src/project/instance"
import { Server } from "../../src/server/server"
import { Session } from "../../src/session"
import { Log } from "../../src/util/log"
import { Flag } from "../../src/flag/flag"
import { Identifier } from "../../src/id/id"

const projectRoot = path.join(__dirname, "../..")
Log.init({ print: false })

describe("session.autonomous", () => {
  test("enables autonomous workflow policy for a session", async () => {
    await Instance.provide({
      directory: projectRoot,
      fn: async () => {
        const app = Server.App()
        const session = await Session.create({})

        await Session.updateMessage({
          id: Identifier.ascending("message"),
          sessionID: session.id,
          role: "user",
          time: { created: Date.now() },
          agent: "build",
          model: { providerId: "openai", modelID: "gpt-5.2" },
          path: { cwd: projectRoot, root: projectRoot },
          variant: "high",
        })

        const response = await app.request(`/session/${session.id}/autonomous`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ enabled: true, enqueue: false }),
        })

        if (Flag.OPENCODE_SERVER_PASSWORD) {
          expect(response.status).toBe(401)
          return
        }

        expect(response.status).toBe(200)
        const body = (await response.json()) as { workflow?: { autonomous?: { enabled?: boolean } } }
        expect(body.workflow?.autonomous?.enabled).toBe(true)
      },
    })
  })

  test("enqueue synthetic continue when enabling autonomous on idle session", async () => {
    await Instance.provide({
      directory: projectRoot,
      fn: async () => {
        const app = Server.App()
        const session = await Session.create({})

        await Session.updateMessage({
          id: Identifier.ascending("message"),
          sessionID: session.id,
          role: "user",
          time: { created: Date.now() },
          agent: "build",
          model: { providerId: "openai", modelID: "gpt-5.2" },
          path: { cwd: projectRoot, root: projectRoot },
          variant: "high",
        })

        const response = await app.request(`/session/${session.id}/autonomous`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ enabled: true, enqueue: true }),
        })

        if (Flag.OPENCODE_SERVER_PASSWORD) {
          expect(response.status).toBe(401)
          return
        }

        expect(response.status).toBe(200)

        const messages = await Session.messages({ sessionID: session.id })

        const syntheticUser = [...messages]
          .reverse()
          .find(
            (message) =>
              message.info.role === "user" &&
              message.info.parts.some(
                (part) =>
                  part.type === "text" &&
                  part.synthetic === true &&
                  part.text.includes("Continue with the next planned step"),
              ),
          )

        expect(syntheticUser).toBeDefined()
      },
    })
  })
})
