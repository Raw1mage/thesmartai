/**
 * Account selection strategies with health-aware scoring.
 *
 * @event_20260216_rotation_split — extracted from rotation.ts
 */

import { type AccountCandidate } from "./types"

/** Stickiness bonus added to current account's score to prevent unnecessary switching */
const STICKINESS_BONUS = 150

/** Minimum score advantage required to switch away from current account */
const SWITCH_THRESHOLD = 100

/**
 * Sort accounts by LRU (least recently used first) with health score tiebreaker.
 */
export function sortByLruWithHealth(accounts: AccountCandidate[], minHealthScore: number = 50): AccountCandidate[] {
    return accounts
        .filter((acc) => !acc.isRateLimited && !acc.isCoolingDown && acc.healthScore >= minHealthScore)
        .sort((a, b) => {
            // Primary: LRU (oldest lastUsed first)
            const lruDiff = a.lastUsed - b.lastUsed
            if (lruDiff !== 0) return lruDiff

            // Tiebreaker: higher health score wins
            return b.healthScore - a.healthScore
        })
}

/**
 * Select account using hybrid strategy with stickiness:
 * 1. Filter available accounts (not rate-limited, not cooling down, healthy)
 * 2. Calculate priority score: health (2x) + freshness (0.1x)
 * 3. Apply stickiness bonus to current account
 * 4. Only switch if another account beats current by SWITCH_THRESHOLD
 */
export function selectBestAccount(
    accounts: AccountCandidate[],
    currentAccountId: string | null = null,
    minHealthScore: number = 50,
): string | null {
    const candidates = accounts.filter(
        (acc) => !acc.isRateLimited && !acc.isCoolingDown && acc.healthScore >= minHealthScore,
    )

    if (candidates.length === 0) {
        return null
    }

    const scored = candidates
        .map((acc) => {
            const healthComponent = acc.healthScore * 2 // 0-200
            const secondsSinceUsed = (Date.now() - acc.lastUsed) / 1000
            const freshnessComponent = Math.min(secondsSinceUsed, 3600) * 0.1 // 0-360
            const baseScore = Math.max(0, healthComponent + freshnessComponent)

            // Apply stickiness bonus to current account
            const stickinessBonus = acc.id === currentAccountId ? STICKINESS_BONUS : 0

            return {
                id: acc.id,
                baseScore,
                score: baseScore + stickinessBonus,
                isCurrent: acc.id === currentAccountId,
            }
        })
        .sort((a, b) => b.score - a.score)

    const best = scored[0]
    if (!best) {
        return null
    }

    // If current account is still a candidate, check if switch is warranted
    const currentCandidate = scored.find((s) => s.isCurrent)
    if (currentCandidate && !best.isCurrent) {
        const advantage = best.baseScore - currentCandidate.baseScore
        if (advantage < SWITCH_THRESHOLD) {
            return currentCandidate.id
        }
    }

    return best.id
}
