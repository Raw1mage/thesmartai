import { createEffect, createSignal, For, Show } from "solid-js"
import type { CronRunLogEntry } from "./api"

type CronApi = {
  getRuns(id: string, limit?: number): Promise<CronRunLogEntry[]>
}

export function RunHistoryPanel(props: { jobId: string; api: CronApi }) {
  const [runs, setRuns] = createSignal<CronRunLogEntry[]>([])
  const [loading, setLoading] = createSignal(true)

  createEffect(() => {
    void (async () => {
      try {
        const data = await props.api.getRuns(props.jobId, 50)
        setRuns(data)
      } catch {
        // non-critical
      } finally {
        setLoading(false)
      }
    })()
  })

  function fmtTime(ms: number) {
    const d = new Date(ms)
    return d.toLocaleString([], {
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    })
  }

  function fmtDuration(ms?: number) {
    if (ms == null) return ""
    if (ms < 1000) return `${ms}ms`
    return `${(ms / 1000).toFixed(1)}s`
  }

  return (
    <div class="font-mono text-12-medium">
      <Show when={loading()}>
        <p class="text-color-dimmed py-2 px-1">Loading...</p>
      </Show>
      <Show when={!loading() && runs().length === 0}>
        <p class="text-color-dimmed py-2 px-1 italic">No runs yet</p>
      </Show>
      <Show when={!loading() && runs().length > 0}>
        <For each={runs()}>
          {(run) => (
            <div class="flex flex-wrap gap-x-2 py-0.5 px-1 items-baseline">
              <span class="text-color-dimmed shrink-0 tabular-nums">{fmtTime(run.startedAtMs)}</span>
              <span
                classList={{
                  "shrink-0 uppercase": true,
                  "text-green-400": run.status === "ok",
                  "text-red-400": run.status === "error",
                  "text-yellow-400": run.status === "skipped",
                  "text-neutral-400": !run.status,
                }}
              >
                {run.status ?? "running"}
              </span>
              <Show when={fmtDuration(run.durationMs)}>
                <span class="text-color-dimmed shrink-0">{fmtDuration(run.durationMs)}</span>
              </Show>
              <Show when={run.error}>
                <span class="text-red-400 break-words min-w-0">{run.error}</span>
              </Show>
              <Show when={!run.error && run.summary}>
                <span class="text-color-secondary break-words min-w-0">{run.summary}</span>
              </Show>
            </div>
          )}
        </For>
      </Show>
    </div>
  )
}
