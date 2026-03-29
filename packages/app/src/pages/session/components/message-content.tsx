import { Component, ComponentProps, createMemo, Show, createSignal, createEffect, onCleanup } from "solid-js"
import { TextPart } from "@opencode-ai/sdk/v2"
import { useParams } from "@solidjs/router"
import { useSDK } from "@/context/sdk"
import { useLayout } from "@/context/layout"
import { useFile } from "@/context/file"
import { decodeFileLink, linkifyFileReferences, resolveFileReferencePath } from "../message-file-links"
import { RichMarkdownSurface } from "../rich-markdown-surface"

function createThrottledValue(getValue: () => string) {
  const [value, setValue] = createSignal(getValue())
  let last = 0
  const throttle = 100

  createEffect(() => {
    const next = getValue()
    const now = Date.now()
    if (now - last >= throttle) {
      last = now
      setValue(next)
    } else {
      const timer = setTimeout(
        () => {
          last = Date.now()
          setValue(getValue())
        },
        throttle - (now - last),
      )
      onCleanup(() => clearTimeout(timer))
    }
  })

  return value
}

export interface MessageContentProps {
  part: TextPart
}

export const MessageContent: Component<MessageContentProps> = (props) => {
  const params = useParams()
  const sdk = useSDK()
  const layout = useLayout()
  const file = useFile()
  const displayText = createMemo(() => (props.part.text ?? "").trim())
  const linkedText = createMemo(() => linkifyFileReferences(displayText(), sdk.directory))
  const throttledText = createThrottledValue(linkedText)
  const tabs = createMemo(() => layout.tabs(() => `${params.dir}${params.id ? "/" + params.id : ""}`))

  const handleClick: ComponentProps<"div">["onClick"] = (event) => {
    const target = event.target
    if (!(target instanceof Element)) return
    const anchor = target.closest("a")
    if (!(anchor instanceof HTMLAnchorElement)) return
    const decoded = decodeFileLink(anchor.href)
    if (!decoded) return

    event.preventDefault()

    const normalized = resolveFileReferencePath(decoded.path, sdk.directory)
    if (!normalized) return

    if (decoded.line) {
      file.setSelectedLines(normalized, { start: decoded.line, end: decoded.line })
    }
    void file.load(normalized)
    void tabs().open(file.tab(normalized))
  }

  return (
    <Show when={throttledText()}>
      <div data-component="text-part" onClick={handleClick}>
        <RichMarkdownSurface
          text={throttledText()}
          cacheKey={props.part.id}
          mermaidNotice="inline"
          class=""
          proseClass="prose prose-sm max-w-none"
        />
      </div>
    </Show>
  )
}
