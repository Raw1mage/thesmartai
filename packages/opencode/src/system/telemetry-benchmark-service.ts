import z from "zod"
import { RuntimeEventService } from "./runtime-event-service"
import { Storage } from "@/storage/storage"

export namespace TelemetryBenchmarkService {
  export const Benchmark = z.enum(["short", "mid", "long-planning"])
  export const BenchmarkPhase = z.enum(["baseline", "after_change"])

  export const PromptTelemetrySummary = z.object({
    finalSystemTokens: z.number(),
    finalSystemChars: z.number(),
    finalSystemMessages: z.number(),
    messageCount: z.number(),
    maxBlockKey: z.string().optional(),
    maxBlockTokens: z.number(),
  })

  export const RoundTelemetrySummary = z.object({
    finishReason: z.string(),
    inputTokens: z.number(),
    outputTokens: z.number(),
    cacheReadTokens: z.number(),
    cacheWriteTokens: z.number(),
    totalTokens: z.number(),
    observedTokens: z.number(),
    usableTokens: z.number(),
    contextLimit: z.number(),
    inputLimit: z.number().optional(),
  })

  export const BenchmarkRecord = z.object({
    benchmark: Benchmark,
    phase: z
      .union([BenchmarkPhase, z.literal("after")])
      .transform((phase) => (phase === "after" ? "after_change" : phase)),
    label: z.string().optional(),
    scenario: z.string().optional(),
    sessionID: z.string(),
    providerId: z.string(),
    modelId: z.string(),
    accountId: z.string().optional(),
    promptTelemetrySummary: PromptTelemetrySummary,
    roundTelemetrySummary: RoundTelemetrySummary,
    compactionStatus: z.object({
      needsCompaction: z.boolean(),
      observedToUsableRatio: z.number(),
    }),
    notes: z.string().default(""),
    capturedAt: z.number(),
  })
  export type BenchmarkRecord = z.infer<typeof BenchmarkRecord>
  export const BaselineRecord = BenchmarkRecord
  export type BaselineRecord = BenchmarkRecord

  const PromptPayload = z.object({
    sessionID: z.string(),
    providerId: z.string(),
    modelId: z.string(),
    accountId: z.string().optional(),
    finalSystemTokens: z.number(),
    finalSystemChars: z.number(),
    finalSystemMessages: z.number(),
    messageCount: z.number(),
    blocks: z.array(
      z.object({
        key: z.string(),
        chars: z.number(),
        tokens: z.number(),
        injected: z.boolean(),
        policy: z.string(),
      }),
    ),
    timestamp: z.number(),
  })

  const RoundPayload = z.object({
    sessionID: z.string(),
    roundIndex: z.number().optional(),
    requestId: z.string().optional(),
    providerId: z.string(),
    modelId: z.string(),
    accountId: z.string().optional(),
    finishReason: z.string(),
    inputTokens: z.number(),
    outputTokens: z.number(),
    cacheReadTokens: z.number(),
    cacheWriteTokens: z.number(),
    totalTokens: z.number(),
    cost: z.number(),
    contextLimit: z.number(),
    inputLimit: z.number().optional(),
    reservedTokens: z.number(),
    usableTokens: z.number(),
    observedTokens: z.number(),
    needsCompaction: z.boolean(),
    compactionResult: z.string().optional(),
    compactionDraftTokens: z.number().optional(),
    compactionCount: z.number().optional(),
    timestamp: z.number(),
  })

  function key(input: {
    sessionID?: string
    scenario?: string
    phase: z.infer<typeof BenchmarkPhase> | "after"
    label?: string
  }) {
    const label = input.label || "default"
    if (input.sessionID) return ["telemetry_benchmark", "session", input.sessionID, input.phase, label]
    if (input.scenario) return ["telemetry_benchmark", "scenario", input.scenario, input.phase, label]
    throw new Error("Telemetry benchmark key requires sessionID or scenario")
  }

