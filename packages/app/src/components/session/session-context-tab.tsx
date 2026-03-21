import { createMemo, createEffect, on, onCleanup, For, Show } from "solid-js"
import type { JSX } from "solid-js"
import { useParams } from "@solidjs/router"
import { useSync } from "@/context/sync"
import { useLayout } from "@/context/layout"
import { findLast } from "@opencode-ai/util/array"
import { Markdown } from "@opencode-ai/ui/markdown"
import type { Message, Part, UserMessage } from "@opencode-ai/sdk/v2/client"
import { useLanguage } from "@/context/language"
import { getSessionContextMetrics } from "./session-context-metrics"
import { estimateSessionContextBreakdown, type SessionContextBreakdownKey } from "./session-context-breakdown"
import { createSessionContextFormatter } from "./session-context-format"
import type { SessionTelemetry } from "@/context/global-sync/types"
import { AccountQuotaReuseCard } from "@/pages/session/session-telemetry-cards"
import { useGlobalSync } from "@/context/global-sync"
import { resolveTelemetryAccountLabel } from "@/pages/session/session-telemetry-ui"

interface SessionContextTabProps {
  messages: () => Message[]
  visibleUserMessages: () => UserMessage[]
  view: () => ReturnType<ReturnType<typeof useLayout>["view"]>
  info: () => ReturnType<ReturnType<typeof useSync>["session"]["get"]>
  telemetry?: () => SessionTelemetry | undefined
}

const BREAKDOWN_COLOR: Record<SessionContextBreakdownKey, string> = {
  system: "var(--syntax-info)",
  user: "var(--syntax-success)",
  assistant: "var(--syntax-property)",
  tool: "var(--syntax-warning)",
  other: "var(--syntax-comment)",
}

function Stat(props: { label: string; value: JSX.Element }) {
  return (
    <div class="flex flex-col gap-1">
      <div class="text-12-regular text-text-weak">{props.label}</div>
      <div class="text-12-medium text-text-strong">{props.value}</div>
    </div>
  )
}

