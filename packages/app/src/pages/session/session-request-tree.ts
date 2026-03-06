import type { PermissionRequest, QuestionRequest, Session } from "@opencode-ai/sdk/v2"

function sessionTreeRequest<T>(
  sessions: Session[],
  requestBySession: Record<string, T[] | undefined>,
  sessionID?: string,
  include: (item: T) => boolean = () => true,
) {
  if (!sessionID) return

  const children = sessions.reduce((acc, session) => {
    if (!session.parentID) return acc
    const list = acc.get(session.parentID)
    if (list) list.push(session.id)
    else acc.set(session.parentID, [session.id])
    return acc
  }, new Map<string, string[]>())

  const seen = new Set<string>([sessionID])
  const queue = [sessionID]

  for (const id of queue) {
    const list = children.get(id)
    if (!list) continue
    for (const child of list) {
      if (seen.has(child)) continue
      seen.add(child)
      queue.push(child)
    }
  }

  const match = queue.find((id) => requestBySession[id]?.some(include))
  if (!match) return
  return requestBySession[match]?.find(include)
}

export function sessionPermissionRequest(
  sessions: Session[],
  requestBySession: Record<string, PermissionRequest[] | undefined>,
  sessionID?: string,
  include?: (item: PermissionRequest) => boolean,
) {
  return sessionTreeRequest(sessions, requestBySession, sessionID, include)
}

export function sessionQuestionRequest(
  sessions: Session[],
  requestBySession: Record<string, QuestionRequest[] | undefined>,
  sessionID?: string,
  include?: (item: QuestionRequest) => boolean,
) {
  return sessionTreeRequest(sessions, requestBySession, sessionID, include)
}
