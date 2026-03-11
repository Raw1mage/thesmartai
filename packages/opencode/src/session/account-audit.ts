import { debugCheckpoint } from "@/util/debug"

export type AccountAuditSource =
  | "session-pinned"
  | "user-message"
  | "active-account-fallback"
  | "rate-limit-fallback"
  | "temporary-error-fallback"
  | "permanent-error-fallback"
  | "assistant-persist"

export type AccountAuditPhase = "preflight" | "llm-start" | "fallback-switch" | "assistant-persist"

export function resolveAccountAuditSource(input: {
  explicitAccountId?: string
  userMessageAccountId?: string
  resolvedAccountId?: string
}): AccountAuditSource | undefined {
  if (input.explicitAccountId) return "session-pinned"
  if (input.userMessageAccountId) return "user-message"
  if (input.resolvedAccountId) return "active-account-fallback"
  return undefined
}

export function logSessionAccountAudit(input: {
  requestPhase: AccountAuditPhase
  sessionID: string
  userMessageID?: string
  assistantMessageID?: string
  providerId: string
  modelID: string
  accountId?: string
  source?: AccountAuditSource
  note?: string
  previousProviderId?: string
  previousModelID?: string
  previousAccountId?: string
  fallbackAttempts?: number
  error?: string
}) {
  debugCheckpoint("audit.identity", "session.request.identity.selected", {
    sessionID: input.sessionID,
    userMessageID: input.userMessageID,
    assistantMessageID: input.assistantMessageID,
    providerId: input.providerId,
    modelID: input.modelID,
    accountId: input.accountId,
    requestPhase: input.requestPhase,
    source: input.source,
    note: input.note,
    previousProviderId: input.previousProviderId,
    previousModelID: input.previousModelID,
    previousAccountId: input.previousAccountId,
    fallbackAttempts: input.fallbackAttempts,
    error: input.error,
  })
}