  export async function buildBenchmarkRecord(input: {
    sessionID: string
    benchmark: z.infer<typeof Benchmark>
    phase?: z.infer<typeof BenchmarkPhase>
    label?: string
    scenario?: string
    notes?: string
  }) {
    const phase = input.phase ?? "baseline"
    const events = await RuntimeEventService.list(input.sessionID)
    const promptEvent = [...events]
      .reverse()
      .find((event) => event.domain === "telemetry" && event.eventType === "llm.prompt.telemetry")
    const roundEvent = [...events]
      .reverse()
      .find((event) => event.domain === "telemetry" && event.eventType === "session.round.telemetry")

    if (!promptEvent || !roundEvent) {
      throw new Error(`Telemetry benchmark requires both prompt and round events for session ${input.sessionID}`)
    }

    const prompt = PromptPayload.parse(promptEvent.payload)
    const round = RoundPayload.parse(roundEvent.payload)
    const maxBlock = [...prompt.blocks].sort((a, b) => b.tokens - a.tokens)[0]
    const observedToUsableRatio = round.usableTokens > 0 ? round.observedTokens / round.usableTokens : 0

    return BenchmarkRecord.parse({
      benchmark: input.benchmark,
      phase,
      label: input.label,
      scenario: input.scenario,
      sessionID: input.sessionID,
      providerId: round.providerId,
      modelId: round.modelId,
      accountId: round.accountId ?? prompt.accountId,
      promptTelemetrySummary: {
        finalSystemTokens: prompt.finalSystemTokens,
        finalSystemChars: prompt.finalSystemChars,
        finalSystemMessages: prompt.finalSystemMessages,
        messageCount: prompt.messageCount,
        maxBlockKey: maxBlock?.key,
        maxBlockTokens: maxBlock?.tokens ?? 0,
      },
      roundTelemetrySummary: {
        finishReason: round.finishReason,
        inputTokens: round.inputTokens,
        outputTokens: round.outputTokens,
        cacheReadTokens: round.cacheReadTokens,
        cacheWriteTokens: round.cacheWriteTokens,
        totalTokens: round.totalTokens,
        observedTokens: round.observedTokens,
        usableTokens: round.usableTokens,
        contextLimit: round.contextLimit,
        inputLimit: round.inputLimit,
      },
      compactionStatus: {
        needsCompaction: round.needsCompaction,
        observedToUsableRatio,
      },
      notes: input.notes ?? "",
      capturedAt: Date.now(),
    })
  }

  export async function captureBenchmarkRecord(input: {
    sessionID: string
    benchmark: z.infer<typeof Benchmark>
    phase?: z.infer<typeof BenchmarkPhase>
    label?: string
    scenario?: string
    notes?: string
  }) {
    const record = await buildBenchmarkRecord(input)
    const phase = input.phase ?? "baseline"
    await Storage.write(key({ sessionID: input.sessionID, phase, label: input.label }), record)
    if (input.scenario) {
      await Storage.write(key({ scenario: input.scenario, phase, label: input.label }), record)
    }
    return record
  }

  export async function getBenchmarkRecord(input: {
    sessionID?: string
    scenario?: string
    phase?: z.infer<typeof BenchmarkPhase>
    label?: string
  }) {
    const phase = input.phase ?? "baseline"
    if (!input.sessionID && !input.scenario) {
      throw new Error("Telemetry benchmark read requires sessionID or scenario")
    }
    const primary = await Storage.read<BenchmarkRecord>(key({ ...input, phase })).catch(() => undefined)
    if (primary) return BenchmarkRecord.parse(primary)
    if (phase === "after_change") {
      const legacy = await Storage.read<BenchmarkRecord>(key({ ...input, phase: "after" })).catch(() => undefined)
      if (legacy) return BenchmarkRecord.parse(legacy)
    }
    return undefined
  }

  export const BenchmarkComparison = z.object({
    baseline: z.object({
      sessionID: z.string(),
      benchmark: Benchmark,
      phase: BenchmarkPhase,
      label: z.string().optional(),
      scenario: z.string().optional(),
    }),
    after: z.object({
      sessionID: z.string(),
      benchmark: Benchmark,
      phase: BenchmarkPhase,
      label: z.string().optional(),
      scenario: z.string().optional(),
    }),
    delta: z.object({
      promptTelemetrySummary: z.object({
        finalSystemTokens: z.number(),
        maxBlockTokens: z.number(),
      }),
      roundTelemetrySummary: z.object({
        observedTokens: z.number(),
        usableTokens: z.number(),
      }),
      compactionStatus: z.object({
        observedToUsableRatio: z.number(),
        needsCompaction: z.object({
          before: z.boolean(),
          after: z.boolean(),
          changed: z.boolean(),
        }),
      }),
    }),
  })
  export type BenchmarkComparison = z.infer<typeof BenchmarkComparison>

