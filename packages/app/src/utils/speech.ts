import { onCleanup } from "solid-js"
import { createStore } from "solid-js/store"
import { getSpeechRecognitionCtor } from "@/utils/runtime-adapters"

// Minimal types to avoid relying on non-standard DOM typings
type RecognitionResult = {
  0: { transcript: string }
  isFinal: boolean
}

type RecognitionEvent = {
  results: RecognitionResult[]
  resultIndex: number
}

interface Recognition {
  continuous: boolean
  interimResults: boolean
  lang: string
  start: () => void
  stop: () => void
  onresult: ((e: RecognitionEvent) => void) | null
  onerror: ((e: { error: string }) => void) | null
  onend: (() => void) | null
  onstart: (() => void) | null
}

const PERIOD_DELAY = 3000

const hasCJK = (text: string) => /[\u4e00-\u9fff\u3400-\u4dbf]/.test(text)

/**
 * Infer punctuation for a finalized segment.
 * - Question particles (嗎/呢) → ？
 * - "comma" (short pause, user continued) → ，/,
 * - "period" (3s silence or explicit stop) → 。/.
 * - Already ends with punctuation → empty
 */
export const inferPunctuation = (text: string, type: "comma" | "period"): string => {
  const trimmed = text.trim()
  if (!trimmed) return ""
  const last = trimmed[trimmed.length - 1]
  if (/[，。？！、；：,.?!;:\-…]/.test(last)) return ""

  if (/[嗎呢]$/.test(trimmed)) return "？"

  const cjk = hasCJK(trimmed)
  if (type === "comma") return cjk ? "，" : ", "
  return cjk ? "。" : ". "
}

/**
 * Live-transcription speech recognition with smart punctuation.
 *
 * - `continuous = true`: keeps listening until explicitly stopped.
 * - On every `onresult`, builds the full transcript with punctuation and
 *   pushes it via `onTranscript`.
 * - Punctuation logic:
 *   - isFinal fires (user paused) → no punctuation yet, start 3s timer
 *   - New speech within 3s → comma before new segment
 *   - 3s silence → period (or ？ for question particles)
 *   - Explicit stop → period immediately
 */
export function createSpeechRecognition(opts?: {
  lang?: string
  onTranscript?: (text: string) => void
}) {
  const ctor = getSpeechRecognitionCtor<Recognition>(typeof window === "undefined" ? undefined : window)
  const hasSupport = Boolean(ctor)

  const [store, setStore] = createStore({
    isRecording: false,
    transcript: "",
  })

  const isRecording = () => store.isRecording
  const transcript = () => store.transcript

  let recognition: Recognition | undefined
  let shouldContinue = false
  let restartTimer: number | undefined

  // Punctuation state — persists across auto-restarts
  let assembledText = "" // finalized text with punctuation already decided
  let lastFinalText = "" // most recent final segment, trailing punct pending
  let processedFinals = 0 // how many final results processed in current session
  let periodTimer: number | undefined

  const clearRestart = () => {
    if (restartTimer === undefined) return
    window.clearTimeout(restartTimer)
    restartTimer = undefined
  }

  const clearPeriodTimer = () => {
    if (periodTimer === undefined) return
    window.clearTimeout(periodTimer)
    periodTimer = undefined
  }

  const scheduleRestart = () => {
    clearRestart()
    if (!shouldContinue || !recognition) return
    restartTimer = window.setTimeout(() => {
      restartTimer = undefined
      if (!shouldContinue || !recognition) return
      try {
        recognition.start()
      } catch {}
    }, 150)
  }

  const pushUpdate = (interim: string) => {
    const full = (assembledText + lastFinalText + interim).trim()
    console.debug("[speech] push", { assembledText, lastFinalText, interim, full })
    setStore("transcript", full)
    if (opts?.onTranscript) opts.onTranscript(full)
  }

  /** Commit lastFinalText with period/question mark (3s timeout or explicit stop). */
  const commitPeriod = () => {
    if (!lastFinalText) return
    const punct = inferPunctuation(lastFinalText, "period")
    assembledText += lastFinalText + punct
    lastFinalText = ""
    pushUpdate("")
  }

  if (ctor) {
    recognition = new ctor()
    recognition.continuous = true
    recognition.interimResults = true
    recognition.lang = opts?.lang || (typeof navigator !== "undefined" ? navigator.language : "en-US")

    recognition.onresult = (event: RecognitionEvent) => {
      if (!event.results.length) return

      let finalCount = 0
      const newFinals: string[] = []
      let interim = ""

      for (let i = 0; i < event.results.length; i += 1) {
        const text = event.results[i][0]?.transcript ?? ""
        if (event.results[i].isFinal) {
          finalCount++
          if (finalCount > processedFinals) {
            newFinals.push(text)
          }
        } else {
          interim = text
        }
      }

      if (newFinals.length > 0) {
        clearPeriodTimer()

        for (const text of newFinals) {
          if (lastFinalText) {
            // Previous segment pending — user continued speaking → comma
            const punct = inferPunctuation(lastFinalText, "comma")
            assembledText += lastFinalText + punct
          }
          lastFinalText = text
        }
        processedFinals = finalCount

        // Start 3s timer — if no new speech, add period
        periodTimer = window.setTimeout(() => {
          periodTimer = undefined
          commitPeriod()
        }, PERIOD_DELAY)
      }

      pushUpdate(interim)
    }

    recognition.onerror = (e: { error: string }) => {
      console.debug("[speech] onerror", e.error)
      clearRestart()
      if (e.error === "no-speech") {
        if (shouldContinue) {
          scheduleRestart()
          return
        }
      }
      shouldContinue = false
      setStore("isRecording", false)
    }

    recognition.onstart = () => {
      console.debug("[speech] onstart")
      clearRestart()
      // processedFinals resets per browser session (results array resets)
      processedFinals = 0
      setStore("isRecording", true)
    }

    recognition.onend = () => {
      console.debug("[speech] onend", { shouldContinue })
      clearRestart()
      if (shouldContinue) {
        scheduleRestart()
        return
      }
      setStore("isRecording", false)
    }
  }

  const start = () => {
    if (!recognition) return
    clearRestart()
    clearPeriodTimer()
    shouldContinue = true
    assembledText = ""
    lastFinalText = ""
    processedFinals = 0
    setStore("transcript", "")
    try {
      recognition.start()
    } catch {}
  }

  const stop = () => {
    if (!recognition) return
    shouldContinue = false
    clearRestart()
    clearPeriodTimer()
    // Commit any pending text with period immediately
    if (lastFinalText) {
      commitPeriod()
    }
    try {
      recognition.stop()
    } catch {}
  }

  onCleanup(() => {
    shouldContinue = false
    clearRestart()
    clearPeriodTimer()
    try {
      recognition?.stop()
    } catch {}
  })

  return {
    isSupported: () => hasSupport,
    isRecording,
    transcript,
    start,
    stop,
  }
}
