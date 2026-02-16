/**
 * HealthScoreTracker — tracks account health based on success/failure patterns.
 *
 * @event_20260216_rotation_split — extracted from rotation.ts
 */

import { Log } from "../../util/log"
import { readUnifiedState, writeUnifiedState } from "./state"
import { type HealthScoreConfig, type HealthScoreState, DEFAULT_HEALTH_SCORE_CONFIG } from "./types"

const log = Log.create({ service: "health-tracker" })

/**
 * Tracks health scores for accounts by ID.
 * Higher score = healthier account = preferred for selection.
 *
 * @event_2026-02-06:rotation_unify
 * Now uses file-based persistence for cross-process state sharing.
 * Subagents will see rate limits from the parent process immediately.
 */
export class HealthScoreTracker {
    private readonly config: HealthScoreConfig
    // Key: "provider:accountId[:model]" -> health state
    private readonly scores = new Map<string, HealthScoreState>()

    constructor(config: Partial<HealthScoreConfig> = {}) {
        this.config = { ...DEFAULT_HEALTH_SCORE_CONFIG, ...config }
        this.loadFromFile()
    }

    private makeKey(provider: string, accountId: string, model?: string): string {
        // 3D Standard: Consistency across (provider, model, account)
        if (model) return `${provider}:${accountId}:${model}`
        // If accountId already contains provider (legacy), don't double it
        if (accountId.startsWith(`${provider}:`) || accountId.startsWith(`${provider}-`)) return accountId
        return `${provider}:${accountId}`
    }

    /**
     * Persist current state to shared file for cross-process access.
     * @event_2026-02-06:rotation_unify - Now uses unified rotation-state.json
     */
    private persistToFile(): void {
        const state = readUnifiedState()
        const data: Record<string, HealthScoreState> = {}
        for (const [key, scoreState] of this.scores) {
            data[key] = scoreState
        }
        state.accountHealth = data
        writeUnifiedState(state)
    }

    /**
     * Load state from unified state file (for cross-process sync).
     * @event_2026-02-06:rotation_unify - Now uses unified rotation-state.json
     */
    private loadFromFile(): void {
        const state = readUnifiedState()
        this.scores.clear()
        for (const [key, scoreState] of Object.entries(state.accountHealth)) {
            this.scores.set(key, scoreState as HealthScoreState)
        }
    }

    /**
     * Get current health score for an account/model, applying time-based recovery.
     */
    getScore(accountId: string, provider: string, model?: string): number {
        this.loadFromFile()
        const key = this.makeKey(provider, accountId, model)
        const state = this.scores.get(key)
        if (!state) {
            return this.config.initial
        }

        // Apply passive recovery based on time since last update
        const now = Date.now()
        const hoursSinceUpdate = (now - state.lastUpdated) / (1000 * 60 * 60)
        const recoveredPoints = Math.floor(hoursSinceUpdate * this.config.recoveryRatePerHour)

        return Math.min(this.config.maxScore, state.score + recoveredPoints)
    }

    /**
     * Record a successful request - improves health score.
     */
    recordSuccess(accountId: string, provider: string, model?: string): void {
        this.loadFromFile()
        const now = Date.now()
        const key = this.makeKey(provider, accountId, model)
        const current = this.getScore(accountId, provider, model)

        this.scores.set(key, {
            score: Math.min(this.config.maxScore, current + this.config.successReward),
            lastUpdated: now,
            lastSuccess: now,
            consecutiveFailures: 0,
        })

        this.persistToFile()
        log.debug("Account health: success recorded", { provider, accountId, model, newScore: this.scores.get(key)?.score })
    }

    /**
     * Record a rate limit hit - moderate penalty.
     */
    recordRateLimit(accountId: string, provider: string, model?: string): void {
        this.loadFromFile()
        const now = Date.now()
        const key = this.makeKey(provider, accountId, model)
        const state = this.scores.get(key)
        const current = this.getScore(accountId, provider, model)
        const newScore = Math.max(0, current + this.config.rateLimitPenalty)
        const newFailures = (state?.consecutiveFailures ?? 0) + 1

        this.scores.set(key, {
            score: newScore,
            lastUpdated: now,
            lastSuccess: state?.lastSuccess ?? 0,
            consecutiveFailures: newFailures,
        })

        this.persistToFile()
        log.info("Account health: rate limit recorded", {
            provider,
            accountId,
            model,
            newScore,
            consecutiveFailures: newFailures,
        })
    }

    /**
     * Record a failure (auth, network, etc.) - larger penalty.
     */
    recordFailure(accountId: string, provider: string, model?: string): void {
        this.loadFromFile()
        const now = Date.now()
        const key = this.makeKey(provider, accountId, model)
        const state = this.scores.get(key)
        const current = this.getScore(accountId, provider, model)
        const newScore = Math.max(0, current + this.config.failurePenalty)
        const newFailures = (state?.consecutiveFailures ?? 0) + 1

        this.scores.set(key, {
            score: newScore,
            lastUpdated: now,
            lastSuccess: state?.lastSuccess ?? 0,
            consecutiveFailures: newFailures,
        })

        this.persistToFile()
        log.info("Account health: failure recorded", {
            provider,
            accountId,
            model,
            newScore,
            consecutiveFailures: newFailures,
        })
    }

    /**
     * Check if account/model is healthy enough to use.
     */
    isUsable(accountId: string, provider: string, model?: string): boolean {
        return this.getScore(accountId, provider, model) >= this.config.minUsable
    }

    /**
     * Get consecutive failure count for an account/model.
     */
    getConsecutiveFailures(accountId: string, provider: string, model?: string): number {
        this.loadFromFile()
        const key = this.makeKey(provider, accountId, model)
        return this.scores.get(key)?.consecutiveFailures ?? 0
    }

    /**
     * Reset health state for an account/model (e.g., after removal).
     */
    reset(accountId: string, provider: string, model?: string): void {
        this.loadFromFile()
        const key = this.makeKey(provider, accountId, model)
        this.scores.delete(key)
        this.persistToFile()
    }

    /**
     * Get all scores for debugging/logging.
     */
    getSnapshot(): Map<string, { score: number; consecutiveFailures: number }> {
        this.loadFromFile()
        const result = new Map<string, { score: number; consecutiveFailures: number }>()
        for (const [key, state] of this.scores) {
            result.set(key, {
                score: state.score,
                consecutiveFailures: state.consecutiveFailures,
            })
        }
        return result
    }
}