  export const BenchmarkComparisonDelta = BenchmarkComparison.shape.delta
  export type BenchmarkComparisonDelta = z.infer<typeof BenchmarkComparisonDelta>

  export const StructuredBenchmarkDelta = z.object({
    finalSystemTokens: z.object({
      baseline: z.number(),
      afterChange: z.number(),
      delta: z.number(),
    }),
    maxBlockTokens: z.object({
      baseline: z.number(),
      afterChange: z.number(),
      delta: z.number(),
    }),
    observedTokens: z.object({
      baseline: z.number(),
      afterChange: z.number(),
      delta: z.number(),
    }),
    usableTokens: z.object({
      baseline: z.number(),
      afterChange: z.number(),
      delta: z.number(),
    }),
    observedToUsableRatio: z.object({
      baseline: z.number(),
      afterChange: z.number(),
      delta: z.number(),
    }),
    needsCompaction: z.object({
      baseline: z.boolean(),
      afterChange: z.boolean(),
      changed: z.boolean(),
    }),
  })
  export type StructuredBenchmarkDelta = z.infer<typeof StructuredBenchmarkDelta>

  function assertComparableRecords(baseline: BenchmarkRecord, after: BenchmarkRecord) {
    if (baseline.phase !== "baseline") {
      throw new Error("Telemetry benchmark comparison requires baseline phase record")
    }
    if (after.phase !== "after_change") {
      throw new Error("Telemetry benchmark comparison requires after_change phase record")
    }
    if (baseline.benchmark !== after.benchmark) {
      throw new Error("Telemetry benchmark comparison requires matching benchmark type")
    }
    if (baseline.scenario && after.scenario && baseline.scenario !== after.scenario) {
      throw new Error("Telemetry benchmark comparison requires matching scenario")
    }
  }

  export function compareBenchmarkStructuredDelta(baseline: BenchmarkRecord, afterChange: BenchmarkRecord) {
    assertComparableRecords(baseline, afterChange)
    return StructuredBenchmarkDelta.parse({
      finalSystemTokens: {
        baseline: baseline.promptTelemetrySummary.finalSystemTokens,
        afterChange: afterChange.promptTelemetrySummary.finalSystemTokens,
        delta: afterChange.promptTelemetrySummary.finalSystemTokens - baseline.promptTelemetrySummary.finalSystemTokens,
      },
      maxBlockTokens: {
        baseline: baseline.promptTelemetrySummary.maxBlockTokens,
        afterChange: afterChange.promptTelemetrySummary.maxBlockTokens,
        delta: afterChange.promptTelemetrySummary.maxBlockTokens - baseline.promptTelemetrySummary.maxBlockTokens,
      },
      observedTokens: {
        baseline: baseline.roundTelemetrySummary.observedTokens,
        afterChange: afterChange.roundTelemetrySummary.observedTokens,
        delta: afterChange.roundTelemetrySummary.observedTokens - baseline.roundTelemetrySummary.observedTokens,
      },
      usableTokens: {
        baseline: baseline.roundTelemetrySummary.usableTokens,
        afterChange: afterChange.roundTelemetrySummary.usableTokens,
        delta: afterChange.roundTelemetrySummary.usableTokens - baseline.roundTelemetrySummary.usableTokens,
      },
      observedToUsableRatio: {
        baseline: baseline.compactionStatus.observedToUsableRatio,
        afterChange: afterChange.compactionStatus.observedToUsableRatio,
        delta: afterChange.compactionStatus.observedToUsableRatio - baseline.compactionStatus.observedToUsableRatio,
      },
      needsCompaction: {
        baseline: baseline.compactionStatus.needsCompaction,
        afterChange: afterChange.compactionStatus.needsCompaction,
        changed: baseline.compactionStatus.needsCompaction !== afterChange.compactionStatus.needsCompaction,
      },
    })
  }

  export function compareBenchmarkDelta(baseline: BenchmarkRecord, after: BenchmarkRecord) {
    assertComparableRecords(baseline, after)
    const structured = compareBenchmarkStructuredDelta(baseline, after)
    return BenchmarkComparisonDelta.parse({
      promptTelemetrySummary: {
        finalSystemTokens: structured.finalSystemTokens.delta,
        maxBlockTokens: structured.maxBlockTokens.delta,
      },
      roundTelemetrySummary: {
        observedTokens: structured.observedTokens.delta,
        usableTokens: structured.usableTokens.delta,
      },
      compactionStatus: {
        observedToUsableRatio: structured.observedToUsableRatio.delta,
        needsCompaction: {
          before: structured.needsCompaction.baseline,
          after: structured.needsCompaction.afterChange,
          changed: structured.needsCompaction.changed,
        },
      },
    })
  }

