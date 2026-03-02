import { Context } from "@/util/context"

type RequestUserContext = {
  username?: string
}

const context = Context.create<RequestUserContext>("request-user")

export namespace RequestUser {
  export function provide<T>(username: string | undefined, fn: () => T) {
    return context.provide({ username }, fn)
  }

  export function username() {
    try {
      return context.use().username
    } catch {
      return undefined
    }
  }
}
