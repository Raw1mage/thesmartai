import { For, Show, type JSX } from "solid-js"
import type { SessionTelemetry } from "@/context/global-sync/types"

const tokenLine = (label: string, value?: number) => {
  if (value === undefined || value <= 0) return undefined
  return `${label} ~${value.toLocaleString()} tok`
}

const compactLine = (label: string, active: boolean, detail?: string) => {
  if (!active && !detail) return undefined
  return `${label} ${active ? "active" : (detail ?? "recorded")}`
}

function telemetryFallback(
  phase: SessionTelemetry["promptPhase"] | SessionTelemetry["roundPhase"],
  empty: string,
  error?: string,
) {
  if (phase === "loading") return "Loading telemetry…"
  if (phase === "error") return error ?? "Telemetry unavailable."
  if (phase === "disabled") return "Telemetry unavailable for this session."
  return empty
}

function quotaFallback(phase: SessionTelemetry["quota"]["phase"], empty: string, error?: string) {
  if (phase === "loading") return "Loading quota telemetry…"
  if (phase === "error") return error ?? "Quota telemetry unavailable."
  if (phase === "disabled") return "Quota telemetry unavailable for this session."
  return empty
}

function quotaTone(pressure: SessionTelemetry["quota"]["pressure"]) {
  if (pressure === "critical") return "critical"
  if (pressure === "high") return "warning"
  return "neutral"
}

function quotaPressureLabel(pressure: SessionTelemetry["quota"]["pressure"]) {
  if (pressure === "critical") return "Critical pressure"
  if (pressure === "high") return "High pressure"
  if (pressure === "medium") return "Elevated pressure"
  return "Stable"
}

export function PromptTelemetryCard(props: { telemetry?: SessionTelemetry }) {
  return (
    <div class="rounded-md border border-border-weak-base bg-background-base px-3 py-2 flex flex-col gap-2">
      <div class="flex items-start gap-2 min-w-0">
        <span class="text-11-medium text-text-weak shrink-0">[P]</span>
        <div class="min-w-0 flex-1">
          <div class="text-12-medium text-text-strong break-words">Prompt telemetry</div>
        </div>
      </div>
      <Show
        when={props.telemetry?.promptPhase === "ready"}
        fallback={
          <div
            classList={{
              "text-12-regular": true,
              "text-text-weak": props.telemetry?.promptPhase !== "error",
              "text-text-danger": props.telemetry?.promptPhase === "error",
            }}
          >
            {telemetryFallback(
              props.telemetry?.promptPhase ?? "empty",
              "No prompt telemetry yet.",
              props.telemetry?.error,
            )}
          </div>
        }
      >
        <>
          <div class="text-11-regular text-text-weak break-words">
            {props.telemetry?.summary.injectedCount ?? 0} injected
            {(props.telemetry?.summary.skippedCount ?? 0) > 0
              ? ` · ${props.telemetry?.summary.skippedCount ?? 0} skipped`
              : ""}
            {(props.telemetry?.summary.estimatedPromptTokens ?? 0) > 0
              ? ` · ~${(props.telemetry?.summary.estimatedPromptTokens ?? 0).toLocaleString()} tok`
              : ""}
          </div>
          <For each={props.telemetry?.prompt.blocks.slice(0, 3) ?? []}>
            {(block) => (
              <div class="rounded-md border border-border-weak-base bg-surface-panel px-2.5 py-2 flex flex-col gap-1">
                <div class="flex items-start justify-between gap-2">
                  <div class="text-11-medium text-text-strong break-words min-w-0 flex-1">{block.name}</div>
                  <span
                    classList={{
                      "text-11-medium shrink-0": true,
                      "text-success": block.outcome === "injected",
                      "text-warning": block.outcome === "skipped",
                    }}
                  >
                    {block.outcome}
                  </span>
                </div>
                <div class="text-11-regular text-text-weak break-words">
                  {[block.sourceFile, block.kind, block.injectionPolicy]
                    .filter((value): value is string => !!value)
                    .join(" · ")}
                  {block.estimatedTokens ? ` · ~${block.estimatedTokens.toLocaleString()} tok` : ""}
                </div>
                <Show when={block.skipReason}>
                  {(reason) => <div class="text-11-regular text-warning break-words">Skip: {reason()}</div>}
                </Show>
              </div>
            )}
          </For>
          <Show when={(props.telemetry?.prompt.blocks.length ?? 0) > 3}>
            <div class="text-11-regular text-text-weak">
              +{(props.telemetry?.prompt.blocks.length ?? 0) - 3} more blocks
            </div>
          </Show>
        </>
      </Show>
    </div>
  )
}

