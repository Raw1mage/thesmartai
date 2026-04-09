import { describe, expect, test } from "bun:test"
import { createRoot } from "solid-js"
import { createSpeechRecognition, inferPunctuation } from "./speech"

type FakeRecognitionInstance = {
  continuous: boolean
  interimResults: boolean
  lang: string
  start: () => void
  stop: () => void
  onresult:
    | ((e: { results: Array<{ 0: { transcript: string }; isFinal: boolean }>; resultIndex: number }) => void)
    | null
  onerror: ((e: { error: string }) => void) | null
  onend: (() => void) | null
  onstart: (() => void) | null
}

const installFakeSpeech = () => {
  const instances: FakeRecognitionInstance[] = []
  let startCalls = 0
  let stopCalls = 0

  class FakeRecognition implements FakeRecognitionInstance {
    continuous = false
    interimResults = false
    lang = "en-US"
    onresult: FakeRecognitionInstance["onresult"] = null
    onerror: FakeRecognitionInstance["onerror"] = null
    onend: FakeRecognitionInstance["onend"] = null
    onstart: FakeRecognitionInstance["onstart"] = null

    constructor() {
      instances.push(this)
    }

    start() {
      startCalls += 1
      this.onstart?.()
    }

    stop() {
      stopCalls += 1
      this.onend?.()
    }
  }

  const previous = (window as typeof window & { webkitSpeechRecognition?: unknown }).webkitSpeechRecognition
  ;(window as typeof window & { webkitSpeechRecognition?: unknown }).webkitSpeechRecognition = FakeRecognition

  return {
    instances,
    getStartCalls: () => startCalls,
    getStopCalls: () => stopCalls,
    restore: () => {
      ;(window as typeof window & { webkitSpeechRecognition?: unknown }).webkitSpeechRecognition = previous
    },
  }
}

describe("inferPunctuation", () => {
  test("CJK comma", () => {
    expect(inferPunctuation("你好", "comma")).toBe("，")
  })
  test("CJK period", () => {
    expect(inferPunctuation("你好", "period")).toBe("。")
  })
  test("CJK question — 嗎", () => {
    expect(inferPunctuation("你好嗎", "period")).toBe("？")
    expect(inferPunctuation("你好嗎", "comma")).toBe("？") // question particle always wins
  })
  test("CJK question — 呢", () => {
    expect(inferPunctuation("你呢", "period")).toBe("？")
  })
  test("already punctuated", () => {
    expect(inferPunctuation("你好。", "period")).toBe("")
    expect(inferPunctuation("hello!", "comma")).toBe("")
  })
  test("English comma/period", () => {
    expect(inferPunctuation("hello world", "comma")).toBe(", ")
    expect(inferPunctuation("hello world", "period")).toBe(". ")
  })
  test("empty", () => {
    expect(inferPunctuation("", "period")).toBe("")
  })
})

