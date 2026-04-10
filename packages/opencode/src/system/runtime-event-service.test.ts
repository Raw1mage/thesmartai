import { describe, expect, it } from "bun:test"
import { Instance } from "../project/instance"
import { Session } from "../session"
import { RuntimeEventService } from "./runtime-event-service"
import { tmpdir } from "../../test/fixture/fixture"
import { registerTelemetryRuntimePersistence } from "../bus/subscribers/telemetry-runtime"
import { Bus } from "../bus/index"
import { PromptTelemetryEvent } from "../session/llm"
import { SessionRoundTelemetryEvent } from "../session/processor"
import { TelemetryBenchmarkService } from "./telemetry-benchmark-service"
import { Storage } from "../storage/storage"

describe("runtime event service", () => {
  it("captures compaction state transition in benchmark comparison", () => {
    const baseline = TelemetryBenchmarkService.BenchmarkRecord.parse({
      benchmark: "short",
      phase: "baseline",
      sessionID: "s_baseline",
      providerId: "openai",
      modelId: "gpt-5.4",
      promptTelemetrySummary: {
        finalSystemTokens: 100,
        finalSystemChars: 400,
        finalSystemMessages: 2,
        messageCount: 4,
        maxBlockKey: "core_system_prompt",
        maxBlockTokens: 70,
      },
      roundTelemetrySummary: {
        finishReason: "stop",
        inputTokens: 300,
        outputTokens: 100,
        cacheReadTokens: 0,
        cacheWriteTokens: 0,
        totalTokens: 400,
        observedTokens: 400,
        usableTokens: 180000,
        contextLimit: 200000,
        inputLimit: 180000,
      },
      compactionStatus: {
        needsCompaction: false,
        observedToUsableRatio: 400 / 180000,
      },
      notes: "",
      capturedAt: 1,
    })

    const after = TelemetryBenchmarkService.BenchmarkRecord.parse({
      benchmark: "short",
      phase: "after_change",
      sessionID: "s_after",
      providerId: "openai",
      modelId: "gpt-5.4",
      promptTelemetrySummary: {
        finalSystemTokens: 90,
        finalSystemChars: 360,
        finalSystemMessages: 2,
        messageCount: 5,
        maxBlockKey: "core_system_prompt",
        maxBlockTokens: 60,
      },
      roundTelemetrySummary: {
        finishReason: "stop",
        inputTokens: 500,
        outputTokens: 180,
        cacheReadTokens: 0,
        cacheWriteTokens: 0,
        totalTokens: 680,
        observedTokens: 680,
        usableTokens: 180000,
        contextLimit: 200000,
        inputLimit: 180000,
      },
      compactionStatus: {
        needsCompaction: true,
        observedToUsableRatio: 680 / 180000,
      },
      notes: "",
      capturedAt: 2,
    })

    const comparison = TelemetryBenchmarkService.compareBenchmarkRecords(baseline, after)
    expect(comparison.delta.compactionStatus.needsCompaction).toEqual({
      before: false,
      after: true,
      changed: true,
    })
    expect(comparison.delta.roundTelemetrySummary.observedTokens).toBe(280)
    expect(comparison.delta.promptTelemetrySummary.finalSystemTokens).toBe(-10)
  })

  it("normalizes legacy after phase to after_change", () => {
    const record = TelemetryBenchmarkService.BenchmarkRecord.parse({
      benchmark: "short",
      phase: "after",
      sessionID: "legacy_after",
      providerId: "openai",
      modelId: "gpt-5.4",
      promptTelemetrySummary: {
        finalSystemTokens: 90,
        finalSystemChars: 360,
        finalSystemMessages: 2,
        messageCount: 5,
        maxBlockKey: "core_system_prompt",
        maxBlockTokens: 60,
      },
      roundTelemetrySummary: {
        finishReason: "stop",
        inputTokens: 260,
        outputTokens: 110,
        cacheReadTokens: 0,
        cacheWriteTokens: 0,
        totalTokens: 370,
        observedTokens: 370,
        usableTokens: 180000,
        contextLimit: 200000,
        inputLimit: 180000,
      },
      compactionStatus: {
        needsCompaction: false,
        observedToUsableRatio: 370 / 180000,
      },
      notes: "",
      capturedAt: 2,
    })

    expect(record.phase).toBe("after_change")
  })

  it("reads legacy after key via after_change getter", async () => {
    await using tmp = await tmpdir()
    await Instance.provide({
      directory: tmp.path,
      fn: async () => {
        const legacy = {
          benchmark: "short",
          phase: "after",
          label: "enablement-gating",
          scenario: "short-enablement-gating",
          sessionID: "legacy_after_session",
          providerId: "openai",
          modelId: "gpt-5.4",
          promptTelemetrySummary: {
            finalSystemTokens: 90,
            finalSystemChars: 360,
            finalSystemMessages: 2,
            messageCount: 5,
            maxBlockKey: "core_system_prompt",
            maxBlockTokens: 60,
          },
          roundTelemetrySummary: {
            finishReason: "stop",
            inputTokens: 260,
            outputTokens: 110,
            cacheReadTokens: 0,
            cacheWriteTokens: 0,
            totalTokens: 370,
            observedTokens: 370,
            usableTokens: 180000,
            contextLimit: 200000,
            inputLimit: 180000,
          },
          compactionStatus: {
            needsCompaction: false,
            observedToUsableRatio: 370 / 180000,
          },
          notes: "",
          capturedAt: 2,
        }

        await Storage.write(
          ["telemetry_benchmark", "session", "legacy_after_session", "after", "enablement-gating"],
          legacy,
        )

        const record = await TelemetryBenchmarkService.getAfterChangeRecord({
          sessionID: "legacy_after_session",
          label: "enablement-gating",
        })
        expect(record?.phase).toBe("after_change")
        expect(record?.scenario).toBe("short-enablement-gating")
      },
    })
  })

  it("compares stored records when after uses legacy key", async () => {
    await using tmp = await tmpdir()
    await Instance.provide({
      directory: tmp.path,
      fn: async () => {
        const baseline = TelemetryBenchmarkService.BenchmarkRecord.parse({
          benchmark: "short",
          phase: "baseline",
          scenario: "short-enablement-gating",
          sessionID: "legacy_cmp_baseline",
          providerId: "openai",
          modelId: "gpt-5.4",
          promptTelemetrySummary: {
            finalSystemTokens: 120,
            finalSystemChars: 480,
            finalSystemMessages: 2,
            messageCount: 4,
            maxBlockKey: "core_system_prompt",
            maxBlockTokens: 80,
          },
          roundTelemetrySummary: {
            finishReason: "stop",
            inputTokens: 300,
            outputTokens: 120,
            cacheReadTokens: 0,
            cacheWriteTokens: 0,
            totalTokens: 420,
            observedTokens: 420,
            usableTokens: 180000,
            contextLimit: 200000,
            inputLimit: 180000,
          },
          compactionStatus: {
            needsCompaction: false,
            observedToUsableRatio: 420 / 180000,
          },
          notes: "",
          capturedAt: 1,
        })
        const legacyAfter = {
          benchmark: "short",
          phase: "after",
          scenario: "short-enablement-gating",
          sessionID: "legacy_cmp_after",
          providerId: "openai",
          modelId: "gpt-5.4",
          promptTelemetrySummary: {
            finalSystemTokens: 90,
            finalSystemChars: 360,
            finalSystemMessages: 2,
            messageCount: 5,
            maxBlockKey: "core_system_prompt",
            maxBlockTokens: 60,
          },
          roundTelemetrySummary: {
            finishReason: "stop",
            inputTokens: 260,
            outputTokens: 110,
            cacheReadTokens: 0,
            cacheWriteTokens: 0,
            totalTokens: 370,
            observedTokens: 370,
            usableTokens: 180000,
            contextLimit: 200000,
            inputLimit: 180000,
          },
          compactionStatus: {
            needsCompaction: false,
            observedToUsableRatio: 370 / 180000,
          },
          notes: "",
          capturedAt: 2,
        }

        await Storage.write(
          ["telemetry_benchmark", "session", "legacy_cmp_baseline", "baseline", "legacy-fallback"],
          baseline,
        )
        await Storage.write(
          ["telemetry_benchmark", "session", "legacy_cmp_after", "after", "legacy-fallback"],
          legacyAfter,
        )

        const comparison = await TelemetryBenchmarkService.compareStoredBenchmarkRecords({
          baseline: { sessionID: "legacy_cmp_baseline", label: "legacy-fallback" },
          after: { sessionID: "legacy_cmp_after", label: "legacy-fallback" },
        })

        expect(comparison.after.phase).toBe("after_change")
        expect(comparison.delta.promptTelemetrySummary.finalSystemTokens).toBe(-30)
      },
    })
  })

  it("compares baseline and after records for the same scenario", () => {
    const baseline = TelemetryBenchmarkService.BenchmarkRecord.parse({
      benchmark: "short",
      phase: "baseline",
      label: "enablement-gating",
      scenario: "short-enablement-gating",
      sessionID: "s_baseline",
      providerId: "openai",
      modelId: "gpt-5.4",
      promptTelemetrySummary: {
        finalSystemTokens: 120,
        finalSystemChars: 480,
        finalSystemMessages: 2,
        messageCount: 4,
        maxBlockKey: "core_system_prompt",
        maxBlockTokens: 80,
      },
      roundTelemetrySummary: {
        finishReason: "stop",
        inputTokens: 300,
        outputTokens: 120,
        cacheReadTokens: 0,
        cacheWriteTokens: 0,
        totalTokens: 420,
        observedTokens: 420,
        usableTokens: 180000,
        contextLimit: 200000,
        inputLimit: 180000,
      },
      compactionStatus: {
        needsCompaction: false,
        observedToUsableRatio: 420 / 180000,
      },
      notes: "",
      capturedAt: 1,
    })

    const after = TelemetryBenchmarkService.BenchmarkRecord.parse({
      benchmark: "short",
      phase: "after_change",
      label: "enablement-gating",
      scenario: "short-enablement-gating",
      sessionID: "s_after",
      providerId: "openai",
      modelId: "gpt-5.4",
      promptTelemetrySummary: {
        finalSystemTokens: 90,
        finalSystemChars: 360,
        finalSystemMessages: 2,
        messageCount: 5,
        maxBlockKey: "core_system_prompt",
        maxBlockTokens: 60,
      },
      roundTelemetrySummary: {
        finishReason: "stop",
        inputTokens: 260,
        outputTokens: 110,
        cacheReadTokens: 0,
        cacheWriteTokens: 0,
        totalTokens: 370,
        observedTokens: 370,
        usableTokens: 180000,
        contextLimit: 200000,
        inputLimit: 180000,
      },
      compactionStatus: {
        needsCompaction: false,
        observedToUsableRatio: 370 / 180000,
      },
      notes: "",
      capturedAt: 2,
    })

    const delta = TelemetryBenchmarkService.compareBenchmarkDelta(baseline, after)
    expect(delta).toEqual({
      promptTelemetrySummary: {
        finalSystemTokens: -30,
        maxBlockTokens: -20,
      },
      roundTelemetrySummary: {
        observedTokens: -50,
        usableTokens: 0,
      },
      compactionStatus: {
        observedToUsableRatio: delta.compactionStatus.observedToUsableRatio,
        needsCompaction: {
          before: false,
          after: false,
          changed: false,
        },
      },
    })
    expect(delta.compactionStatus.observedToUsableRatio).toBeCloseTo((370 - 420) / 180000)

    const comparison = TelemetryBenchmarkService.compareBenchmarkRecords(baseline, after)
    expect(comparison.delta).toEqual(delta)
    const structuredDelta = TelemetryBenchmarkService.compareBenchmarkStructuredDelta(baseline, after)
    expect(structuredDelta).toMatchObject({
      finalSystemTokens: {
        baseline: 120,
        afterChange: 90,
        delta: -30,
      },
      maxBlockTokens: {
        baseline: 80,
        afterChange: 60,
        delta: -20,
      },
      observedTokens: {
        baseline: 420,
        afterChange: 370,
        delta: -50,
      },
      usableTokens: {
        baseline: 180000,
        afterChange: 180000,
        delta: 0,
      },
      observedToUsableRatio: {
        baseline: 420 / 180000,
        afterChange: 370 / 180000,
      },
      needsCompaction: {
        baseline: false,
        afterChange: false,
        changed: false,
      },
    })
    expect(structuredDelta.observedToUsableRatio.delta).toBeCloseTo((370 - 420) / 180000)
    const flatDelta = TelemetryBenchmarkService.compareRecords(baseline, after)
    expect(flatDelta).toEqual({
      finalSystemTokens: -30,
      maxBlockTokens: -20,
      observedTokens: -50,
      usableTokens: 0,
      observedToUsableRatio: flatDelta.observedToUsableRatio,
      needsCompaction: {
        before: false,
        after: false,
        changed: false,
      },
    })
    expect(flatDelta.observedToUsableRatio).toBeCloseTo((370 - 420) / 180000)
    expect(() =>
      TelemetryBenchmarkService.compareBenchmarkRecords(baseline, {
        ...after,
        scenario: "different-scenario",
      }),
    ).toThrow("Telemetry benchmark comparison requires matching scenario")
  })

  it("enforces comparison guards in delta helpers", () => {
    const baseline = TelemetryBenchmarkService.BenchmarkRecord.parse({
      benchmark: "short",
      phase: "baseline",
      scenario: "short-enablement-gating",
      sessionID: "s_baseline",
      providerId: "openai",
      modelId: "gpt-5.4",
      promptTelemetrySummary: {
        finalSystemTokens: 120,
        finalSystemChars: 480,
        finalSystemMessages: 2,
        messageCount: 4,
        maxBlockKey: "core_system_prompt",
        maxBlockTokens: 80,
      },
      roundTelemetrySummary: {
        finishReason: "stop",
        inputTokens: 300,
        outputTokens: 120,
        cacheReadTokens: 0,
        cacheWriteTokens: 0,
        totalTokens: 420,
        observedTokens: 420,
        usableTokens: 180000,
        contextLimit: 200000,
        inputLimit: 180000,
      },
      compactionStatus: {
        needsCompaction: false,
        observedToUsableRatio: 420 / 180000,
      },
      notes: "",
      capturedAt: 1,
    })

    const after = TelemetryBenchmarkService.BenchmarkRecord.parse({
      benchmark: "short",
      phase: "after_change",
      scenario: "short-enablement-gating",
      sessionID: "s_after",
      providerId: "openai",
      modelId: "gpt-5.4",
      promptTelemetrySummary: {
        finalSystemTokens: 90,
        finalSystemChars: 360,
        finalSystemMessages: 2,
        messageCount: 5,
        maxBlockKey: "core_system_prompt",
        maxBlockTokens: 60,
      },
      roundTelemetrySummary: {
        finishReason: "stop",
        inputTokens: 260,
        outputTokens: 110,
        cacheReadTokens: 0,
        cacheWriteTokens: 0,
        totalTokens: 370,
        observedTokens: 370,
        usableTokens: 180000,
        contextLimit: 200000,
        inputLimit: 180000,
      },
      compactionStatus: {
        needsCompaction: false,
        observedToUsableRatio: 370 / 180000,
      },
      notes: "",
      capturedAt: 2,
    })

    expect(() => TelemetryBenchmarkService.compareBenchmarkDelta(after, baseline)).toThrow(
      "Telemetry benchmark comparison requires baseline phase record",
    )
    expect(() => TelemetryBenchmarkService.compareBenchmarkStructuredDelta(baseline, baseline)).toThrow(
      "Telemetry benchmark comparison requires after_change phase record",
    )
    expect(() =>
      TelemetryBenchmarkService.compareBenchmarkDelta(
        { ...baseline, benchmark: "mid" },
        { ...after, phase: "after_change" },
      ),
    ).toThrow("Telemetry benchmark comparison requires matching benchmark type")
    expect(() =>
      TelemetryBenchmarkService.compareBenchmarkStructuredDelta(baseline, {
        ...after,
        scenario: "different-scenario",
      }),
    ).toThrow("Telemetry benchmark comparison requires matching scenario")
    expect(() => TelemetryBenchmarkService.compareRecords(after, baseline)).toThrow(
      "Telemetry benchmark comparison requires baseline phase record",
    )
    expect(() =>
      TelemetryBenchmarkService.compareRecords(baseline, {
        ...after,
        scenario: "different-scenario",
      }),
    ).toThrow("Telemetry benchmark comparison requires matching scenario")
    expect(() =>
      TelemetryBenchmarkService.compareRecords({ ...baseline, benchmark: "mid" }, { ...after, phase: "after_change" }),
    ).toThrow("Telemetry benchmark comparison requires matching benchmark type")
  })

  it("returns clear error when stored comparison records are missing", async () => {
    await using tmp = await tmpdir()
    await Instance.provide({
      directory: tmp.path,
      fn: async () => {
        await expect(
          TelemetryBenchmarkService.compareStoredBenchmarkRecords({
            baseline: { sessionID: "missing-baseline" },
            after: { sessionID: "missing-after" },
          }),
        ).rejects.toThrow("Telemetry benchmark baseline record not found")

        const session = await Session.create({})
        registerTelemetryRuntimePersistence()
        await Bus.publish(PromptTelemetryEvent, {
          sessionID: session.id,
          providerId: "openai",
          modelId: "gpt-5.4",
          accountId: "acct_1",
          finalSystemTokens: 120,
          finalSystemChars: 480,
          finalSystemMessages: 2,
          messageCount: 4,
          blocks: [
            {
              key: "core_system_prompt",
              name: "核心提詞",
              chars: 320,
              tokens: 80,
              injected: true,
              policy: "always_on",
            },
          ],
          timestamp: 1,
        })
        await Bus.publish(SessionRoundTelemetryEvent, {
          sessionID: session.id,
          roundIndex: 3,
          requestId: "req_1",
          providerId: "openai",
          modelId: "gpt-5.4",
          accountId: "acct_1",
          finishReason: "stop",
          inputTokens: 300,
          outputTokens: 120,
          cacheReadTokens: 0,
          cacheWriteTokens: 0,
          totalTokens: 420,
          cost: 0.42,
          contextLimit: 200000,
          inputLimit: 180000,
          reservedTokens: 20000,
          usableTokens: 180000,
          observedTokens: 420,
          needsCompaction: false,
          compactionResult: "completed",
          compactionDraftTokens: 128,
          compactionCount: 1,
          timestamp: 2,
        })
        await TelemetryBenchmarkService.captureBaselineRecord({
          sessionID: session.id,
          benchmark: "short",
        })

        await expect(
          TelemetryBenchmarkService.compareStoredBenchmarkRecords({
            baseline: { sessionID: session.id },
            after: { sessionID: session.id },
          }),
        ).rejects.toThrow("Telemetry benchmark after record not found")
      },
    })
  })

  it("captures baseline record with scenario+label and reads it by session or scenario", async () => {
    registerTelemetryRuntimePersistence()
    await using tmp = await tmpdir()
    await Instance.provide({
      directory: tmp.path,
      fn: async () => {
        const session = await Session.create({})
        await Bus.publish(PromptTelemetryEvent, {
          sessionID: session.id,
          providerId: "openai",
          modelId: "gpt-5.4",
          accountId: "acct_1",
          finalSystemTokens: 120,
          finalSystemChars: 480,
          finalSystemMessages: 2,
          messageCount: 4,
          blocks: [
            {
              key: "core_system_prompt",
              name: "核心提詞",
              chars: 320,
              tokens: 80,
              injected: true,
              policy: "always_on",
            },
          ],
          timestamp: 1,
        })
        await Bus.publish(SessionRoundTelemetryEvent, {
          sessionID: session.id,
          roundIndex: 3,
          requestId: "req_1",
          providerId: "openai",
          modelId: "gpt-5.4",
          accountId: "acct_1",
          finishReason: "stop",
          inputTokens: 300,
          outputTokens: 120,
          cacheReadTokens: 0,
          cacheWriteTokens: 0,
          totalTokens: 420,
          cost: 0.42,
          contextLimit: 200000,
          inputLimit: 180000,
          reservedTokens: 20000,
          usableTokens: 180000,
          observedTokens: 420,
          needsCompaction: false,
          compactionResult: "completed",
          compactionDraftTokens: 128,
          compactionCount: 1,
          timestamp: 2,
        })

        const baseline = await TelemetryBenchmarkService.captureBaselineRecord({
          sessionID: session.id,
          benchmark: "short",
          label: "enablement-gating",
          scenario: "short-enablement-gating",
        })
        const bySession = await TelemetryBenchmarkService.getBaselineRecord({
          sessionID: session.id,
          label: "enablement-gating",
        })
        const byScenario = await TelemetryBenchmarkService.getBaselineRecord({
          scenario: "short-enablement-gating",
          label: "enablement-gating",
        })

        expect(baseline.phase).toBe("baseline")
        expect(bySession).toEqual(baseline)
        expect(byScenario).toEqual(baseline)
      },
    })
  })

  it("captures after-change record with scenario+label and reads it by session or scenario", async () => {
    registerTelemetryRuntimePersistence()
    await using tmp = await tmpdir()
    await Instance.provide({
      directory: tmp.path,
      fn: async () => {
        const session = await Session.create({})
        await Bus.publish(PromptTelemetryEvent, {
          sessionID: session.id,
          providerId: "openai",
          modelId: "gpt-5.4",
          accountId: "acct_1",
          finalSystemTokens: 90,
          finalSystemChars: 360,
          finalSystemMessages: 2,
          messageCount: 5,
          blocks: [
            {
              key: "core_system_prompt",
              chars: 260,
              tokens: 60,
              injected: true,
              policy: "always_on",
            },
          ],
          timestamp: 3,
        })
        await Bus.publish(SessionRoundTelemetryEvent, {
          sessionID: session.id,
          providerId: "openai",
          modelId: "gpt-5.4",
          accountId: "acct_1",
          finishReason: "stop",
          inputTokens: 260,
          outputTokens: 110,
          cacheReadTokens: 0,
          cacheWriteTokens: 0,
          totalTokens: 370,
          cost: 0.37,
          contextLimit: 200000,
          inputLimit: 180000,
          reservedTokens: 20000,
          usableTokens: 180000,
          observedTokens: 370,
          needsCompaction: false,
          timestamp: 4,
        })

        const after = await TelemetryBenchmarkService.captureAfterChangeRecord({
          sessionID: session.id,
          benchmark: "short",
          label: "enablement-gating",
          scenario: "short-enablement-gating",
        })
        const bySession = await TelemetryBenchmarkService.getAfterChangeRecord({
          sessionID: session.id,
          label: "enablement-gating",
        })
        const byScenario = await TelemetryBenchmarkService.getAfterChangeRecord({
          scenario: "short-enablement-gating",
          label: "enablement-gating",
        })

        expect(after.phase).toBe("after_change")
        expect(bySession).toEqual(after)
        expect(byScenario).toEqual(after)
      },
    })
  })

  it("compares stored records by scenario and label", async () => {
    registerTelemetryRuntimePersistence()
    await using tmp = await tmpdir()
    await Instance.provide({
      directory: tmp.path,
      fn: async () => {
        const baselineSession = await Session.create({})
        await Bus.publish(PromptTelemetryEvent, {
          sessionID: baselineSession.id,
          providerId: "openai",
          modelId: "gpt-5.4",
          accountId: "acct_1",
          finalSystemTokens: 120,
          finalSystemChars: 480,
          finalSystemMessages: 2,
          messageCount: 4,
          blocks: [
            {
              key: "core_system_prompt",
              name: "核心提詞",
              chars: 320,
              tokens: 80,
              injected: true,
              policy: "always_on",
            },
          ],
          timestamp: 1,
        })
        await Bus.publish(SessionRoundTelemetryEvent, {
          sessionID: baselineSession.id,
          providerId: "openai",
          modelId: "gpt-5.4",
          accountId: "acct_1",
          finishReason: "stop",
          inputTokens: 300,
          outputTokens: 120,
          cacheReadTokens: 0,
          cacheWriteTokens: 0,
          totalTokens: 420,
          cost: 0.42,
          contextLimit: 200000,
          inputLimit: 180000,
          reservedTokens: 20000,
          usableTokens: 180000,
          observedTokens: 420,
          needsCompaction: false,
          timestamp: 2,
        })
        const baseline = await TelemetryBenchmarkService.captureBaselineRecord({
          sessionID: baselineSession.id,
          benchmark: "short",
          label: "enablement-gating",
          scenario: "short-enablement-gating",
        })

        const afterSession = await Session.create({})
        await Bus.publish(PromptTelemetryEvent, {
          sessionID: afterSession.id,
          providerId: "openai",
          modelId: "gpt-5.4",
          accountId: "acct_1",
          finalSystemTokens: 90,
          finalSystemChars: 360,
          finalSystemMessages: 2,
          messageCount: 5,
          blocks: [
            {
              key: "core_system_prompt",
              chars: 260,
              tokens: 60,
              injected: true,
              policy: "always_on",
            },
          ],
          timestamp: 3,
        })
        await Bus.publish(SessionRoundTelemetryEvent, {
          sessionID: afterSession.id,
          providerId: "openai",
          modelId: "gpt-5.4",
          accountId: "acct_1",
          finishReason: "stop",
          inputTokens: 260,
          outputTokens: 110,
          cacheReadTokens: 0,
          cacheWriteTokens: 0,
          totalTokens: 370,
          cost: 0.37,
          contextLimit: 200000,
          inputLimit: 180000,
          reservedTokens: 20000,
          usableTokens: 180000,
          observedTokens: 370,
          needsCompaction: false,
          timestamp: 4,
        })
        const after = await TelemetryBenchmarkService.captureAfterChangeRecord({
          sessionID: afterSession.id,
          benchmark: "short",
          label: "enablement-gating",
          scenario: "short-enablement-gating",
        })

        const comparison = await TelemetryBenchmarkService.compareStoredBenchmarkRecords({
          baseline: { scenario: "short-enablement-gating", label: "enablement-gating" },
          after: { scenario: "short-enablement-gating", label: "enablement-gating" },
        })

        expect(comparison.baseline.sessionID).toBe(baseline.sessionID)
        expect(comparison.after.sessionID).toBe(after.sessionID)
        expect(comparison.delta.promptTelemetrySummary.finalSystemTokens).toBe(-30)
        expect(comparison.delta.roundTelemetrySummary.observedTokens).toBe(-50)
      },
    })
  })

  it("reads after-change record by sessionID string overload", async () => {
    registerTelemetryRuntimePersistence()
    await using tmp = await tmpdir()
    await Instance.provide({
      directory: tmp.path,
      fn: async () => {
        const session = await Session.create({})
        await Bus.publish(PromptTelemetryEvent, {
          sessionID: session.id,
          providerId: "openai",
          modelId: "gpt-5.4",
          accountId: "acct_1",
          finalSystemTokens: 90,
          finalSystemChars: 360,
          finalSystemMessages: 2,
          messageCount: 5,
          blocks: [
            {
              key: "core_system_prompt",
              chars: 260,
              tokens: 60,
              injected: true,
              policy: "always_on",
            },
          ],
          timestamp: 3,
        })
        await Bus.publish(SessionRoundTelemetryEvent, {
          sessionID: session.id,
          providerId: "openai",
          modelId: "gpt-5.4",
          accountId: "acct_1",
          finishReason: "stop",
          inputTokens: 260,
          outputTokens: 110,
          cacheReadTokens: 0,
          cacheWriteTokens: 0,
          totalTokens: 370,
          cost: 0.37,
          contextLimit: 200000,
          inputLimit: 180000,
          reservedTokens: 20000,
          usableTokens: 180000,
          observedTokens: 370,
          needsCompaction: false,
          timestamp: 4,
        })

        const after = await TelemetryBenchmarkService.captureAfterChangeRecord({
          sessionID: session.id,
          benchmark: "short",
        })
        const byString = await TelemetryBenchmarkService.getAfterChangeRecord(session.id)

        expect(byString).toEqual(after)
      },
    })
  })

  it("builds after-change record without persisting", async () => {
    registerTelemetryRuntimePersistence()
    await using tmp = await tmpdir()
    await Instance.provide({
      directory: tmp.path,
      fn: async () => {
        const session = await Session.create({})
        await Bus.publish(PromptTelemetryEvent, {
          sessionID: session.id,
          providerId: "openai",
          modelId: "gpt-5.4",
          accountId: "acct_1",
          finalSystemTokens: 90,
          finalSystemChars: 360,
          finalSystemMessages: 2,
          messageCount: 5,
          blocks: [
            {
              key: "core_system_prompt",
              chars: 260,
              tokens: 60,
              injected: true,
              policy: "always_on",
            },
          ],
          timestamp: 3,
        })
        await Bus.publish(SessionRoundTelemetryEvent, {
          sessionID: session.id,
          providerId: "openai",
          modelId: "gpt-5.4",
          accountId: "acct_1",
          finishReason: "stop",
          inputTokens: 260,
          outputTokens: 110,
          cacheReadTokens: 0,
          cacheWriteTokens: 0,
          totalTokens: 370,
          cost: 0.37,
          contextLimit: 200000,
          inputLimit: 180000,
          reservedTokens: 20000,
          usableTokens: 180000,
          observedTokens: 370,
          needsCompaction: false,
          timestamp: 4,
        })

        const built = await TelemetryBenchmarkService.buildAfterChangeRecord({
          sessionID: session.id,
          benchmark: "short",
          label: "build-only",
          scenario: "short-build-only",
        })
        const persisted = await TelemetryBenchmarkService.getAfterChangeRecord({
          sessionID: session.id,
          label: "build-only",
        })

        expect(built.phase).toBe("after_change")
        expect(built.scenario).toBe("short-build-only")
        expect(persisted).toBeUndefined()
      },
    })
  })

  it("builds baseline record without persisting", async () => {
    registerTelemetryRuntimePersistence()
    await using tmp = await tmpdir()
    await Instance.provide({
      directory: tmp.path,
      fn: async () => {
        const session = await Session.create({})
        await Bus.publish(PromptTelemetryEvent, {
          sessionID: session.id,
          providerId: "openai",
          modelId: "gpt-5.4",
          accountId: "acct_1",
          finalSystemTokens: 120,
          finalSystemChars: 480,
          finalSystemMessages: 2,
          messageCount: 4,
          blocks: [
            {
              key: "core_system_prompt",
              name: "核心提詞",
              chars: 320,
              tokens: 80,
              injected: true,
              policy: "always_on",
            },
          ],
          timestamp: 1,
        })
        await Bus.publish(SessionRoundTelemetryEvent, {
          sessionID: session.id,
          providerId: "openai",
          modelId: "gpt-5.4",
          accountId: "acct_1",
          finishReason: "stop",
          inputTokens: 300,
          outputTokens: 120,
          cacheReadTokens: 0,
          cacheWriteTokens: 0,
          totalTokens: 420,
          cost: 0.42,
          contextLimit: 200000,
          inputLimit: 180000,
          reservedTokens: 20000,
          usableTokens: 180000,
          observedTokens: 420,
          needsCompaction: false,
          timestamp: 2,
        })

        const built = await TelemetryBenchmarkService.buildBaselineRecord({
          sessionID: session.id,
          benchmark: "short",
          label: "build-only-baseline",
          scenario: "short-build-only-baseline",
        })
        const persisted = await TelemetryBenchmarkService.getBaselineRecord({
          sessionID: session.id,
          label: "build-only-baseline",
        })

        expect(built.phase).toBe("baseline")
        expect(built.scenario).toBe("short-build-only-baseline")
        expect(persisted).toBeUndefined()
      },
    })
  })

  it("defaults benchmark capture/read phase to baseline", async () => {
    registerTelemetryRuntimePersistence()
    await using tmp = await tmpdir()
    await Instance.provide({
      directory: tmp.path,
      fn: async () => {
        const session = await Session.create({})
        await Bus.publish(PromptTelemetryEvent, {
          sessionID: session.id,
          providerId: "openai",
          modelId: "gpt-5.4",
          accountId: "acct_1",
          finalSystemTokens: 120,
          finalSystemChars: 480,
          finalSystemMessages: 2,
          messageCount: 4,
          blocks: [
            {
              key: "core_system_prompt",
              name: "核心提詞",
              chars: 320,
              tokens: 80,
              injected: true,
              policy: "always_on",
            },
          ],
          timestamp: 1,
        })
        await Bus.publish(SessionRoundTelemetryEvent, {
          sessionID: session.id,
          providerId: "openai",
          modelId: "gpt-5.4",
          accountId: "acct_1",
          finishReason: "stop",
          inputTokens: 300,
          outputTokens: 120,
          cacheReadTokens: 0,
          cacheWriteTokens: 0,
          totalTokens: 420,
          cost: 0.42,
          contextLimit: 200000,
          inputLimit: 180000,
          reservedTokens: 20000,
          usableTokens: 180000,
          observedTokens: 420,
          needsCompaction: false,
          timestamp: 2,
        })

        const captured = await TelemetryBenchmarkService.captureBenchmarkRecord({
          sessionID: session.id,
          benchmark: "short",
          label: "default-phase",
        })
        const readDefault = await TelemetryBenchmarkService.getBenchmarkRecord({
          sessionID: session.id,
          label: "default-phase",
        })

        expect(captured.phase).toBe("baseline")
        expect(readDefault).toEqual(captured)
      },
    })
  })

  it("persists structured session-scoped events and lists them in order", async () => {
    await using tmp = await tmpdir()
    await Instance.provide({
      directory: tmp.path,
      fn: async () => {
        const session = await Session.create({})
        await RuntimeEventService.append({
          sessionID: session.id,
          level: "info",
          domain: "mission",
          eventType: "mission.contract.attached",
          payload: { contract: "implementation_spec" },
        })
        await RuntimeEventService.append({
          sessionID: session.id,
          level: "warn",
          domain: "anomaly",
          eventType: "workflow.unreconciled_wait_subagent",
          todoID: "todo_1",
          anomalyFlags: ["unreconciled_wait_subagent"],
          payload: { activeSubtasks: 0 },
        })

        const events = await RuntimeEventService.list(session.id)
        expect(events).toHaveLength(2)
        expect(events[0]).toMatchObject({
          level: "info",
          domain: "mission",
          eventType: "mission.contract.attached",
          sessionID: session.id,
        })
        expect(events[1]).toMatchObject({
          level: "warn",
          domain: "anomaly",
          eventType: "workflow.unreconciled_wait_subagent",
          todoID: "todo_1",
          anomalyFlags: ["unreconciled_wait_subagent"],
        })
      },
    })
  })

  it("supports recent-event limits", async () => {
    await using tmp = await tmpdir()
    await Instance.provide({
      directory: tmp.path,
      fn: async () => {
        const session = await Session.create({})
        await RuntimeEventService.append({
          sessionID: session.id,
          level: "info",
          domain: "runner",
          eventType: "runner.started",
          payload: { seq: 1 },
          ts: 1,
        })
        await RuntimeEventService.append({
          sessionID: session.id,
          level: "info",
          domain: "runner",
          eventType: "runner.progress",
          payload: { seq: 2 },
          ts: 2,
        })
        await RuntimeEventService.append({
          sessionID: session.id,
          level: "info",
          domain: "runner",
          eventType: "runner.progress",
          payload: { seq: 3 },
          ts: 3,
        })

        const recent = await RuntimeEventService.list(session.id, { limit: 2 })
        expect(recent).toHaveLength(2)
        expect(recent[0]?.payload).toEqual({ seq: 2 })
        expect(recent[1]?.payload).toEqual({ seq: 3 })
      },
    })
  })

  it("persists session telemetry bus events for baseline capture", async () => {
    registerTelemetryRuntimePersistence()
    await using tmp = await tmpdir()
    await Instance.provide({
      directory: tmp.path,
      fn: async () => {
        const session = await Session.create({})
        await Bus.publish(PromptTelemetryEvent, {
          sessionID: session.id,
          providerId: "openai",
          modelId: "gpt-5.4",
          accountId: "acct_1",
          finalSystemTokens: 120,
          finalSystemChars: 480,
          finalSystemMessages: 2,
          messageCount: 4,
          blocks: [
            {
              key: "core_system_prompt",
              name: "核心提詞",
              chars: 320,
              tokens: 80,
              injected: true,
              policy: "always_on",
            },
          ],
          timestamp: 1,
        })
        await Bus.publish(SessionRoundTelemetryEvent, {
          sessionID: session.id,
          providerId: "openai",
          modelId: "gpt-5.4",
          accountId: "acct_1",
          finishReason: "stop",
          inputTokens: 300,
          outputTokens: 120,
          cacheReadTokens: 0,
          cacheWriteTokens: 0,
          totalTokens: 420,
          cost: 0.42,
          contextLimit: 200000,
          inputLimit: 180000,
          reservedTokens: 20000,
          usableTokens: 180000,
          observedTokens: 420,
          needsCompaction: false,
          timestamp: 2,
        })

        const events = await RuntimeEventService.list(session.id)
        expect(events.slice(-2)).toEqual([
          expect.objectContaining({
            domain: "telemetry",
            eventType: "llm.prompt.telemetry",
            sessionID: session.id,
          }),
          expect.objectContaining({
            domain: "telemetry",
            eventType: "session.round.telemetry",
            sessionID: session.id,
          }),
        ])
        expect(events.at(-2)?.payload).toMatchObject({
          finalSystemTokens: 120,
          blocks: [expect.objectContaining({ key: "core_system_prompt" })],
        })
        expect(events.at(-1)?.payload).toMatchObject({
          totalTokens: 420,
          needsCompaction: false,
        })

        const record = await TelemetryBenchmarkService.captureBaselineRecord({
          sessionID: session.id,
          benchmark: "short",
          notes: "first baseline capture",
        })
        const persisted = await TelemetryBenchmarkService.getBaselineRecord(session.id)
        expect(record.promptTelemetrySummary).toMatchObject({
          finalSystemTokens: 120,
          maxBlockKey: "core_system_prompt",
          maxBlockTokens: 80,
        })
        expect(record.phase).toBe("baseline")
        expect(record.roundTelemetrySummary).toMatchObject({
          totalTokens: 420,
          observedTokens: 420,
          usableTokens: 180000,
        })
        expect(record.compactionStatus).toMatchObject({
          needsCompaction: false,
        })
        expect(persisted).toEqual(record)

        await Bus.publish(PromptTelemetryEvent, {
          sessionID: session.id,
          providerId: "openai",
          modelId: "gpt-5.4",
          accountId: "acct_1",
          finalSystemTokens: 90,
          finalSystemChars: 360,
          finalSystemMessages: 2,
          messageCount: 5,
          blocks: [
            {
              key: "core_system_prompt",
              chars: 260,
              tokens: 60,
              injected: true,
              policy: "always_on",
            },
          ],
          timestamp: 3,
        })
        await Bus.publish(SessionRoundTelemetryEvent, {
          sessionID: session.id,
          roundIndex: 4,
          requestId: "req_2",
          providerId: "openai",
          modelId: "gpt-5.4",
          accountId: "acct_1",
          finishReason: "stop",
          inputTokens: 260,
          outputTokens: 110,
          cacheReadTokens: 0,
          cacheWriteTokens: 0,
          totalTokens: 370,
          cost: 0.37,
          contextLimit: 200000,
          inputLimit: 180000,
          reservedTokens: 20000,
          usableTokens: 180000,
          observedTokens: 370,
          needsCompaction: false,
          compactionResult: "completed",
          compactionDraftTokens: 96,
          compactionCount: 2,
          timestamp: 4,
        })

        const after = await TelemetryBenchmarkService.captureBenchmarkRecord({
          sessionID: session.id,
          benchmark: "short",
          phase: "after_change",
          label: "enablement-gating",
          scenario: "short-enablement-gating",
          notes: "after change capture",
        })
        const afterBySession = await TelemetryBenchmarkService.getBenchmarkRecord({
          sessionID: session.id,
          phase: "after_change",
          label: "enablement-gating",
        })
        const afterByScenario = await TelemetryBenchmarkService.getBenchmarkRecord({
          scenario: "short-enablement-gating",
          phase: "after_change",
          label: "enablement-gating",
        })
        const comparison = TelemetryBenchmarkService.compareBenchmarkRecords(record, after)
        const storedComparison = await TelemetryBenchmarkService.compareStoredBenchmarkRecords({
          baseline: { sessionID: session.id },
          after: {
            scenario: "short-enablement-gating",
            label: "enablement-gating",
          },
        })
        await TelemetryBenchmarkService.captureBenchmarkRecord({
          sessionID: session.id,
          benchmark: "mid",
          phase: "after_change",
          label: "mismatch-mid",
          notes: "mismatch benchmark capture",
        })

        expect(afterBySession).toEqual(after)
        expect(afterByScenario).toEqual(after)
        expect(comparison.delta).toEqual({
          promptTelemetrySummary: {
            finalSystemTokens: -30,
            maxBlockTokens: -20,
          },
          roundTelemetrySummary: {
            observedTokens: -50,
            usableTokens: 0,
          },
          compactionStatus: {
            observedToUsableRatio: comparison.delta.compactionStatus.observedToUsableRatio,
            needsCompaction: {
              before: false,
              after: false,
              changed: false,
            },
          },
        })
        expect(comparison.delta.compactionStatus.observedToUsableRatio).toBeCloseTo((370 - 420) / 180000)
        expect(storedComparison).toEqual(comparison)

        expect(() => TelemetryBenchmarkService.compareBenchmarkRecords(after, record)).toThrow(
          "Telemetry benchmark comparison requires baseline phase record",
        )
        expect(() => TelemetryBenchmarkService.compareBenchmarkRecords(record, record)).toThrow(
          "Telemetry benchmark comparison requires after_change phase record",
        )
        expect(() =>
          TelemetryBenchmarkService.compareBenchmarkRecords(
            { ...record, benchmark: "mid" },
            { ...after, phase: "after_change" },
          ),
        ).toThrow("Telemetry benchmark comparison requires matching benchmark type")
        await expect(
          TelemetryBenchmarkService.compareStoredBenchmarkRecords({
            baseline: { sessionID: session.id },
            after: { sessionID: session.id, label: "mismatch-mid" },
          }),
        ).rejects.toThrow("Telemetry benchmark comparison requires matching benchmark type")
      },
    })
  })
})
