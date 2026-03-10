import { TextField } from "@opencode-ai/ui/text-field"
import { Logo } from "@opencode-ai/ui/logo"
import { Button } from "@opencode-ai/ui/button"
import { Component, Show, createEffect, createMemo, createSignal, onCleanup } from "solid-js"
import { createStore } from "solid-js/store"
import { usePlatform } from "@/context/platform"
import { useLanguage } from "@/context/language"
import { checkServerHealth } from "@/utils/server-health"
import { formatError } from "./error-format"
export type { InitError } from "./error-format"

interface ErrorPageProps {
  error: unknown
}

export const ErrorPage: Component<ErrorPageProps> = (props) => {
  const platform = usePlatform()
  const language = useLanguage()
  const [reconnecting, setReconnecting] = createSignal(false)
  const [store, setStore] = createStore({
    checking: false,
    version: undefined as string | undefined,
    actionError: undefined as string | undefined,
  })

  const formattedError = createMemo(() => formatError(props.error, language.t))
  const isLikelyRestartTransition = createMemo(() => {
    const text = formattedError()
    return /<!doctype\s+html/i.test(text) || /<html[\s>]/i.test(text) || /text\/html/i.test(text)
  })

  createEffect(() => {
    if (!isLikelyRestartTransition()) {
      setReconnecting(false)
      return
    }
    setReconnecting(true)
    let disposed = false
    const tick = async () => {
      try {
        const health = await checkServerHealth(window.location.origin, platform.fetch ?? fetch, {
          timeoutMs: 1200,
          retryCount: 0,
        })
        if (disposed) return
        if (health.healthy) window.location.reload()
      } catch {
        // keep polling until service is healthy
      }
    }
    void tick()
    const timer = window.setInterval(() => {
      void tick()
    }, 1200)
    onCleanup(() => {
      disposed = true
      clearInterval(timer)
    })
  })

  async function checkForUpdates() {
    if (!platform.checkUpdate) return
    setStore("checking", true)
    await platform
      .checkUpdate()
      .then((result) => {
        setStore("actionError", undefined)
        if (result.updateAvailable && result.version) setStore("version", result.version)
      })
      .catch((err) => {
        setStore("actionError", formatError(err, language.t))
      })
      .finally(() => {
        setStore("checking", false)
      })
  }

  async function installUpdate() {
    if (!platform.update || !platform.restart) return
    await platform
      .update()
      .then(() => platform.restart!())
      .then(() => setStore("actionError", undefined))
      .catch((err) => {
        setStore("actionError", formatError(err, language.t))
      })
  }

  return (
    <div class="relative flex-1 h-screen w-screen min-h-0 flex flex-col items-center justify-center bg-background-base font-sans">
      <div class="w-2/3 max-w-3xl flex flex-col items-center justify-center gap-8">
        <Logo class="w-58.5 opacity-12 shrink-0" />
        <div class="flex flex-col items-center gap-2 text-center">
          <h1 class="text-lg font-medium text-text-strong">
            {reconnecting() ? "Reconnecting to server…" : language.t("error.page.title")}
          </h1>
          <p class="text-sm text-text-weak">
            {reconnecting()
              ? "Planned restart in progress. Please wait a moment."
              : language.t("error.page.description")}
          </p>
        </div>
        <Show
          when={!reconnecting()}
          fallback={
            <div class="text-12-regular text-text-weak">
              {language.t("common.loading")}
              {language.t("common.loading.ellipsis")}
            </div>
          }
        >
          <TextField
            value={formattedError()}
            readOnly
            copyable
            multiline
            class="max-h-96 w-full font-mono text-xs no-scrollbar"
            label={language.t("error.page.details.label")}
            hideLabel
          />
        </Show>
        <div class="flex items-center gap-3">
          <Button size="large" onClick={platform.restart}>
            {language.t("error.page.action.restart")}
          </Button>
          <Show when={platform.checkUpdate}>
            <Show
              when={store.version}
              fallback={
                <Button size="large" variant="ghost" onClick={checkForUpdates} disabled={store.checking}>
                  {store.checking
                    ? language.t("error.page.action.checking")
                    : language.t("error.page.action.checkUpdates")}
                </Button>
              }
            >
              <Button size="large" onClick={installUpdate}>
                {language.t("error.page.action.updateTo", { version: store.version ?? "" })}
              </Button>
            </Show>
          </Show>
        </div>
        <Show when={store.actionError}>
          {(message) => <p class="text-xs text-text-danger-base text-center max-w-2xl">{message()}</p>}
        </Show>
        <div class="flex flex-col items-center gap-2">
          <Show when={platform.version}>
            {(version) => (
              <p class="text-xs text-text-weak">{language.t("error.page.version", { version: version() })}</p>
            )}
          </Show>
        </div>
      </div>
    </div>
  )
}