describe("speech recognition (live transcription + punctuation)", () => {
  test("shows live interim without punctuation", () => {
    const fake = installFakeSpeech()
    const transcripts: string[] = []

    try {
      createRoot((dispose) => {
        const speech = createSpeechRecognition({
          onTranscript: (text) => transcripts.push(text),
        })

        speech.start()
        const instance = fake.instances[0]
        expect(instance.continuous).toBe(true)

        // Interim — no punctuation
        instance.onresult?.({
          resultIndex: 0,
          results: [{ 0: { transcript: "你好" }, isFinal: false }],
        })
        expect(transcripts.at(-1)).toBe("你好")

        dispose()
      })
    } finally {
      fake.restore()
    }
  })

  test("short pause then continue → comma between segments", () => {
    const fake = installFakeSpeech()
    const transcripts: string[] = []

    try {
      createRoot((dispose) => {
        const speech = createSpeechRecognition({
          onTranscript: (text) => transcripts.push(text),
        })

        speech.start()
        const instance = fake.instances[0]

        // First utterance finalizes (user paused)
        instance.onresult?.({
          resultIndex: 0,
          results: [{ 0: { transcript: "你好" }, isFinal: true }],
        })
        // At this point, text shows without punctuation (pending)
        expect(transcripts.at(-1)).toBe("你好")

        // User continues — second utterance starts as interim
        // Browser accumulates: [final "你好", interim "世界"]
        instance.onresult?.({
          resultIndex: 1,
          results: [
            { 0: { transcript: "你好" }, isFinal: true },
            { 0: { transcript: "世界" }, isFinal: false },
          ],
        })
        // "你好" now has comma, "世界" is live interim
        expect(transcripts.at(-1)).toBe("你好世界")

        // Second utterance finalizes
        instance.onresult?.({
          resultIndex: 1,
          results: [
            { 0: { transcript: "你好" }, isFinal: true },
            { 0: { transcript: "世界" }, isFinal: true },
          ],
        })
        // comma inserted between the two final segments
        expect(transcripts.at(-1)).toBe("你好，世界")

        dispose()
      })
    } finally {
      fake.restore()
    }
  })

  test("3s silence → period", async () => {
    const fake = installFakeSpeech()
    const transcripts: string[] = []
    let disposeFn: VoidFunction | undefined

    try {
      createRoot((dispose) => {
        disposeFn = dispose
        const speech = createSpeechRecognition({
          onTranscript: (text) => transcripts.push(text),
        })

        speech.start()
        const instance = fake.instances[0]

        instance.onresult?.({
          resultIndex: 0,
          results: [{ 0: { transcript: "今天天氣好" }, isFinal: true }],
        })
        expect(transcripts.at(-1)).toBe("今天天氣好")
      })

      // Wait for period timer (3s)
      await new Promise((resolve) => setTimeout(resolve, 3100))
      expect(transcripts.at(-1)).toBe("今天天氣好。")
    } finally {
      disposeFn?.()
      fake.restore()
    }
  })

  test("3s silence with question particle → ？", async () => {
    const fake = installFakeSpeech()
    const transcripts: string[] = []
    let disposeFn: VoidFunction | undefined

    try {
      createRoot((dispose) => {
        disposeFn = dispose
        const speech = createSpeechRecognition({
          onTranscript: (text) => transcripts.push(text),
        })

        speech.start()
        const instance = fake.instances[0]

        instance.onresult?.({
          resultIndex: 0,
          results: [{ 0: { transcript: "你好嗎" }, isFinal: true }],
        })
      })

      await new Promise((resolve) => setTimeout(resolve, 3100))
      expect(transcripts.at(-1)).toBe("你好嗎？")
    } finally {
      disposeFn?.()
      fake.restore()
    }
  })

  test("explicit stop → period immediately", () => {
    const fake = installFakeSpeech()
    const transcripts: string[] = []

    try {
      createRoot((dispose) => {
        const speech = createSpeechRecognition({
          onTranscript: (text) => transcripts.push(text),
        })

        speech.start()
        const instance = fake.instances[0]

        instance.onresult?.({
          resultIndex: 0,
          results: [{ 0: { transcript: "今天天氣好" }, isFinal: true }],
        })
        expect(transcripts.at(-1)).toBe("今天天氣好")

        speech.stop()
        expect(transcripts.at(-1)).toBe("今天天氣好。")

        dispose()
      })
    } finally {
      fake.restore()
    }
  })

  test("explicit stop with question → ？", () => {
    const fake = installFakeSpeech()
    const transcripts: string[] = []

    try {
      createRoot((dispose) => {
        const speech = createSpeechRecognition({
          onTranscript: (text) => transcripts.push(text),
        })

        speech.start()
        const instance = fake.instances[0]

        instance.onresult?.({
          resultIndex: 0,
          results: [{ 0: { transcript: "你好嗎" }, isFinal: true }],
        })
        speech.stop()
        expect(transcripts.at(-1)).toBe("你好嗎？")

        dispose()
      })
    } finally {
      fake.restore()
    }
  })

  test("multi-segment with mixed punctuation", () => {
    const fake = installFakeSpeech()
    const transcripts: string[] = []

    try {
      createRoot((dispose) => {
        const speech = createSpeechRecognition({
          onTranscript: (text) => transcripts.push(text),
        })

        speech.start()
        const instance = fake.instances[0]

        // First: "你好" final
        instance.onresult?.({
          resultIndex: 0,
          results: [{ 0: { transcript: "你好" }, isFinal: true }],
        })

        // Second: "今天天氣好嗎" final (triggers comma on "你好")
        instance.onresult?.({
          resultIndex: 1,
          results: [
            { 0: { transcript: "你好" }, isFinal: true },
            { 0: { transcript: "今天天氣好嗎" }, isFinal: true },
          ],
        })
        // "你好" got comma, "今天天氣好嗎" pending
        expect(transcripts.at(-1)).toBe("你好，今天天氣好嗎")

        // Stop → "今天天氣好嗎" ends with 嗎 → ？
        speech.stop()
        expect(transcripts.at(-1)).toBe("你好，今天天氣好嗎？")

        dispose()
      })
    } finally {
      fake.restore()
    }
  })

  test("auto-restarts on onend while recording", async () => {
    const fake = installFakeSpeech()
    let disposeFn: VoidFunction | undefined

    try {
      createRoot((dispose) => {
        disposeFn = dispose
        const speech = createSpeechRecognition()
        speech.start()
        expect(fake.getStartCalls()).toBe(1)

        const instance = fake.instances[0]
        instance.onend?.()
        expect(speech.isRecording()).toBe(true)
      })

      await new Promise((resolve) => setTimeout(resolve, 200))
      expect(fake.getStartCalls()).toBe(2)
    } finally {
      disposeFn?.()
      fake.restore()
    }
  })

  test("does not restart after explicit stop", () => {
    const fake = installFakeSpeech()

    try {
      createRoot((dispose) => {
        const speech = createSpeechRecognition()
        speech.start()
        speech.stop()
        expect(speech.isRecording()).toBe(false)
        expect(fake.getStartCalls()).toBe(1)
        dispose()
      })
    } finally {
      fake.restore()
    }
  })
})