export function RoundSessionTelemetryCard(props: {
  telemetry?: SessionTelemetry
  accountLabel?: (accountId?: string, providerId?: string) => string | undefined
}) {
  const roundPairs = (): string[] => {
    const telemetry = props.telemetry
    if (!telemetry) return []
    return [
      telemetry.round.sessionId ? `session ${telemetry.round.sessionId}` : undefined,
      telemetry.round.roundIndex ? `round ${telemetry.round.roundIndex}` : undefined,
      telemetry.round.requestId ? `request ${telemetry.round.requestId}` : undefined,
    ].filter((value): value is string => !!value)
  }

  const identityPairs = (): string[] => {
    const telemetry = props.telemetry
    if (!telemetry) return []
    const account =
      props.accountLabel?.(telemetry.round.accountId, telemetry.round.providerId) ?? telemetry.round.accountId
    return [telemetry.round.providerId, account, telemetry.round.modelId].filter((value): value is string => !!value)
  }

  const roundLines = (): string[] => {
    const telemetry = props.telemetry
    if (!telemetry) return []
    return [
      tokenLine("Prompt", telemetry.round.promptTokens),
      tokenLine("Response", telemetry.round.responseTokens),
      tokenLine("Reasoning", telemetry.round.reasoningTokens),
      tokenLine("Cache read", telemetry.round.cacheReadTokens),
      tokenLine("Cache write", telemetry.round.cacheWriteTokens),
      telemetry.round.totalTokens && telemetry.round.totalTokens > 0
        ? `Round total ~${telemetry.round.totalTokens.toLocaleString()} tok`
        : undefined,
      compactLine("Compaction", telemetry.round.compacting, telemetry.round.compactionResult),
      telemetry.round.compactionDraftTokens
        ? `Compaction draft ~${telemetry.round.compactionDraftTokens.toLocaleString()} tok`
        : undefined,
    ].filter((value): value is string => !!value)
  }

  const sessionLines = (): string[] => {
    const telemetry = props.telemetry
    if (!telemetry) return []
    const account =
      props.accountLabel?.(telemetry.sessionSummary.accountId, telemetry.sessionSummary.providerId) ??
      telemetry.sessionSummary.accountId
    return [
      telemetry.sessionSummary.totalRequests > 0 ? `${telemetry.sessionSummary.totalRequests} requests` : undefined,
      telemetry.sessionSummary.cumulativeTokens > 0
        ? `Cumulative ~${telemetry.sessionSummary.cumulativeTokens.toLocaleString()} tok`
        : undefined,
      telemetry.sessionSummary.durationMs !== undefined
        ? `Duration ${Math.max(0, Math.round(telemetry.sessionSummary.durationMs / 1000))}s`
        : undefined,
      [telemetry.sessionSummary.providerId, account, telemetry.sessionSummary.modelId]
        .filter((value): value is string => !!value)
        .join(" / ") || undefined,
      telemetry.sessionSummary.compactionCount > 0
        ? `${telemetry.sessionSummary.compactionCount} compaction events`
        : undefined,
      telemetry.sessionSummary.compacting ? "Session compacting" : undefined,
    ].filter((value): value is string => !!value)
  }

  return (
    <div class="rounded-md border border-border-weak-base bg-background-base px-3 py-2 flex flex-col gap-2">
      <div class="flex items-start gap-2 min-w-0">
        <span class="text-11-medium text-text-weak shrink-0">[S]</span>
        <div class="min-w-0 flex-1">
          <div class="text-12-medium text-text-strong break-words">Round / Session telemetry</div>
        </div>
      </div>
      <Show
        when={props.telemetry?.roundPhase === "ready"}
        fallback={
          <div
            classList={{
              "text-12-regular": true,
              "text-text-weak": props.telemetry?.roundPhase !== "error",
              "text-text-danger": props.telemetry?.roundPhase === "error",
            }}
          >
            {telemetryFallback(
              props.telemetry?.roundPhase ?? "empty",
              "No round telemetry yet.",
              props.telemetry?.error,
            )}
          </div>
        }
      >
        <>
          <Show when={roundPairs().length > 0}>
            <div class="text-11-regular text-text-weak break-words">{roundPairs().join(" · ")}</div>
          </Show>
          <Show when={identityPairs().length > 0}>
            <div class="text-11-regular text-text-weak break-words">{identityPairs().join(" / ")}</div>
          </Show>
          <For each={roundLines()}>
            {(line) => <div class="text-11-regular text-text-weak break-words">{line}</div>}
          </For>
          <Show when={sessionLines().length > 0}>
            <div class="rounded-md border border-border-weak-base bg-surface-panel px-2.5 py-2 flex flex-col gap-1">
              <div class="text-11-medium text-text-strong">Session summary</div>
              <For each={sessionLines()}>
                {(line) => <div class="text-11-regular text-text-weak break-words">{line}</div>}
              </For>
            </div>
          </Show>
        </>
      </Show>
    </div>
  )
}