export function SessionContextTab(props: SessionContextTabProps) {
  const params = useParams()
  const sync = useSync()
  const globalSync = useGlobalSync()
  const language = useLanguage()

  const usd = createMemo(
    () =>
      new Intl.NumberFormat(language.intl(), {
        style: "currency",
        currency: "USD",
      }),
  )

  const metrics = createMemo(() => getSessionContextMetrics(props.messages(), sync.data.provider.all))
  const ctx = createMemo(() => metrics().context)
  const formatter = createMemo(() => createSessionContextFormatter(language.intl()))

  const cost = createMemo(() => {
    return usd().format(metrics().totalCost)
  })

  const counts = createMemo(() => {
    const all = props.messages()
    const user = all.reduce((count, x) => count + (x.role === "user" ? 1 : 0), 0)
    const assistant = all.reduce((count, x) => count + (x.role === "assistant" ? 1 : 0), 0)
    return {
      all: all.length,
      user,
      assistant,
    }
  })

  const systemPrompt = createMemo(() => {
    const msg = findLast(props.visibleUserMessages(), (m) => !!m.system)
    const system = msg?.system
    if (!system) return
    const trimmed = system.trim()
    if (!trimmed) return
    return trimmed
  })

  const providerLabel = createMemo(() => {
    const c = ctx()
    if (!c) return "—"
    return c.providerLabel
  })

  const modelLabel = createMemo(() => {
    const c = ctx()
    if (!c) return "—"
    return c.modelLabel
  })

  const breakdown = createMemo(
    on(
      () => [ctx()?.message.id, ctx()?.input, props.messages().length, systemPrompt()],
      () => {
        const c = ctx()
        if (!c?.input) return []
        return estimateSessionContextBreakdown({
          messages: props.messages(),
          parts: sync.data.part as Record<string, Part[] | undefined>,
          input: c.input,
          systemPrompt: systemPrompt(),
        })
      },
    ),
  )

  const breakdownLabel = (key: SessionContextBreakdownKey) => {
    if (key === "system") return language.t("context.breakdown.system")
    if (key === "user") return language.t("context.breakdown.user")
    if (key === "assistant") return language.t("context.breakdown.assistant")
    if (key === "tool") return language.t("context.breakdown.tool")
    return language.t("context.breakdown.other")
  }

  const stats = [
    { label: "context.stats.session", value: () => props.info()?.title ?? params.id ?? "—" },
    { label: "context.stats.messages", value: () => counts().all.toLocaleString(language.intl()) },
    { label: "context.stats.provider", value: providerLabel },
    { label: "context.stats.model", value: modelLabel },
    { label: "context.stats.limit", value: () => formatter().number(ctx()?.limit) },
    { label: "context.stats.totalTokens", value: () => formatter().number(ctx()?.total) },
    { label: "context.stats.usage", value: () => formatter().percent(ctx()?.usage) },
    { label: "context.stats.inputTokens", value: () => formatter().number(ctx()?.input) },
    { label: "context.stats.outputTokens", value: () => formatter().number(ctx()?.output) },
    { label: "context.stats.reasoningTokens", value: () => formatter().number(ctx()?.reasoning) },
    {
      label: "context.stats.cacheTokens",
      value: () => `${formatter().number(ctx()?.cacheRead)} / ${formatter().number(ctx()?.cacheWrite)}`,
    },
    { label: "context.stats.userMessages", value: () => counts().user.toLocaleString(language.intl()) },
    { label: "context.stats.assistantMessages", value: () => counts().assistant.toLocaleString(language.intl()) },
    { label: "context.stats.totalCost", value: cost },
    { label: "context.stats.sessionCreated", value: () => formatter().time(props.info()?.time.created) },
    { label: "context.stats.lastActivity", value: () => formatter().time(ctx()?.message.time.created) },
  ] satisfies { label: string; value: () => JSX.Element }[]

  const telemetry = createMemo(() => props.telemetry?.())
  const resolveAccountLabel = (accountId?: string, providerId?: string) =>
    resolveTelemetryAccountLabel(globalSync, accountId, providerId)
  const formatTelemetryNumber = (value?: number) =>
    typeof value === "number" && Number.isFinite(value) ? value.toLocaleString(language.intl()) : "—"
  const formatTelemetryDuration = (value?: number) => {
    if (typeof value !== "number" || !Number.isFinite(value)) return "—"
    if (value < 1000) return `${Math.round(value)} ms`
    if (value < 60_000) return `${(value / 1000).toFixed(1)} s`
    return `${(value / 60_000).toFixed(1)} min`
  }
  const roundIdentityLabel = createMemo(() => {
    const data = telemetry()
    if (!data) return "No provider metadata yet"
    const account = resolveAccountLabel(data.round.accountId, data.round.providerId)
    return (
      [data.round.providerId, account, data.round.modelId].filter((value): value is string => !!value).join(" / ") ||
      "No provider metadata yet"
    )
  })

  let scroll: HTMLDivElement | undefined
  let frame: number | undefined
  let pending: { x: number; y: number } | undefined
  const restoreScroll = () => {
    const el = scroll
    if (!el) return

    const s = props.view()?.scroll("context")
    if (!s) return

    if (el.scrollTop !== s.y) el.scrollTop = s.y
    if (el.scrollLeft !== s.x) el.scrollLeft = s.x
  }

  const handleScroll = (event: Event & { currentTarget: HTMLDivElement }) => {
    pending = {
      x: event.currentTarget.scrollLeft,
      y: event.currentTarget.scrollTop,
    }
    if (frame !== undefined) return

    frame = requestAnimationFrame(() => {
      frame = undefined

      const next = pending
      pending = undefined
      if (!next) return

      props.view().setScroll("context", next)
    })
  }

  createEffect(
    on(
      () => props.messages().length,
      () => {
        requestAnimationFrame(restoreScroll)
      },
      { defer: true },
    ),
  )

  onCleanup(() => {
    if (frame === undefined) return
    cancelAnimationFrame(frame)
  })

  return (
    <div
      class="@container h-full overflow-y-auto no-scrollbar pb-10"
      ref={(el) => {
        scroll = el
        restoreScroll()
      }}
      onScroll={handleScroll}
    >
      <div class="px-6 pt-4 flex flex-col gap-10">
        <div class="grid grid-cols-1 @[32rem]:grid-cols-2 gap-4">
          <For each={stats}>
            {(stat) => <Stat label={language.t(stat.label as Parameters<typeof language.t>[0])} value={stat.value()} />}
          </For>
        </div>

        <Show when={breakdown().length > 0}>
          <div class="flex flex-col gap-2">
            <div class="text-12-regular text-text-weak">{language.t("context.breakdown.title")}</div>
            <div class="h-2 w-full rounded-full bg-surface-base overflow-hidden flex">
              <For each={breakdown()}>
                {(segment) => (
                  <div
                    class="h-full"
                    style={{
                      width: `${segment.width}%`,
                      "background-color": BREAKDOWN_COLOR[segment.key],
                    }}
                  />
                )}
              </For>
            </div>
            <div class="flex flex-wrap gap-x-3 gap-y-1">
              <For each={breakdown()}>
                {(segment) => (
                  <div class="flex items-center gap-1 text-11-regular text-text-weak">
                    <div class="size-2 rounded-sm" style={{ "background-color": BREAKDOWN_COLOR[segment.key] }} />
                    <div>{breakdownLabel(segment.key)}</div>
                    <div class="text-text-weaker">{segment.percent.toLocaleString(language.intl())}%</div>
                  </div>
                )}
              </For>
            </div>
            <div class="hidden text-11-regular text-text-weaker">{language.t("context.breakdown.note")}</div>
          </div>
        </Show>

        <Show when={systemPrompt()}>
          {(prompt) => (
            <div class="flex flex-col gap-2">
              <div class="text-12-regular text-text-weak">{language.t("context.systemPrompt.title")}</div>
              <div class="border border-border-base rounded-md bg-surface-base px-3 py-2">
                <Markdown text={prompt()} class="text-12-regular" />
              </div>
            </div>
          )}
        </Show>

        <Show when={telemetry()}>
          {(data) => (
            <div class="flex flex-col gap-3">
              <div class="text-12-regular text-text-weak">Telemetry</div>
              <AccountQuotaReuseCard telemetry={data()} accountLabel={resolveAccountLabel} />
              <div class="grid grid-cols-1 @[32rem]:grid-cols-2 gap-4">
                <div class="rounded-md border border-border-weak-base bg-background-base px-3 py-3 flex flex-col gap-2">
                  <div class="text-12-medium text-text-strong">Prompt telemetry</div>
                  <div class="text-12-regular text-text-weak">
                    {data().summary.injectedCount} injected
                    {data().summary.skippedCount > 0 ? ` · ${data().summary.skippedCount} skipped` : ""}
                    {data().summary.estimatedPromptTokens > 0
                      ? ` · ~${formatTelemetryNumber(data().summary.estimatedPromptTokens)} tok`
                      : ""}
                  </div>
                  <Show
                    when={data().prompt.blocks.length > 0}
                    fallback={<div class="text-12-regular text-text-weak">No prompt telemetry yet.</div>}
                  >
                    <div class="flex flex-col gap-2">
                      <For each={data().prompt.blocks.slice(0, 6)}>
                        {(block) => (
                          <div class="rounded-md border border-border-weak-base bg-surface-panel px-2.5 py-2 flex flex-col gap-1">
                            <div class="text-11-medium text-text-strong break-words">{block.name}</div>
                            <div class="text-11-regular text-text-weak break-words">
                              {[block.sourceFile, block.kind, block.injectionPolicy]
                                .filter((value): value is string => !!value)
                                .join(" · ")}
                              {block.estimatedTokens ? ` · ~${formatTelemetryNumber(block.estimatedTokens)} tok` : ""}
                            </div>
                          </div>
                        )}
                      </For>
                    </div>
                  </Show>
                </div>

                <div class="rounded-md border border-border-weak-base bg-background-base px-3 py-3 flex flex-col gap-2">
                  <div class="text-12-medium text-text-strong">Round / session telemetry</div>
                  <div class="text-12-regular text-text-weaker break-words">
                    Current round fields are partially derived from session/message snapshots until authoritative A112
                    telemetry is exposed by the backend.
                  </div>
                  <div class="text-12-regular text-text-weak break-words">
                    Session {data().round.sessionId || "—"}
                    {data().round.roundIndex ? ` · Round ${data().round.roundIndex}` : ""}
                    {data().round.requestId ? ` · Req ${data().round.requestId}` : ""}
                  </div>
                  <div class="text-12-regular text-text-weak break-words">{roundIdentityLabel()}</div>
                  <div class="text-12-regular text-text-weak break-words">
                    Prompt {formatTelemetryNumber(data().round.promptTokens)} · Input{" "}
                    {formatTelemetryNumber(data().round.inputTokens)} · Response{" "}
                    {formatTelemetryNumber(data().round.responseTokens)}
                  </div>
                  <div class="text-12-regular text-text-weak break-words">
                    Cumulative {formatTelemetryNumber(data().sessionSummary.cumulativeTokens)} tok · Requests{" "}
                    {formatTelemetryNumber(data().sessionSummary.totalRequests)} · Duration{" "}
                    {formatTelemetryDuration(data().sessionSummary.durationMs)}
                  </div>
                </div>

                <Show when={data().quota.phase === "ready"}>
                  <div class="rounded-md border border-border-weak-base bg-background-base px-3 py-3 flex flex-col gap-2">
                    <div class="text-12-medium text-text-strong">Account / quota</div>
                    <div class="text-12-regular text-text-weaker break-words">
                      Reused from existing issue/quota signals; remaining-token quota fields are not yet available on
                      this surface.
                    </div>
                    <div class="text-12-regular text-text-weak break-words">
                      Pressure {data().quota.pressure}
                      {data().quota.providerId ? ` · ${data().quota.providerId}` : ""}
                      {data().quota.accountId ? ` / ${data().quota.accountId}` : ""}
                      {data().quota.modelId ? ` / ${data().quota.modelId}` : ""}
                    </div>
                    <Show
                      when={data().quota.activeIssues.length > 0}
                      fallback={<div class="text-12-regular text-text-weak">No active quota issues.</div>}
                    >
                      <div class="flex flex-col gap-2">
                        <For each={data().quota.activeIssues.slice(0, 4)}>
                          {(issue) => (
                            <div class="text-12-regular text-warning break-words">
                              {issue.type}: {issue.message}
                            </div>
                          )}
                        </For>
                      </div>
                    </Show>
                  </div>
                </Show>
              </div>
            </div>
          )}
        </Show>
      </div>
    </div>
  )
}
