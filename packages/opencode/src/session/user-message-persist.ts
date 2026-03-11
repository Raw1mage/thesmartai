import { Plugin } from "../plugin"
import { Session } from "."
import { MessageV2 } from "./message-v2"

export async function persistUserMessage(input: {
  info: MessageV2.Info
  parts: MessageV2.Part[]
  sessionID: string
  agent?: string
  model?: {
    providerId: string
    modelID: string
    accountId?: string
  }
  messageID?: string
  variant?: string
}) {
  await Plugin.trigger(
    "chat.message",
    {
      sessionID: input.sessionID,
      agent: input.agent,
      model: input.model,
      messageID: input.messageID,
      variant: input.variant,
    },
    {
      message: input.info,
      parts: input.parts,
    },
  )

  await Session.updateMessage(input.info)
  if (input.info.role === "user" && input.info.model) {
    await Session.pinExecutionIdentity({
      sessionID: input.sessionID,
      model: input.info.model,
    })
  }
  for (const part of input.parts) {
    await Session.updatePart(part)
  }
}
