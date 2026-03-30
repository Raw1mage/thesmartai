export function isMarkdownPath(path: string | undefined) {
  return path?.toLowerCase().endsWith(".md") ?? false
}

function dirname(path: string) {
  const index = path.lastIndexOf("/")
  if (index <= 0) return ""
  return path.slice(0, index)
}

function joinRelativePath(baseDir: string, relativePath: string) {
  const stack = baseDir.split("/").filter(Boolean)
  for (const part of relativePath.split("/")) {
    if (!part || part === ".") continue
    if (part === "..") {
      stack.pop()
      continue
    }
    stack.push(part)
  }
  return `/${stack.join("/")}`
}

export function resolveMarkdownAssetPath(markdownPath: string, assetPath: string) {
  if (!assetPath || /^(https?:|data:|blob:|#)/i.test(assetPath)) return
  if (assetPath.startsWith("/")) return assetPath
  return joinRelativePath(dirname(markdownPath), assetPath)
}

export function collectMarkdownAssetRefs(markdown: string) {
  const refs = new Set<string>()
  const markdownImagePattern = /!\[[^\]]*\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g
  const htmlImagePattern = /<img\b[^>]*\bsrc=["']([^"']+)["'][^>]*>/gi

  for (const match of markdown.matchAll(markdownImagePattern)) {
    const target = match[1]?.trim()
    if (target) refs.add(target)
  }
  for (const match of markdown.matchAll(htmlImagePattern)) {
    const target = match[1]?.trim()
    if (target) refs.add(target)
  }

  return Array.from(refs)
}

export function replaceMarkdownAssetRefs(markdown: string, mapping: Record<string, string>) {
  let next = markdown
  for (const [source, replacement] of Object.entries(mapping)) {
    next = next.replaceAll(`](${source})`, `](${replacement})`)
    next = next.replaceAll(`src="${source}"`, `src="${replacement}"`)
    next = next.replaceAll(`src='${source}'`, `src='${replacement}'`)
  }
  return next
}

export function hasMermaidSyntax(markdown: string) {
  return /```\s*mermaid\b|:::\s*mermaid\b|<pre\b[^>]*class=["'][^"']*mermaid/i.test(markdown)
}

export type MermaidBlock = {
  id: string
  source: string
}

const mermaidFencePattern = /```\s*mermaid\s*\n([\s\S]*?)```/gi
const mermaidDirectivePattern = /:::\s*mermaid\s*\n([\s\S]*?):::/gi
const mermaidPrePattern = /<pre\b[^>]*class=["'][^"']*mermaid[^"']*["'][^>]*>([\s\S]*?)<\/pre>/gi

function decodeHtmlEntities(text: string) {
  return text
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
}

function normalizeMermaidSource(source: string) {
  return decodeHtmlEntities(source).trim()
}

export function extractMermaidBlocks(markdown: string) {
  const blocks: MermaidBlock[] = []
  let index = 0

  const replace = (input: string, pattern: RegExp) =>
    input.replace(pattern, (_, source: string) => {
      const normalized = normalizeMermaidSource(source)
      if (!normalized) return _
      const id = `mermaid-${index++}`
      blocks.push({ id, source: normalized })
      return `<div data-mermaid-block="${id}"></div>`
    })

  let next = markdown
  next = replace(next, mermaidFencePattern)
  next = replace(next, mermaidDirectivePattern)
  next = replace(next, mermaidPrePattern)

  return {
    markdown: next,
    blocks,
  }
}
