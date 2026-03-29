import { Component, Show, createMemo } from "solid-js"
import { Markdown } from "@opencode-ai/ui/markdown"
import { hasMermaidSyntax } from "./markdown-file-viewer"

export interface RichMarkdownSurfaceProps {
  text: string
  cacheKey?: string
  class?: string
  proseClass?: string
  mermaidNotice?: "none" | "inline"
}

export const RichMarkdownSurface: Component<RichMarkdownSurfaceProps> = (props) => {
  const showMermaidNotice = createMemo(() => props.mermaidNotice === "inline" && hasMermaidSyntax(props.text))

  return (
    <div class={props.class}>
      <Show when={showMermaidNotice()}>
        <div class="mb-4 rounded border border-border-base bg-surface-secondary px-3 py-2 text-12-regular text-text-weak">
          Mermaid preview is not fully rendered yet. Supported Mermaid content remains visible as source fallback in
          this view.
        </div>
      </Show>
      <div class={props.proseClass ?? "prose prose-sm max-w-none"}>
        <Markdown text={props.text} cacheKey={props.cacheKey} />
      </div>
    </div>
  )
}
