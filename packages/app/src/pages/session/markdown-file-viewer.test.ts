import { describe, expect, test } from "bun:test"
import {
  collectMarkdownAssetRefs,
  extractMermaidBlocks,
  hasMermaidSyntax,
  isMarkdownPath,
  replaceMarkdownAssetRefs,
  resolveMarkdownAssetPath,
} from "./markdown-file-viewer"

describe("markdown-file-viewer helpers", () => {
  test("detects markdown paths", () => {
    expect(isMarkdownPath("docs/readme.md")).toBe(true)
    expect(isMarkdownPath("docs/readme.MD")).toBe(true)
    expect(isMarkdownPath("docs/readme.txt")).toBe(false)
  })

  test("resolves relative markdown asset paths", () => {
    expect(resolveMarkdownAssetPath("docs/guide/readme.md", "./diagram.svg")).toBe("/docs/guide/diagram.svg")
    expect(resolveMarkdownAssetPath("docs/guide/readme.md", "../shared/diagram.svg")).toBe("/docs/shared/diagram.svg")
    expect(resolveMarkdownAssetPath("docs/guide/readme.md", "/static/diagram.svg")).toBe("/static/diagram.svg")
    expect(resolveMarkdownAssetPath("docs/guide/readme.md", "https://example.com/x.svg")).toBeUndefined()
  })

  test("collects markdown and html image references", () => {
    const markdown = `![one](./a.svg)\n<img src="../b.svg" />`
    expect(collectMarkdownAssetRefs(markdown)).toEqual(["./a.svg", "../b.svg"])
  })

  test("replaces markdown asset references", () => {
    const markdown = `![one](./a.svg)\n<img src="./a.svg" />`
    expect(replaceMarkdownAssetRefs(markdown, { "./a.svg": "data:image/svg+xml;base64,abc" })).toContain(
      "data:image/svg+xml;base64,abc",
    )
  })

  test("detects mermaid syntax variants", () => {
    expect(hasMermaidSyntax("```mermaid\ngraph TD\n```")).toBe(true)
    expect(hasMermaidSyntax("::: mermaid\ngraph TD\n:::")).toBe(true)
    expect(hasMermaidSyntax('<pre class="mermaid">graph TD</pre>')).toBe(true)
    expect(hasMermaidSyntax("```ts\nconst x = 1\n```")).toBe(false)
  })

  test("extracts fenced mermaid blocks into placeholders", () => {
    const result = extractMermaidBlocks("before\n```mermaid\ngraph TD\nA-->B\n```\nafter")
    expect(result.blocks).toHaveLength(1)
    expect(result.blocks[0]?.source).toContain("graph TD")
    expect(result.markdown).toContain('data-mermaid-block="mermaid-0"')
  })

  test("extracts directive and pre mermaid variants", () => {
    const directive = extractMermaidBlocks("::: mermaid\ngraph TD\nA-->B\n:::")
    const pre = extractMermaidBlocks('<pre class="mermaid">graph TD\nA-->B</pre>')
    expect(directive.blocks).toHaveLength(1)
    expect(pre.blocks).toHaveLength(1)
  })
})
