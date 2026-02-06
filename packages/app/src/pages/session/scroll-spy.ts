export function closestMessage(node: Element | null): HTMLElement | null {
  if (!node) return null
  const match = node.closest?.("[data-message-id]") as HTMLElement | null
  if (match) return match
  const root = node.getRootNode?.()
  if (root instanceof ShadowRoot) return closestMessage(root.host)
  return null
}

export function getActiveMessageId(container: HTMLDivElement) {
  const rect = container.getBoundingClientRect()
  if (!rect.width || !rect.height) return

  const x = Math.min(window.innerWidth - 1, Math.max(0, rect.left + rect.width / 2))
  const y = Math.min(window.innerHeight - 1, Math.max(0, rect.top + 100))

  const hit = document.elementFromPoint(x, y)
  const host = closestMessage(hit)
  const id = host?.dataset.messageId
  if (id) return id

  // Fallback: DOM query (handles edge hit-testing cases)
  const cutoff = container.scrollTop + 100
  const nodes = container.querySelectorAll<HTMLElement>("[data-message-id]")
  let last: string | undefined

  for (const node of nodes) {
    const next = node.dataset.messageId
    if (!next) continue
    if (node.offsetTop > cutoff) break
    last = next
  }

  return last
}

let scrollSpyFrame: number | undefined
let scrollSpyTarget: HTMLDivElement | undefined

export function scheduleScrollSpy(container: HTMLDivElement, onActiveChange: (id: string) => void) {
  scrollSpyTarget = container
  if (scrollSpyFrame !== undefined) return

  scrollSpyFrame = requestAnimationFrame(() => {
    scrollSpyFrame = undefined

    const target = scrollSpyTarget
    scrollSpyTarget = undefined
    if (!target) return

    const id = getActiveMessageId(target)
    if (!id) return
    onActiveChange(id)
  })
}

export function cancelScrollSpy() {
  if (scrollSpyFrame !== undefined) {
    cancelAnimationFrame(scrollSpyFrame)
    scrollSpyFrame = undefined
  }
}