export type SessionTelemetryCardProps = {
  telemetry?: SessionTelemetry
  accountLabel?: (accountId?: string, providerId?: string) => string | undefined
}

export function AccountQuotaReuseCard(props: SessionTelemetryCardProps) {
  const accountIdentity = () => {
    const telemetry = props.telemetry
    if (!telemetry) return []
    const account =
      props.accountLabel?.(telemetry.quota.accountId, telemetry.quota.providerId) ?? telemetry.quota.accountId
    return [telemetry.quota.providerId, account, telemetry.quota.modelId].filter((value): value is string => !!value)
  }

  const demandLines = () => {
    const telemetry = props.telemetry
    if (!telemetry) return []
    return [
      telemetry.round.totalTokens && telemetry.round.totalTokens > 0
        ? `Current demand ~${telemetry.round.totalTokens.toLocaleString()} tok`
        : undefined,
      telemetry.sessionSummary.cumulativeTokens > 0
        ? `Rolling session ~${telemetry.sessionSummary.cumulativeTokens.toLocaleString()} tok`
        : undefined,
      telemetry.sessionSummary.totalRequests > 0
        ? `${telemetry.sessionSummary.totalRequests} requests in session`
        : undefined,
      "Remaining tokens not exposed by current telemetry",
    ].filter((value): value is string => !!value)
  }

  const eventLines = () => {
    const telemetry = props.telemetry
    if (!telemetry) return []
    return telemetry.quota.recentEvents
      .slice(-3)
      .reverse()
      .map((entry) => {
        const message = entry.message?.trim()
        return `${entry.state}${message ? ` · ${message}` : ""}`
      })
  }

  return (
    <div class="rounded-md border border-border-weak-base bg-background-base px-3 py-2 flex flex-col gap-2">
      <div class="flex items-start gap-2 min-w-0">
        <span class="text-11-medium text-text-weak shrink-0">[Q]</span>
        <div class="min-w-0 flex-1">
          <div class="text-12-medium text-text-strong break-words">Account / quota reuse</div>
        </div>
      </div>
      <Show
        when={props.telemetry?.quota.phase === "ready"}
        fallback={
          <div
            classList={{
              "text-12-regular": true,
              "text-text-weak": props.telemetry?.quota.phase !== "error",
              "text-text-danger": props.telemetry?.quota.phase === "error",
            }}
          >
            {quotaFallback(props.telemetry?.quota.phase ?? "empty", "No quota telemetry yet.", props.telemetry?.error)}
          </div>
        }
      >
        <>
          <Show when={accountIdentity().length > 0}>
            <div class="text-11-regular text-text-weak break-words">{accountIdentity().join(" / ")}</div>
          </Show>
          <div class="flex flex-wrap gap-2">
            <span
              class="inline-flex h-5 px-1.5 items-center rounded-full border text-[11px] font-medium"
              classList={{
                "bg-surface-base text-text-muted border-border-weak-base":
                  quotaTone(props.telemetry?.quota.pressure ?? "low") === "neutral",
                "bg-warning/12 text-warning border-warning/20":
                  quotaTone(props.telemetry?.quota.pressure ?? "low") === "warning",
                "bg-danger/12 text-danger border-danger/20":
                  quotaTone(props.telemetry?.quota.pressure ?? "low") === "critical",
              }}
            >
              {quotaPressureLabel(props.telemetry?.quota.pressure ?? "low")}
            </span>
            <span class="inline-flex h-5 px-1.5 items-center rounded-full border text-[11px] font-medium bg-surface-base text-text-muted border-border-weak-base">
              {props.telemetry?.quota.activeIssues.length ?? 0} active issues
            </span>
            <span class="inline-flex h-5 px-1.5 items-center rounded-full border text-[11px] font-medium bg-surface-base text-text-muted border-border-weak-base">
              {props.telemetry?.quota.recentEvents.length ?? 0} recent events
            </span>
          </div>
          <div class="rounded-md border border-border-weak-base bg-surface-panel px-2.5 py-2 flex flex-col gap-1">
            <div class="text-11-medium text-text-strong">Quota window</div>
            <For each={demandLines()}>
              {(line) => <div class="text-11-regular text-text-weak break-words">{line}</div>}
            </For>
          </div>
          <Show when={props.telemetry?.quota.activeIssues.length}>
            <div class="rounded-md border border-border-weak-base bg-surface-panel px-2.5 py-2 flex flex-col gap-1">
              <div class="text-11-medium text-text-strong">Health alerts</div>
              <For each={props.telemetry?.quota.activeIssues.slice(0, 3) ?? []}>
                {(issue) => (
                  <div class="text-11-regular text-warning break-words">
                    {issue.type} · {issue.message}
                  </div>
                )}
              </For>
            </div>
          </Show>
          <Show when={eventLines().length > 0}>
            <div class="rounded-md border border-border-weak-base bg-surface-panel px-2.5 py-2 flex flex-col gap-1">
              <div class="text-11-medium text-text-strong">Recent quota events</div>
              <For each={eventLines()}>
                {(line) => <div class="text-11-regular text-text-weak break-words">{line}</div>}
              </For>
            </div>
          </Show>
        </>
      </Show>
    </div>
  )
}

