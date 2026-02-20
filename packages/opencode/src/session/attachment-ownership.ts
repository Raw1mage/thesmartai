import { Identifier } from "@/id/id"
import { MessageV2 } from "./message-v2"

export function materializeToolAttachments(
  input: Omit<MessageV2.FilePart, "id" | "messageID" | "sessionID">[] | undefined,
  target: { sessionID: string; messageID: string },
) {
  return input?.map((attachment) => ({
    ...attachment,
    id: Identifier.ascending("part"),
    messageID: target.messageID,
    sessionID: target.sessionID,
  }))
}
