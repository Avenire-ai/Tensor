/**
 * Card Management
 * 
 * Card abstraction that bridges memory state and deck membership.
 * Cards store memory state and due dates (computed by scheduler).
 */

import { MemoryState, ReviewResult, PriorityStrategy } from "./types"

/**
 * Card class representing a single card in a deck
 */
export class Card {
  id: string
  deckId: string
  memoryState: MemoryState
  due: Date
  lastReviewed?: Date
  reviewCount: number

  constructor(
    id: string,
    deckId: string,
    memoryState: MemoryState,
    due: Date,
    lastReviewed?: Date,
    reviewCount: number = 0
  ) {
    this.id = id
    this.deckId = deckId
    this.memoryState = memoryState
    this.due = due
    this.lastReviewed = lastReviewed
    this.reviewCount = reviewCount
  }

  /**
   * Check if card is due at the given time
   */
  isDue(now: Date): boolean {
    return this.due <= now
  }

  /**
   * Check if card is overdue at the given time
   */
  isOverdue(now: Date): boolean {
    return this.due < now
  }

  /**
   * Compute priority for queue ordering
   * Higher priority = should be reviewed sooner
   */
  computePriority(now: Date, strategy: PriorityStrategy): number {
    switch (strategy) {
      case "due_first": {
        // Overdue cards get highest priority
        if (this.isOverdue(now)) {
          const overdueDays = (now.getTime() - this.due.getTime()) / (1000 * 60 * 60 * 24)
          // Higher priority for more overdue cards
          return 1000 + overdueDays
        }
        // Due cards get medium priority
        if (this.isDue(now)) {
          return 500
        }
        // Future cards get lower priority (closer to due = higher priority)
        const daysUntilDue = (this.due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
        return Math.max(0, 500 - daysUntilDue)
      }

      case "stability_low_first": {
        // Lower stability = higher priority
        // Invert stability so lower values get higher priority
        return 1000 / (this.memoryState.S + 1)
      }

      case "mixed": {
        // Combine due status and stability
        let priority = 0

        // Overdue penalty
        if (this.isOverdue(now)) {
          const overdueDays = (now.getTime() - this.due.getTime()) / (1000 * 60 * 60 * 24)
          priority += 1000 + overdueDays * 10
        } else if (this.isDue(now)) {
          priority += 500
        }

        // Stability component (lower stability = higher priority)
        priority += 100 / (this.memoryState.S + 1)

        return priority
      }

      default:
        return 0
    }
  }

  /**
   * Update card state after a review
   */
  updateAfterReview(result: ReviewResult, now: Date): void {
    this.memoryState = result.newMemoryState
    this.due = result.schedulingSuggestion.due
    this.lastReviewed = now
    this.reviewCount += 1
  }
}



