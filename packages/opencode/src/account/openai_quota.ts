/**
 * Backward compatibility shim — re-exports from account/quota/openai.
 *
 * @event_20260216_quota_consolidation — moved to account/quota/openai.ts
 * @deprecated Import from "@/account/quota" instead.
 */
export { getOpenAIQuotas } from "./quota/openai"
export type { OpenAIQuota } from "./quota/openai"
