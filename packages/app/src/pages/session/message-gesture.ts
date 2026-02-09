export const normalizeWheelDelta = (input: { deltaY: number; deltaMode: number; rootHeight: number }) => {
  if (input.deltaMode === 1) return input.deltaY * 40
  if (input.deltaMode === 2) return input.deltaY * input.rootHeight
  return input.deltaY
}

export const shouldMarkBoundaryGesture = (input: {
  delta: number
  scrollTop: number
  scrollHeight: number
  clientHeight: number
}) => {
  const max = input.scrollHeight - input.clientHeight
  if (max <= 1) return true
  if (!input.delta) return false

  if (input.delta < 0) return input.scrollTop + input.delta <= 0

  const remaining = max - input.scrollTop
  return input.delta > remaining
}

export const markScrollGesture = (root: HTMLDivElement | undefined, target?: EventTarget | null) => {
  if (!root || !(target instanceof Node)) return false
  if (!root.contains(target)) return false

  let node: HTMLElement | null = target instanceof HTMLElement ? target : target.parentElement
  while (node && node !== root) {
    const style = window.getComputedStyle(node)
    const overflowY = style.overflowY
    const scrollable =
      (overflowY === "auto" || overflowY === "scroll" || overflowY === "overlay") &&
      node.scrollHeight > node.clientHeight
    if (scrollable) return false
    node = node.parentElement
  }

  return true
}

export const isScrollGestureActive = (at: number, windowMs: number) => {
  if (!at) return false
  return Date.now() - at < windowMs
}