  export function compareBenchmarkRecords(baseline: BenchmarkRecord, after: BenchmarkRecord) {
    assertComparableRecords(baseline, after)

    return BenchmarkComparison.parse({
      baseline: {
        sessionID: baseline.sessionID,
        benchmark: baseline.benchmark,
        phase: baseline.phase,
        label: baseline.label,
        scenario: baseline.scenario,
      },
      after: {
        sessionID: after.sessionID,
        benchmark: after.benchmark,
        phase: after.phase,
        label: after.label,
        scenario: after.scenario,
      },
      delta: compareBenchmarkDelta(baseline, after),
    })
  }

  export const CompareRecordsDelta = z.object({
    finalSystemTokens: z.number(),
    maxBlockTokens: z.number(),
    observedTokens: z.number(),
    usableTokens: z.number(),
    observedToUsableRatio: z.number(),
    needsCompaction: z.object({
      before: z.boolean(),
      after: z.boolean(),
      changed: z.boolean(),
    }),
  })
  export type CompareRecordsDelta = z.infer<typeof CompareRecordsDelta>

  export function compareRecords(before: BenchmarkRecord, after: BenchmarkRecord) {
    const structured = compareBenchmarkStructuredDelta(before, after)
    return CompareRecordsDelta.parse({
      finalSystemTokens: structured.finalSystemTokens.delta,
      maxBlockTokens: structured.maxBlockTokens.delta,
      observedTokens: structured.observedTokens.delta,
      usableTokens: structured.usableTokens.delta,
      observedToUsableRatio: structured.observedToUsableRatio.delta,
      needsCompaction: {
        before: structured.needsCompaction.baseline,
        after: structured.needsCompaction.afterChange,
        changed: structured.needsCompaction.changed,
      },
    })
  }

  export async function compareStoredBenchmarkRecords(input: {
    baseline: {
      sessionID?: string
      scenario?: string
      label?: string
    }
    after: {
      sessionID?: string
      scenario?: string
      label?: string
    }
  }) {
    const baselineRecord = await getBenchmarkRecord({ ...input.baseline, phase: "baseline" })
    if (!baselineRecord) {
      throw new Error("Telemetry benchmark baseline record not found")
    }
    const afterRecord = await getBenchmarkRecord({ ...input.after, phase: "after_change" })
    if (!afterRecord) {
      throw new Error("Telemetry benchmark after record not found")
    }
    return compareBenchmarkRecords(baselineRecord, afterRecord)
  }

  export async function buildBaselineRecord(input: {
    sessionID: string
    benchmark: z.infer<typeof Benchmark>
    label?: string
    scenario?: string
    notes?: string
  }) {
    return buildBenchmarkRecord({ ...input, phase: "baseline" })
  }

  export async function captureBaselineRecord(input: {
    sessionID: string
    benchmark: z.infer<typeof Benchmark>
    label?: string
    scenario?: string
    notes?: string
  }) {
    return captureBenchmarkRecord({ ...input, phase: "baseline" })
  }

  export async function getBaselineRecord(input: string | { sessionID?: string; scenario?: string; label?: string }) {
    if (typeof input === "string") {
      return getBenchmarkRecord({ sessionID: input, phase: "baseline" })
    }
    return getBenchmarkRecord({ ...input, phase: "baseline" })
  }

  export async function buildAfterChangeRecord(input: {
    sessionID: string
    benchmark: z.infer<typeof Benchmark>
    label?: string
    scenario?: string
    notes?: string
  }) {
    return buildBenchmarkRecord({ ...input, phase: "after_change" })
  }

  export async function captureAfterChangeRecord(input: {
    sessionID: string
    benchmark: z.infer<typeof Benchmark>
    label?: string
    scenario?: string
    notes?: string
  }) {
    return captureBenchmarkRecord({ ...input, phase: "after_change" })
  }

  export async function getAfterChangeRecord(
    input: string | { sessionID?: string; scenario?: string; label?: string },
  ) {
    if (typeof input === "string") {
      return getBenchmarkRecord({ sessionID: input, phase: "after_change" })
    }
    return getBenchmarkRecord({ ...input, phase: "after_change" })
  }
}
