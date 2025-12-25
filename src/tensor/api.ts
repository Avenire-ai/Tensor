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
} from "./types"

export type { TensorConfig }
import { Scheduler, SchedulerInput, SchedulerOutput } from "../scheduler/types"
import { reviewStep, ReviewStepInput } from "./reviewStep"
import { mergePolicyContext } from "./policyMerge"

/**
 * Tensor class - main public API for Tensor v2
 * 
 * The Tensor class provides a high-level interface for managing spaced repetition
 * learning with advanced features like policy merging, context modulation, and
 * multiple deck support.
 * 
 * @example
 * ```typescript
 * const tensor = new Tensor();
 * const deck = tensor.createDeck("My Deck");
 * const card = deck.addCard({
 *   front: "Question",
 *   back: "Answer"
 * });
 * 
 * const result = deck.reviewCard(card.id, ReviewOutcome.Good);
 * console.log(`Next review in ${result.schedulingSuggestion.nextInterval} days`);
 * ```
 */
export class Tensor {
  private decks: Map<string, Deck>
  private defaultScheduler: Scheduler
  constructor(config: TensorConfig = {}) {
    this.decks = new Map()
    // If no default scheduler provided, create a simple one
    this.defaultScheduler = config.defaultScheduler ?? new DefaultScheduler()
  }

  /**
   * Review a card directly (without deck)
   * This is the core review function that wraps reviewStep
   * 
   * @param memoryState - Current memory state of the card
   * @param reviewOutcome - The outcome of the review (Good, Hard, Easy, etc.)
   * @param policyContext - Session context including policy settings
   * @param now - Current timestamp for scheduling calculations
   * @returns Review result with updated memory state and scheduling information
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
   * Create a new deck with the given name and configuration
   * 
   * @param name - Human-readable name for the deck
   * @param config - Optional deck configuration including policies and settings
   * @returns The created Deck instance
   */
  createDeck(name: string, config: DeckConfig = {}): Deck {
    const id = `deck_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    const deck = new Deck(id, name, config, this.defaultScheduler)
    this.decks.set(id, deck)
    return deck
  }

  /**
   * Get a deck by ID
   * 
   * @param id - Unique identifier of the deck
   * @returns The Deck instance if found, null otherwise
   */
  getDeck(id: string): Deck | null {
    return this.decks.get(id) ?? null
  }

  /**
   * List all decks managed by this Tensor instance
   * 
   * @returns Array of all Deck instances
   */
  listDecks(): Deck[] {
    return Array.from(this.decks.values())
  }

  /**
   * Remove a deck by ID
   * 
   * @param id - Unique identifier of the deck to remove
   * @returns True if the deck was removed, false if not found
   */
  removeDeck(id: string): boolean {
    return this.decks.delete(id)
  }

  /**
   * Get global statistics across all decks
   * 
   * @param now - Current timestamp for statistics calculation (defaults to current time)
   * @returns Aggregated statistics across all decks
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

