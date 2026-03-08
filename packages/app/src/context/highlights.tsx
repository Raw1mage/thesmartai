import { createEffect, createSignal } from "solid-js"
import { createStore } from "solid-js/store"
import { createSimpleContext } from "@opencode-ai/ui/context"
import { usePlatform } from "@/context/platform"
import { persisted } from "@/utils/persist"

type Store = {
  version?: string
}

export const { use: useHighlights, provider: HighlightsProvider } = createSimpleContext({
  name: "Highlights",
  gate: false,
  init: () => {
    const platform = usePlatform()
    const [store, setStore, _, ready] = persisted("highlights.v1", createStore<Store>({ version: undefined }))

    const [from, setFrom] = createSignal<string | undefined>(undefined)
    const [to, setTo] = createSignal<string | undefined>(undefined)
    const state = { started: false }

    const markSeen = () => {
      if (!platform.version) return
      setStore("version", platform.version)
    }

    createEffect(() => {
      if (state.started) return
      if (!ready()) return
      if (!platform.version) return
      state.started = true

      const previous = store.version
      if (!previous) {
        markSeen()
        return
      }

      if (previous === platform.version) return

      setFrom(previous)
      setTo(platform.version)
      markSeen()
    })

    return {
      ready,
      from,
      to,
      get last() {
        return store.version
      },
      markSeen,
    }
  },
})
