export function markScrollGesture(scroller: HTMLDivElement | undefined, target?: EventTarget | null) {
  const root = scroller
  if (!root) return false

  const el = target instanceof Element ? target : undefined
  const nested = el?.closest("[data-scrollable]")
  if (nested && nested !== root) return false

  return true
}

export function isScrollGestureActive(lastGesture: number, windowMs: number = 250) {
  return Date.now() - lastGesture < windowMs
}
