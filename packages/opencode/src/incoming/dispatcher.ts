// dispatcher.ts — placeholder. Phase 3 implements the full mcp tool stage-in /
// publish-out logic. Phase 1 only needs the namespace to exist so other
// modules can import it without dangling references.

import { Log } from "../util/log"

export namespace IncomingDispatcher {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const log = Log.create({ service: "incoming.dispatcher" })

  /** Phase 3 entry-point. Stub: returns args unchanged. */
  export async function before<A extends Record<string, unknown>>(
    _toolName: string,
    args: A,
    _appId: string,
  ): Promise<A> {
    return args
  }

  /** Phase 3 entry-point. Stub: returns result unchanged. */
  export async function after<R>(_toolName: string, result: R): Promise<R> {
    return result
  }
}
