/**
 * Queue System
 * 
 * Queues select WHICH card to review (prioritization, filtering, daily caps).
 * Queues NEVER compute intervals or due dates - that's the scheduler's job.
 */

import { Card } from "./card"
import { PriorityStrategy } from "./types"

/**
 * Queue class for managing card prioritization and selection
 */
export class Queue {
  private cards: Map<string, Card>
  priorityStrategy: PriorityStrategy
  dailyCap: number | null
  easyDayMode: boolean

  constructor(
    priorityStrategy: PriorityStrategy = "due_first",
    dailyCap: number | null = null,
    easyDayMode: boolean = false
  ) {
    this.cards = new Map()
    this.priorityStrategy = priorityStrategy
    this.dailyCap = dailyCap
    this.easyDayMode = easyDayMode
  }

  /**
   * Add a card to the queue
   */
  addCard(card: Card): void {
    this.cards.set(card.id, card)
  }

  /**
   * Remove a card from the queue
   */
  removeCard(cardId: string): void {
    this.cards.delete(cardId)
  }

  /**
   * Update a card's memory state and due date
   * Note: due date comes from scheduler output, not computed here
   */
  updateCard(cardId: string, memoryState: any, due: Date): void {
    const card = this.cards.get(cardId)
    if (card) {
      card.memoryState = memoryState
      card.due = due
    }
  }

  /**
   * Get cards due today
   */
  getDueToday(now: Date): Card[] {
    return Array.from(this.cards.values()).filter((card) => card.isDue(now))
  }

  /**
   * Get backlog (overdue cards)
   */
  getBacklog(now: Date): Card[] {
    return Array.from(this.cards.values()).filter((card) => card.isOverdue(now))
  }

  /**
   * Get next cards to review (prioritized)
   * This is the core queue operation - selects WHICH cards
   */
  getNext(limit?: number, easyDay?: boolean): Card[] {
    const allCards = Array.from(this.cards.values())
    
    // Sort by priority (higher priority first)
    const sorted = allCards.sort((a, b) => {
      const now = new Date()
      const priorityA = a.computePriority(now, this.priorityStrategy)
      const priorityB = b.computePriority(now, this.priorityStrategy)
      return priorityB - priorityA // Descending order
    })

    // Apply easy day deferral if enabled
    let selected = sorted
    if (easyDay || this.easyDayMode) {
      const deferred = this.deferLowPriority(sorted, true)
      selected = deferred.review
    }

    // Apply limit if specified
    if (limit !== undefined && limit > 0) {
      selected = selected.slice(0, limit)
    }

    return selected
  }

  /**
   * Enforce daily cap on selected cards
   */
  enforceDailyCap(selectedCards: Card[], dailyCap: number | null): Card[] {
    if (dailyCap === null || dailyCap <= 0) {
      return selectedCards
    }
    return selectedCards.slice(0, dailyCap)
  }

  /**
   * Defer low-priority cards for easy days
   */
  deferLowPriority(
    cards: Card[],
    easyDay: boolean
  ): { review: Card[]; deferred: Card[] } {
    if (!easyDay) {
      return { review: cards, deferred: [] }
    }

    // On easy days, defer cards that are not overdue and have high stability
    const now = new Date()
    const review: Card[] = []
    const deferred: Card[] = []

    for (const card of cards) {
      // Always review overdue cards
      if (card.isOverdue(now)) {
        review.push(card)
      } else if (card.memoryState.S > 10) {
        // Defer high-stability cards that aren't overdue
        deferred.push(card)
      } else {
        // Review low-stability and due cards
        review.push(card)
      }
    }

    return { review, deferred }
  }

  /**
   * Get all cards in queue
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

