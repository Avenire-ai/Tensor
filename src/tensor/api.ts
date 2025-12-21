/**
 * Tensor v2 Public API
 * 
 * Class-based API that wraps the v1 engine with decks, queues, and policy merging.
 */

import { Deck } from "./deck"
import { aggregateGlobalStatistics } from "./statistics"
import {
  TensorConfig,
  DeckConfig,
  MemoryState,
  ReviewOutcome,
  ReviewResult,
  SessionContext,
  GlobalStatistics,
  SerializedDeck,
} from "./types"
import { Scheduler, SchedulerInput, SchedulerOutput } from "../scheduler/types"
import { reviewStep, ReviewStepInput } from "./reviewStep"
import { mergePolicyContext } from "./policyMerge"

/**
 * Tensor class - main public API for Tensor v2
 */
export class Tensor {
  private decks: Map<string, Deck>
  private defaultScheduler: Scheduler
  private config: TensorConfig

  constructor(config: TensorConfig = {}) {
    this.decks = new Map()
    this.config = config
    // If no default scheduler provided, create a simple one
    this.defaultScheduler = config.defaultScheduler ?? new DefaultScheduler()
  }

  /**
   * Review a card directly (without deck)
   * This is the core review function that wraps reviewStep
   */
  review(
    memoryState: MemoryState,
    reviewOutcome: ReviewOutcome,
    policyContext: SessionContext,
    now: Date
  ): ReviewResult {
    // Merge policy context (no deck defaults in this case)
    const mergedContext = mergePolicyContext(
      undefined, // No deck config
      policyContext,
      this.defaultScheduler
    )

    // Prepare review step input
    const reviewInput: ReviewStepInput = {
      S: memoryState.S,
      difficulty: memoryState.difficulty,
      t: memoryState.t,
      scheduled_t: memoryState.scheduled_t,
      grade: reviewOutcome,
      early: mergedContext.early,
      postponed: mergedContext.postponed,
      R_target: mergedContext.R_target,
      retentionSignals: mergedContext.retentionSignals,
      reviewsSoFarInSession: mergedContext.reviewsSoFarInSession,
      contextSignals: mergedContext.contextSignals,
      now,
      scheduler: mergedContext.scheduler,
    }

    // Call v1 review step
    const result = reviewStep(reviewInput)

    // Return result
    return {
      newMemoryState: {
        S: result.S_new,
        difficulty: memoryState.difficulty,
        t: 0, // Reset elapsed time
        scheduled_t: undefined,
      },
      schedulingSuggestion: {
        nextInterval: result.nextInterval,
        due: result.due,
      },
      R_eff: result.R_eff,
      t_eff: result.t_eff,
    }
  }

  /**
   * Create a new deck
   */
  createDeck(name: string, config: DeckConfig = {}): Deck {
    const id = `deck_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    const deck = new Deck(id, name, config, this.defaultScheduler)
    this.decks.set(id, deck)
    return deck
  }

  /**
   * Get a deck by ID
   */
  getDeck(id: string): Deck | null {
    return this.decks.get(id) ?? null
  }

  /**
   * List all decks
   */
  listDecks(): Deck[] {
    return Array.from(this.decks.values())
  }

  /**
   * Remove a deck
   */
  removeDeck(id: string): boolean {
    return this.decks.delete(id)
  }

  /**
   * Get global statistics across all decks
   */
  getGlobalStatistics(now: Date = new Date()): GlobalStatistics {
    const deckStats = Array.from(this.decks.values()).map((deck) =>
      deck.updateStatistics(now)
    )
    return aggregateGlobalStatistics(deckStats)
  }
}

/**
 * Default scheduler implementation
 * Simple scheduler that uses S_eff as the interval
 */
class DefaultScheduler implements Scheduler {
  schedule(input: SchedulerInput): SchedulerOutput {
    const nextInterval = input.S_eff
    const due = new Date(
      input.now.getTime() + nextInterval * 24 * 60 * 60 * 1000
    )
    return { nextInterval, due }
  }
}

