import { onCleanup, createEffect, type Accessor } from "solid-js"
import type { UserMessage } from "@opencode-ai/sdk/v2"

export function anchor(id: string) {
  return `message-${id}`
}

export function scrollToElement(root: HTMLDivElement | undefined, el: HTMLElement, behavior: ScrollBehavior) {
  if (!root) return false

  const a = el.getBoundingClientRect()
  const b = root.getBoundingClientRect()
  const top = a.top - b.top + root.scrollTop
  root.scrollTo({ top, behavior })
  return true
}

interface HashScrollOptions {
  scroller: Accessor<HTMLDivElement | undefined>
  messages: Accessor<UserMessage[]>
  messagesReady: Accessor<boolean>
  onActiveChange: (id: string | undefined) => void
  onPauseAutoScroll: () => void
  onForceScrollToBottom: () => void
  activeMessageId: Accessor<string | undefined>
  turnStart: Accessor<number>
  onBackfill: (index: number) => void
}

export function useSessionHashScroll(options: HashScrollOptions) {
  const clearMessageHash = () => {
    if (!window.location.hash) return
    window.history.replaceState(null, "", window.location.href.replace(/#.*$/, ""))
  }

  const updateHash = (id: string) => {
    window.history.replaceState(null, "", `#${anchor(id)}`)
  }

  const scrollToMessage = (message: UserMessage, behavior: ScrollBehavior = "smooth") => {
    options.onActiveChange(message.id)

    const msgs = options.messages()
    const index = msgs.findIndex((m) => m.id === message.id)
    if (index !== -1 && index < options.turnStart()) {
      options.onBackfill(index)

      requestAnimationFrame(() => {
        const el = document.getElementById(anchor(message.id))
        if (!el) {
          requestAnimationFrame(() => {
            const next = document.getElementById(anchor(message.id))
            if (!next) return
            scrollToElement(options.scroller(), next, behavior)
          })
          return
        }
        scrollToElement(options.scroller(), el, behavior)
      })

      updateHash(message.id)
      return
    }

    const el = document.getElementById(anchor(message.id))
    if (!el) {
      updateHash(message.id)
      requestAnimationFrame(() => {
        const next = document.getElementById(anchor(message.id))
        if (!next) return
        if (!scrollToElement(options.scroller(), next, behavior)) return
      })
      return
    }
    if (scrollToElement(options.scroller(), el, behavior)) {
      updateHash(message.id)
      return
    }

    requestAnimationFrame(() => {
      const next = document.getElementById(anchor(message.id))
      if (!next) return
      if (!scrollToElement(options.scroller(), next, behavior)) return
    })
    updateHash(message.id)
  }

  const applyHash = (behavior: ScrollBehavior) => {
    const hash = window.location.hash.slice(1)
    if (!hash) {
      options.onForceScrollToBottom()
      return
    }

    const match = hash.match(/^message-(.+)$/)
    if (match) {
      options.onPauseAutoScroll()
      const msg = options.messages().find((m) => m.id === match[1])
      if (msg) {
        scrollToMessage(msg, behavior)
        return
      }
      return
    }

    const target = document.getElementById(hash)
    if (target) {
      options.onPauseAutoScroll()
      scrollToElement(options.scroller(), target, behavior)
      return
    }

    options.onForceScrollToBottom()
  }

  createEffect(() => {
    if (!options.messagesReady()) return

    requestAnimationFrame(() => {
      applyHash("auto")
    })
  })

  createEffect(() => {
    if (!options.messagesReady()) return

    // dependencies
    options.messages().length
    options.turnStart()

    const hash = window.location.hash.slice(1)
    const match = hash.match(/^message-(.+)$/)
    if (!match) return
    const targetId = match[1]

    if (options.activeMessageId() === targetId) return

    const msg = options.messages().find((m) => m.id === targetId)
    if (!msg) return
    
    options.onPauseAutoScroll()
    requestAnimationFrame(() => scrollToMessage(msg, "auto"))
  })

  createEffect(() => {
    if (!options.messagesReady()) return

    const handler = () => requestAnimationFrame(() => applyHash("auto"))
    window.addEventListener("hashchange", handler)
    onCleanup(() => window.removeEventListener("hashchange", handler))
  })

  return {
    scrollToMessage,
    clearMessageHash,
    applyHash,
  }
}
