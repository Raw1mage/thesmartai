export type SessionModelSelection = {
  providerID: string
  modelID: string
  accountID?: string
}

type SessionModelIdentity = {
  providerId?: string
  modelID?: string
  accountId?: string
}

type SessionAssistantMessageLike = SessionModelIdentity & {
  id?: string
  role?: string
}

type SessionPartLike = {
  type?: string
  synthetic?: boolean
  metadata?: {
    autonomousNarration?: boolean
    excludeFromModel?: boolean
  }
}

function modelSelectionKey(
  input?:
    | SessionModelIdentity
    | {
        providerID?: string
        modelID?: string
        accountID?: string
      },
) {
  if (!input) return "::"
  const normalized = input as {
    providerID?: string
    providerId?: string
    modelID?: string
    accountID?: string
    accountId?: string
  }
  const provider = normalized.providerID ?? normalized.providerId
  const account = normalized.accountID ?? normalized.accountId
  return `${provider ?? ""}:${input.modelID ?? ""}:${account ?? ""}`
}

export function isNarrationAssistantMessageLike(message: SessionAssistantMessageLike, parts: SessionPartLike[]) {
  if (message.role !== "assistant") return false
  if (parts.length === 0) return false
  return parts.every(
    (part) =>
      part.type === "text" &&
      part.synthetic === true &&
      part.metadata?.autonomousNarration === true &&
      part.metadata?.excludeFromModel === true,
  )
}

export function getAssistantSyncedSessionModel(input: {
  assistant?: SessionAssistantMessageLike
  parts?: SessionPartLike[]
  lastUserModel?: SessionModelIdentity
  currentSelection?: SessionModelSelection
}) {
  const assistant = input.assistant
  if (!assistant?.providerId || !assistant.modelID) return undefined
  if (assistant.role && assistant.role !== "assistant") return undefined
  if (isNarrationAssistantMessageLike(assistant, input.parts ?? [])) return undefined

  const lastUserModelKey = modelSelectionKey(input.lastUserModel)
  const currentSelectionKey = modelSelectionKey(input.currentSelection)
  if (lastUserModelKey && currentSelectionKey && currentSelectionKey !== lastUserModelKey) return undefined

  if (
    !assistant.accountId &&
    input.currentSelection?.accountID &&
    input.currentSelection.providerID === assistant.providerId &&
    input.currentSelection.modelID === assistant.modelID
  ) {
    return undefined
  }

  if (
    input.currentSelection?.providerID === assistant.providerId &&
    input.currentSelection.modelID === assistant.modelID &&
    input.currentSelection.accountID === assistant.accountId
  ) {
    return undefined
  }

  return {
    providerID: assistant.providerId,
    modelID: assistant.modelID,
    accountID: assistant.accountId,
  } satisfies SessionModelSelection
}