export function QuotaPressureCompactCallout(props: SessionTelemetryCardProps) {
  const visible = () =>
    props.telemetry?.quota.phase === "ready" &&
    (props.telemetry.quota.pressure === "high" || props.telemetry.quota.pressure === "critical")
  const account = () => {
    const telemetry = props.telemetry
    if (!telemetry) return undefined
    return props.accountLabel?.(telemetry.quota.accountId, telemetry.quota.providerId) ?? telemetry.quota.accountId
  }

  return (
    <Show when={visible()}>
      <div
        class="rounded-md border px-3 py-2 flex flex-col gap-1"
        classList={{
          "border-warning/30 bg-warning/8": props.telemetry?.quota.pressure === "high",
          "border-danger/30 bg-danger/8": props.telemetry?.quota.pressure === "critical",
        }}
      >
        <div
          class="text-11-medium break-words"
          classList={{
            "text-warning": props.telemetry?.quota.pressure === "high",
            "text-danger": props.telemetry?.quota.pressure === "critical",
          }}
        >
          {quotaPressureLabel(props.telemetry?.quota.pressure ?? "low")}
        </div>
        <div class="text-11-regular text-text-weak break-words">
          {[props.telemetry?.quota.providerId, account()].filter((value): value is string => !!value).join(" / ")}
          {props.telemetry?.round.totalTokens
            ? ` · round ~${props.telemetry.round.totalTokens.toLocaleString()} tok`
            : ""}
        </div>
        <Show when={props.telemetry?.quota.activeIssues[0]}>
          {(issue) => (
            <div class="text-11-regular text-text-weak break-words">
              {issue().type} · {issue().message}
            </div>
          )}
        </Show>
      </div>
    </Show>
  )
}

export function SessionTelemetryCards(props: SessionTelemetryCardProps): JSX.Element {
  return (
    <>
      <PromptTelemetryCard telemetry={props.telemetry} />
      <RoundSessionTelemetryCard telemetry={props.telemetry} accountLabel={props.accountLabel} />
      <QuotaPressureCompactCallout telemetry={props.telemetry} accountLabel={props.accountLabel} />
    </>
  )
}
