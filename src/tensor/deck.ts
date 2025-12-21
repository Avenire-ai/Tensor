/**
 * Deck System
 * 
 * Independent deck implementation with per-deck queues.
 * Decks provide policy defaults that merge with runtime context.
 */

import { Card } from "./card"
import { Queue } from "./queue"
import { reviewStep, ReviewStepInput } from "./reviewStep"
import { mergePolicyContext } from "./policyMerge"
import { computeDeckStatistics } from "./statistics"
import {
  DeckConfig,
  DeckStatistics,
  MemoryState,
  ReviewOutcome,
  ReviewResult,
  SessionContext,
} from "./types"
import { Scheduler } from "../scheduler/types"

/**
 * Deck class representing a collection of cards with shared policy defaults
 */
export class Deck {
  id: string
  name: string
  config: DeckConfig
  queue: Queue
  private cards: Map<string, Card>
  private defaultScheduler: Scheduler

  constructor(
    id: string,
    name: string,
    config: DeckConfig,
    defaultScheduler: Scheduler
  ) {
    this.id = id
    this.name = name
    this.config = config
    this.defaultScheduler = defaultScheduler
    this.cards = new Map()
    this.queue = new Queue(
      "due_first", // Default priority strategy
      config.defaultDailyCapacity ?? null,
      false // Default easy day mode
    )
  }

  /**
   * Add a card to the deck
   */
  addCard(cardId: string, memoryState: MemoryState, due: Date): void {
    const card = new Card(cardId, this.id, memoryState, due)
    this.cards.set(cardId, card)
    this.queue.addCard(card)
  }

  /**
   * Remove a card from the deck
   */
  removeCard(cardId: string): void {
    this.cards.delete(cardId)
    this.queue.removeCard(cardId)
  }

  /**
   * Get a card by ID
   */
  getCard(cardId: string): Card | null {
    return this.cards.get(cardId) ?? null
  }

  /**
   * Update deck statistics
   */
  updateStatistics(now: Date = new Date()): DeckStatistics {
    const cards = Array.from(this.cards.values())
    const dailyCapacity = this.config.defaultDailyCapacity ?? 100
    return computeDeckStatistics(cards, dailyCapacity, now)
  }

  /**
   * Get next cards to review (delegates to queue)
   */
  getNextReview(limit?: number, easyDay?: boolean): Card[] {
    return this.queue.getNext(limit, easyDay)
  }

  /**
   * Process a review for a card
   * Merges deck config defaults with session context, then calls reviewStep
   */
  processReview(
    cardId: string,
    outcome: ReviewOutcome,
    sessionContext: SessionContext,
    now: Date
  ): ReviewResult {
    const card = this.cards.get(cardId)
    if (!card) {
      throw new Error(`Card ${cardId} not found in deck ${this.id}`)
    }

    // Merge deck defaults with session context
    const mergedContext = mergePolicyContext(
      this.config,
      sessionContext,
      this.defaultScheduler
    )

    // Prepare review step input
    const { memoryState } = card
    const t = memoryState.t

    const reviewInput: ReviewStepInput = {
      S: memoryState.S,
      difficulty: memoryState.difficulty,
      t,
      scheduled_t: memoryState.scheduled_t,
      grade: outcome,
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

    // Update card state
    const newMemoryState: MemoryState = {
      S: result.S_new,
      difficulty: memoryState.difficulty, // Difficulty updated separately in FSRS
      t: 0, // Reset elapsed time
      scheduled_t: undefined, // Clear scheduled time
    }

    // Update card
    card.updateAfterReview(
      {
        newMemoryState,
        schedulingSuggestion: {
          nextInterval: result.nextInterval,
          due: result.due,
        },
        R_eff: result.R_eff,
        t_eff: result.t_eff,
      },
      now
    )

    // Update queue with new due date
    this.queue.updateCard(cardId, newMemoryState, result.due)

    return {
      newMemoryState,
      schedulingSuggestion: {
        nextInterval: result.nextInterval,
        due: result.due,
      },
      R_eff: result.R_eff,
      t_eff: result.t_eff,
    }
  }

  /**
   * Get all cards in deck
   */
  getAllCards(): Card[] {
    return Array.from(this.cards.values())
  }

  /**
   * Get card count
   */
  getCardCount(): number {
    return this.cards.size
  }
}

