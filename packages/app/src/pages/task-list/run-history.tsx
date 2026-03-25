import { createEffect, createSignal, For, Show } from "solid-js"
import type { CronRunLogEntry } from "./api"
import { formatRelativeTime } from "./cron-utils"

type CronApi = {
  getRuns(id: string, limit?: number): Promise<CronRunLogEntry[]>
}

export function RunHistoryPanel(props: { jobId: string; api: CronApi }) {
  const [runs, setRuns] = createSignal<CronRunLogEntry[]>([])
  const [loading, setLoading] = createSignal(true)
  const [expandedRuns, setExpandedRuns] = createSignal<Set<string>>(new Set())

  createEffect(() => {
    void (async () => {
      try {
        const data = await props.api.getRuns(props.jobId, 20)
        setRuns(data)
      } catch {
        // Silently ignore — non-critical
      } finally {
        setLoading(false)
      }
    })()
  })

  function toggleExpand(runId: string) {
    const s = new Set(expandedRuns())
    if (s.has(runId)) s.delete(runId)
    else s.add(runId)
    setExpandedRuns(s)
  }

  function formatTime(ms: number) {
    const d = new Date(ms)
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
  }

  function formatDate(ms: number) {
    const d = new Date(ms)
    const now = new Date()
    const isToday = d.toDateString() === now.toDateString()
    if (isToday) return "Today"
    const yesterday = new Date(now)
    yesterday.setDate(yesterday.getDate() - 1)
    if (d.toDateString() === yesterday.toDateString()) return "Yesterday"
    return d.toLocaleDateString([], { month: "short", day: "numeric" })
  }

  return (
    <div class="px-3 py-2 max-h-[300px] overflow-y-auto">
      <Show when={loading()}>
        <p class="text-12-medium text-color-dimmed py-2">Loading runs...</p>
      </Show>
      <Show when={!loading() && runs().length === 0}>
        <p class="text-12-medium text-color-dimmed py-2 italic">No runs yet</p>
      </Show>
      <Show when={!loading() && runs().length > 0}>
        <div class="space-y-1">
          <For each={runs()}>
            {(run) => {
              const isExpanded = () => expandedRuns().has(run.runId)
              const hasSummary = () => !!run.summary && run.summary.length > 0
              const duration = () => run.durationMs != null ? `${(run.durationMs / 1000).toFixed(1)}s` : null

              return (
                <div
                  classList={{
                    "rounded px-2.5 py-1.5 transition-colors": true,
                    "hover:bg-surface-raised-base-hover cursor-pointer": hasSummary(),
                  }}
                  onClick={() => hasSummary() && toggleExpand(run.runId)}
                >
                  {/* Run header row */}
                  <div class="flex items-center gap-2 text-12-medium">
                    <span
                      classList={{
                        "shrink-0 w-1.5 h-1.5 rounded-full": true,
                        "bg-green-400": run.status === "ok",
                        "bg-red-400": run.status === "error",
                        "bg-yellow-400": run.status === "skipped",
                        "bg-neutral-400": !run.status,
                      }}
                    />
                    <span class="text-color-dimmed tabular-nums shrink-0">
                      {formatDate(run.startedAtMs)} {formatTime(run.startedAtMs)}
                    </span>
                    <Show when={duration()}>
                      <span class="text-color-dimmed shrink-0">({duration()})</span>
                    </Show>
                    <Show when={run.error}>
                      <span class="text-red-400 truncate flex-1">{run.error}</span>
                    </Show>
                    <Show when={!run.error && hasSummary()}>
                      <Show when={!isExpanded()}>
                        <span class="text-color-secondary truncate flex-1">{run.summary}</span>
                      </Show>
                    </Show>
                    <Show when={hasSummary()}>
                      <span class="text-color-dimmed text-11-medium shrink-0 ml-auto">
                        {isExpanded() ? "▾" : "▸"}
                      </span>
                    </Show>
                  </div>

                  {/* Expanded AI response */}
                  <Show when={isExpanded() && hasSummary()}>
                    <div class="mt-2 ml-3.5 pl-3 border-l-2 border-accent-base/30">
                      <p class="text-13-medium text-color-secondary whitespace-pre-wrap break-words">
                        {run.summary}
                      </p>
                    </div>
                  </Show>
                </div>
              )
            }}
          </For>
        </div>
      </Show>
    </div>
  )
}
