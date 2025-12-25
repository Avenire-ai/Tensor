/**
 * Statistics Aggregation
 * 
 * Deck-level and global statistics computation.
 * Statistics are computed, not stored (stateless aggregation).
 */

import { Card } from "./card"
import { DeckStatistics, GlobalStatistics, LoadMetrics, PerformanceMetrics } from "./types"

/**
 * Compute deck statistics
 */
export function computeDeckStatistics(
  cards: Card[],
  dailyCapacity: number,
  now: Date = new Date()
): DeckStatistics {
  const totalCards = cards.length
  const dueToday = cards.filter((card) => card.isDue(now)).length
  const backlogSize = cards.filter((card) => card.isOverdue(now)).length

  // Compute average stability
  const averageStability =
    cards.length > 0
      ? cards.reduce((sum, card) => sum + card.memoryState.S, 0) / cards.length
      : 0

  // Compute recent failure rate (simplified - would need review history in real implementation)
  // For now, use a placeholder calculation based on stability distribution
  // Lower average stability might indicate higher failure rate
  const recentFailureRate = Math.max(
    0,
    Math.min(1, 0.3 - averageStability / 100)
  )

  // Compute load ratio
  const loadRatio = dailyCapacity > 0 ? dueToday / dailyCapacity : 0

  return {
    totalCards,
    dueToday,
    backlogSize,
    recentFailureRate,
    averageStability,
    loadRatio,
  }
}

/**
 * Aggregate global statistics across all decks
 */
export function aggregateGlobalStatistics(
  deckStats: DeckStatistics[]
): GlobalStatistics {
  if (deckStats.length === 0) {
    return {
      totalCards: 0,
      totalDueToday: 0,
      totalBacklog: 0,
      averageFailureRate: 0,
      averageStability: 0,
      deckCount: 0,
    }
  }

  const totalCards = deckStats.reduce((sum, stats) => sum + stats.totalCards, 0)
  const totalDueToday = deckStats.reduce(
    (sum, stats) => sum + stats.dueToday,
    0
  )
  const totalBacklog = deckStats.reduce(
    (sum, stats) => sum + stats.backlogSize,
    0
  )

  // Weighted average failure rate
  const weightedFailureRate =
    deckStats.reduce(
      (sum, stats) => sum + stats.recentFailureRate * stats.totalCards,
      0
    ) / totalCards

  // Weighted average stability
  const weightedStability =
    deckStats.reduce(
      (sum, stats) => sum + stats.averageStability * stats.totalCards,
      0
    ) / totalCards

  return {
    totalCards,
    totalDueToday,
    totalBacklog,
    averageFailureRate: weightedFailureRate,
    averageStability: weightedStability,
    deckCount: deckStats.length,
  }
}

/**
 * Compute load metrics
 */
export function computeLoadMetrics(
  cards: Card[],
  dailyCapacity: number,
  now: Date = new Date()
): LoadMetrics {
  const dueToday = cards.filter((card) => card.isDue(now)).length
  const backlogSize = cards.filter((card) => card.isOverdue(now)).length
  const loadRatio = dailyCapacity > 0 ? dueToday / dailyCapacity : 0

  return {
    dueToday,
    backlogSize,
    dailyCapacity,
    loadRatio,
  }
}

/**
 * Compute performance metrics
 * Note: This is a simplified version. A real implementation would need
 * review history to compute accurate performance metrics.
 */
export function computePerformanceMetrics(
  cards: Card[],
  timeWindowDays: number = 30
): PerformanceMetrics {
  if (cards.length === 0) {
    return {
      failureRate: 0,
      successRate: 0,
      averageStability: 0,
      reviewCount: 0,
    }
  }

  // Simplified: estimate failure rate from stability distribution
  // Lower stability cards are more likely to have failed recently
  const averageStability =
    cards.reduce((sum, card) => sum + card.memoryState.S, 0) / cards.length

  // Estimate failure rate (inverse relationship with stability)
  const failureRate = Math.max(0, Math.min(1, 0.3 - averageStability / 100))
  const successRate = 1 - failureRate

  // Count reviews in time window (simplified - would need review history)
  const now = new Date()
  const timeWindowMs = timeWindowDays * 24 * 60 * 60 * 1000
  const reviewCount = cards.filter((card) => {
    if (!card.lastReviewed) return false
    return now.getTime() - card.lastReviewed.getTime() <= timeWindowMs
  }).length

  return {
    failureRate,
    successRate,
    averageStability,
    reviewCount,
  }
}



