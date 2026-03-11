import { MessageV2 } from "./message-v2"
import { Provider } from "../provider/provider"
import { Session } from "./index"

export async function lastModel(sessionID: string) {
  const session = await Session.get(sessionID).catch(() => undefined)
  if (session?.execution) {
    return {
      providerId: session.execution.providerId,
      modelID: session.execution.modelID,
      accountId: session.execution.accountId,
    }
  }
  for await (const item of MessageV2.stream(sessionID)) {
    if (item.info.role === "user" && item.info.model) return item.info.model
  }
  return Provider.defaultModel()
}
