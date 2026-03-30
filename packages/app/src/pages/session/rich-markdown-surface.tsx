import { Component, Show, createEffect, createMemo, createSignal, onCleanup } from "solid-js"
import { Markdown } from "@opencode-ai/ui/markdown"
import mermaid from "mermaid"
import { extractMermaidBlocks, hasMermaidSyntax } from "./markdown-file-viewer"

export interface RichMarkdownSurfaceProps {
  text: string
  cacheKey?: string
  class?: string
  proseClass?: string
  mermaidNotice?: "none" | "inline"
}

export const RichMarkdownSurface: Component<RichMarkdownSurfaceProps> = (props) => {
  const [root, setRoot] = createSignal<HTMLDivElement>()
  const [renderFailed, setRenderFailed] = createSignal(false)
  const mermaidContent = createMemo(() => extractMermaidBlocks(props.text))
  const showMermaidNotice = createMemo(
    () => props.mermaidNotice === "inline" && hasMermaidSyntax(props.text) && renderFailed(),
  )

  createEffect(() => {
    const container = root()
    const blocks = mermaidContent().blocks
    if (!container || blocks.length === 0) {
      setRenderFailed(false)
      return
    }

    let cancelled = false
    const timers: ReturnType<typeof setTimeout>[] = []

    const render = async () => {
      try {
        mermaid.initialize({
          startOnLoad: false,
          securityLevel: "strict",
          theme: "neutral",
        })

        let failed = false
        for (const block of blocks) {
          const slot = container.querySelector(`[data-mermaid-block="${block.id}"]`)
          if (!(slot instanceof HTMLDivElement)) continue
          try {
            const { svg } = await mermaid.render(`rendered-${block.id}`, block.source)
            if (cancelled) return
            slot.innerHTML = svg
          } catch {
            failed = true
          }
        }
        if (!cancelled) setRenderFailed(failed)
      } catch {
        if (!cancelled) setRenderFailed(true)
      }
    }

    timers.push(setTimeout(() => void render(), 0))

    onCleanup(() => {
      cancelled = true
      for (const timer of timers) clearTimeout(timer)
    })
  })

  return (
    <div class={props.class} ref={setRoot}>
      <Show when={showMermaidNotice()}>
        <div class="mb-4 rounded border border-border-base bg-surface-secondary px-3 py-2 text-12-regular text-text-weak">
          Some Mermaid content could not be rendered and remains visible as source fallback in this view.
        </div>
      </Show>
      <div class={props.proseClass ?? "prose prose-sm max-w-none"}>
        <Markdown text={mermaidContent().markdown} cacheKey={props.cacheKey} />
      </div>
    </div>
  )
}
