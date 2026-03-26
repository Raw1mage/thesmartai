import { createSignal, onCleanup, onMount, Show, type Component } from "solid-js"

interface SvgEditorProps {
  /** Raw SVG content string */
  svgContent: string
  /** Called when the user saves the edited SVG */
  onSave?: (svgContent: string) => void
  /** Called when the user discards changes */
  onDiscard?: () => void
  /** Filename hint for download */
  filename?: string
}

/**
 * SVG Editor component — provides drag/move, text editing, delete, and export.
 * Ported from drawmiat's svg-editor-core.js to Solid.js.
 */
export const SvgEditor: Component<SvgEditorProps> = (props) => {
  let containerRef: HTMLDivElement | undefined
  let selectedElement: SVGElement | null = null
  let initialTransform = { x: 0, y: 0 }
  let startMouse = { x: 0, y: 0 }
  const [hasChanges, setHasChanges] = createSignal(false)
  const [selectedTag, setSelectedTag] = createSignal<string | null>(null)

  const getTranslate = (el: SVGElement): { x: number; y: number } => {
    const transform = el.getAttribute("transform")
    if (!transform) return { x: 0, y: 0 }
    const match = /translate\(([^,]+),?\s*([^)]+)\)/.exec(transform)
    if (match) return { x: parseFloat(match[1]), y: parseFloat(match[2]) }
    return { x: 0, y: 0 }
  }

  const getSvg = () => containerRef?.querySelector("svg")

  const clearSelection = () => {
    containerRef?.querySelectorAll(".svg-editor-selected").forEach((el) => el.classList.remove("svg-editor-selected"))
    selectedElement = null
    setSelectedTag(null)
  }

  const startDrag = (evt: MouseEvent) => {
    evt.preventDefault()
    evt.stopPropagation()
    const el = evt.currentTarget as SVGElement
    clearSelection()
    selectedElement = el
    el.classList.add("svg-editor-selected")
    setSelectedTag(el.tagName)

    initialTransform = getTranslate(el)
    const svg = getSvg()
    if (!svg) return
    const CTM = svg.getScreenCTM()
    if (!CTM) return
    startMouse.x = (evt.clientX - CTM.e) / CTM.a
    startMouse.y = (evt.clientY - CTM.f) / CTM.d
  }

  const drag = (evt: MouseEvent) => {
    if (!selectedElement) return
    evt.preventDefault()
    const svg = getSvg()
    if (!svg) return
    const CTM = svg.getScreenCTM()
    if (!CTM) return

    const dx = (evt.clientX - CTM.e) / CTM.a - startMouse.x
    const dy = (evt.clientY - CTM.f) / CTM.d - startMouse.y

    selectedElement.setAttribute("transform", `translate(${initialTransform.x + dx}, ${initialTransform.y + dy})`)
    setHasChanges(true)
  }

  const endDrag = () => {
    if (selectedElement) {
      selectedElement = null
    }
  }

  const initInteractions = () => {
    const svg = getSvg()
    if (!svg) return

    const elements = svg.querySelectorAll("text, path, rect, circle, polygon, polyline, g")
    elements.forEach((el) => {
      // Skip background rect
      if (el.tagName === "rect" && el.getAttribute("fill") === "white" && !el.getAttribute("stroke")) return
      ;(el as HTMLElement).style.cursor = "grab"
      el.addEventListener("mousedown", startDrag as EventListener)
    })

    svg.addEventListener("mousemove", drag as EventListener)
    svg.addEventListener("mouseup", endDrag)
    svg.addEventListener("mouseleave", endDrag)
  }

  const deleteSelected = () => {
    if (!selectedElement) return
    selectedElement.remove()
    selectedElement = null
    setSelectedTag(null)
    setHasChanges(true)
  }

  const startTextEdit = () => {
    if (!selectedElement || selectedElement.tagName !== "text") return
    const current = selectedElement.textContent ?? ""
    const next = prompt("Edit label:", current)
    if (next !== null && next !== current) {
      selectedElement.textContent = next
      setHasChanges(true)
    }
  }

  const getContent = (): string => {
    return containerRef?.innerHTML ?? ""
  }

  const handleSave = () => {
    props.onSave?.(getContent())
    setHasChanges(false)
  }

  const handleDownload = () => {
    const content = getContent()
    const blob = new Blob([content], { type: "image/svg+xml" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `edited_${props.filename ?? "diagram.svg"}`
    a.click()
    URL.revokeObjectURL(url)
  }

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Delete" || e.key === "Backspace") {
      if (selectedElement) {
        e.preventDefault()
        deleteSelected()
      }
    }
    if (e.key === "Escape") {
      clearSelection()
    }
  }

  onMount(() => {
    if (containerRef) {
      containerRef.innerHTML = props.svgContent
      initInteractions()
    }
    document.addEventListener("keydown", handleKeyDown)
  })

  onCleanup(() => {
    document.removeEventListener("keydown", handleKeyDown)
  })

  const btnClass =
    "px-2 py-1 text-12-medium text-text-dimmed hover:text-text-base hover:bg-surface-tertiary rounded transition-colors"

  return (
    <div class="flex flex-col h-full">
      {/* Editor Toolbar */}
      <div class="flex items-center gap-1 px-4 py-2 border-b border-border-base bg-surface-secondary shrink-0">
        <span class="text-12-semibold text-text-base mr-2">SVG Editor</span>
        <div class="w-px h-4 bg-border-base mx-1" />
        <button class={btnClass} onClick={deleteSelected} title="Delete selected element (Del)">
          Delete
        </button>
        <Show when={selectedTag() === "text"}>
          <button class={btnClass} onClick={startTextEdit} title="Edit text label">
            Edit Text
          </button>
        </Show>
        <div class="flex-1" />
        <Show when={hasChanges()}>
          <span class="text-11-medium text-accent-primary mr-2">Unsaved</span>
        </Show>
        <button class={btnClass} onClick={handleDownload} title="Download edited SVG">
          Download
        </button>
        <Show when={props.onSave}>
          <button
            class="px-2 py-1 text-12-medium text-white bg-accent-primary hover:bg-accent-primary-hover rounded transition-colors"
            onClick={handleSave}
            title="Save changes"
          >
            Save
          </button>
        </Show>
        <Show when={props.onDiscard}>
          <button class={btnClass} onClick={() => props.onDiscard?.()}>
            Discard
          </button>
        </Show>
      </div>

      {/* SVG Canvas */}
      <div
        ref={containerRef}
        class="flex-1 overflow-auto p-4 flex justify-center items-start svg-editor-canvas"
      />

      {/* Inline styles for editor interactions */}
      <style>{`
        .svg-editor-canvas svg {
          max-width: 100%;
          height: auto;
        }
        .svg-editor-canvas .svg-editor-selected {
          outline: 2px dashed var(--color-accent-primary, #3b82f6);
          outline-offset: 2px;
        }
        .svg-editor-canvas text:hover,
        .svg-editor-canvas rect:hover,
        .svg-editor-canvas circle:hover,
        .svg-editor-canvas path:hover,
        .svg-editor-canvas polyline:hover,
        .svg-editor-canvas polygon:hover {
          filter: brightness(0.8);
        }
      `}</style>
    </div>
  )
}
