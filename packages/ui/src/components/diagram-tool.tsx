import { createMemo, createSignal, For, Show } from "solid-js"
import { BasicTool } from "./basic-tool"
import { ToolRegistry, type ToolProps } from "./message-part"
import { Markdown } from "./markdown"

interface DiagramArtifact {
  name: string
  svg: string
}

interface ParsedDiagramOutput {
  summary: string
  artifacts: DiagramArtifact[]
}

const SVG_BLOCK_RE = /^--- SVG: (.+?) ---$/

function parseDiagramOutput(output: string): ParsedDiagramOutput {
  const lines = output.split("\n")
  const summaryLines: string[] = []
  const artifacts: DiagramArtifact[] = []
  let currentName: string | null = null
  let currentSvgLines: string[] = []

  for (const line of lines) {
    const match = SVG_BLOCK_RE.exec(line)
    if (match) {
      // flush previous artifact
      if (currentName !== null) {
        artifacts.push({ name: currentName, svg: currentSvgLines.join("\n") })
      }
      currentName = match[1]
      currentSvgLines = []
    } else if (currentName !== null) {
      currentSvgLines.push(line)
    } else {
      summaryLines.push(line)
    }
  }
  // flush last artifact
  if (currentName !== null) {
    artifacts.push({ name: currentName, svg: currentSvgLines.join("\n") })
  }

  return {
    summary: summaryLines.join("\n").trim(),
    artifacts,
  }
}

function svgToDataUrl(svg: string): string {
  return "data:image/svg+xml;base64," + btoa(unescape(encodeURIComponent(svg.trim())))
}

function downloadSvg(svg: string, filename: string) {
  const blob = new Blob([svg], { type: "image/svg+xml" })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

const btnClass =
  "px-2 py-1 text-11-medium text-text-dimmed hover:text-text-base hover:bg-surface-tertiary rounded transition-colors cursor-pointer"

function DiagramPreview(props: { artifact: DiagramArtifact }) {
  const [expanded, setExpanded] = createSignal(false)
  const dataUrl = createMemo(() => svgToDataUrl(props.artifact.svg))

  return (
    <div data-component="diagram-preview" style={{ "margin-bottom": "0.5rem" }}>
      <div
        style={{
          display: "flex",
          "align-items": "center",
          "justify-content": "space-between",
          padding: "0.25rem 0",
        }}
      >
        <span
          style={{
            "font-size": "12px",
            "font-weight": "600",
            color: "var(--color-text-dimmed)",
          }}
        >
          {props.artifact.name}
        </span>
        <div style={{ display: "flex", gap: "0.25rem" }}>
          <button
            class={btnClass}
            onClick={() => setExpanded((v) => !v)}
            title={expanded() ? "Collapse" : "Expand"}
          >
            {expanded() ? "Collapse" : "Expand"}
          </button>
          <button
            class={btnClass}
            onClick={() => downloadSvg(props.artifact.svg, `${props.artifact.name}.svg`)}
            title="Download SVG"
          >
            Download
          </button>
          <button
            class={btnClass}
            onClick={() => window.open(dataUrl(), "_blank")}
            title="Open in new tab"
          >
            New Tab
          </button>
        </div>
      </div>
      <div
        style={{
          "max-height": expanded() ? "none" : "300px",
          overflow: "hidden",
          "border-radius": "6px",
          border: "1px solid var(--color-border-base)",
          background: "white",
          display: "flex",
          "justify-content": "center",
          padding: "0.75rem",
        }}
      >
        <img
          src={dataUrl()}
          alt={props.artifact.name}
          style={{
            "max-width": "100%",
            height: "auto",
          }}
          draggable={false}
        />
      </div>
    </div>
  )
}

// --- ToolRegistry registrations ---

ToolRegistry.register({
  name: "drawmiat_generate_diagram",
  render(props: ToolProps) {
    const parsed = createMemo(() => (props.output ? parseDiagramOutput(props.output) : null))
    const diagramType = createMemo(() => props.input?.diagram_type ?? "diagram")
    const hasArtifacts = createMemo(() => (parsed()?.artifacts.length ?? 0) > 0)
    const statusLabel = createMemo(() => {
      if (props.status === "running") return "rendering…"
      if (!props.output) return ""
      return parsed()?.summary.includes("ERROR") ? "error" : "ok"
    })

    return (
      <BasicTool
        icon="mcp"
        trigger={{
          title: "generate_diagram",
          subtitle: `${diagramType()}${statusLabel() ? " — " + statusLabel() : ""}`,
        }}
        defaultOpen={hasArtifacts()}
        hideDetails={props.hideDetails}
        forceOpen={props.forceOpen}
        locked={props.locked}
      >
        <div data-component="diagram-tool-output" style={{ padding: "0.5rem 0.75rem" }}>
          {/* Summary */}
          <Show when={parsed()?.summary}>
            {(summary) => (
              <div data-component="tool-output" data-scrollable style={{ "margin-bottom": "0.5rem" }}>
                <Markdown text={summary()} />
              </div>
            )}
          </Show>

          {/* SVG Previews */}
          <Show when={hasArtifacts()}>
            <For each={parsed()!.artifacts}>{(artifact) => <DiagramPreview artifact={artifact} />}</For>
          </Show>
        </div>
      </BasicTool>
    )
  },
})

ToolRegistry.register({
  name: "drawmiat_validate_diagram",
  render(props: ToolProps) {
    const diagramType = createMemo(() => props.input?.diagram_type ?? "diagram")

    return (
      <BasicTool
        icon="mcp"
        trigger={{
          title: "validate_diagram",
          subtitle: diagramType(),
        }}
        hideDetails={props.hideDetails}
        forceOpen={props.forceOpen}
        locked={props.locked}
      >
        <Show when={props.output}>
          {(output) => (
            <div data-component="tool-output" data-scrollable>
              <Markdown text={output()} />
            </div>
          )}
        </Show>
      </BasicTool>
    )
  },
})
