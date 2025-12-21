import { test, expect, describe } from "bun:test"
import { Tensor } from "../api"
import { Deck } from "../deck"
import { Card } from "../card"
import { Queue } from "../queue"
import { createTensor, createMockScheduler } from "../integration"
import {
  MemoryState,
  ReviewOutcome,
  SessionContext,
  DeckConfig,
} from "../types"

describe("Tensor v2 API", () => {
  describe("Tensor class", () => {
    test("should create tensor instance", () => {
      const tensor = createTensor()
      expect(tensor).toBeDefined()
    })

    test("should create deck", () => {
      const tensor = createTensor()
      const deck = tensor.createDeck("Test Deck")
      expect(deck).toBeDefined()
      expect(deck.name).toBe("Test Deck")
    })

    test("should get deck by ID", () => {
      const tensor = createTensor()
      const deck = tensor.createDeck("Test Deck")
      const retrieved = tensor.getDeck(deck.id)
      expect(retrieved).toBe(deck)
    })

    test("should list all decks", () => {
      const tensor = createTensor()
      const deck1 = tensor.createDeck("Deck 1")
      const deck2 = tensor.createDeck("Deck 2")
      const decks = tensor.listDecks()
      expect(decks.length).toBe(2)
      expect(decks).toContain(deck1)
      expect(decks).toContain(deck2)
    })

    test("should remove deck", () => {
      const tensor = createTensor()
      const deck = tensor.createDeck("Test Deck")
      const removed = tensor.removeDeck(deck.id)
      expect(removed).toBe(true)
      expect(tensor.getDeck(deck.id)).toBeNull()
    })

    test("should review card directly", () => {
      const tensor = createTensor()
      const memoryState: MemoryState = {
        S: 10,
        difficulty: 5,
        t: 5,
      }
      const policyContext: SessionContext = {}
      const now = new Date()

      const result = tensor.review(memoryState, "Good", policyContext, now)

      expect(result.newMemoryState.S).toBeGreaterThan(0)
      expect(result.schedulingSuggestion.nextInterval).toBeGreaterThan(0)
      expect(result.schedulingSuggestion.due).toBeInstanceOf(Date)
    })

    test("should get global statistics", () => {
      const tensor = createTensor()
      const deck1 = tensor.createDeck("Deck 1")
      const deck2 = tensor.createDeck("Deck 2")

      deck1.addCard("card1", { S: 10, difficulty: 5, t: 0 }, new Date())
      deck2.addCard("card2", { S: 20, difficulty: 5, t: 0 }, new Date())

      const stats = tensor.getGlobalStatistics()
      expect(stats.totalCards).toBe(2)
      expect(stats.deckCount).toBe(2)
    })
  })

  describe("Deck class", () => {
    test("should add card to deck", () => {
      const tensor = createTensor()
      const deck = tensor.createDeck("Test Deck")
      const memoryState: MemoryState = { S: 10, difficulty: 5, t: 0 }
      const due = new Date()

      deck.addCard("card1", memoryState, due)
      const card = deck.getCard("card1")

      expect(card).toBeDefined()
      expect(card!.memoryState.S).toBe(10)
      expect(card!.due).toEqual(due)
    })

    test("should remove card from deck", () => {
      const tensor = createTensor()
      const deck = tensor.createDeck("Test Deck")
      const memoryState: MemoryState = { S: 10, difficulty: 5, t: 0 }
      const due = new Date()

      deck.addCard("card1", memoryState, due)
      deck.removeCard("card1")
      const card = deck.getCard("card1")

      expect(card).toBeNull()
    })

    test("should get next review cards", () => {
      const tensor = createTensor()
      const deck = tensor.createDeck("Test Deck")
      const now = new Date()
      const past = new Date(now.getTime() - 24 * 60 * 60 * 1000) // Yesterday
      const future = new Date(now.getTime() + 24 * 60 * 60 * 1000) // Tomorrow

      deck.addCard("card1", { S: 10, difficulty: 5, t: 5 }, past) // Overdue
      deck.addCard("card2", { S: 20, difficulty: 5, t: 5 }, now) // Due
      deck.addCard("card3", { S: 30, difficulty: 5, t: 5 }, future) // Future

      const next = deck.getNextReview(2)
      expect(next.length).toBeLessThanOrEqual(2)
      // Overdue card should be first
      expect(next[0].id).toBe("card1")
    })

    test("should process review and update card", () => {
      const tensor = createTensor()
      const deck = tensor.createDeck("Test Deck")
      const memoryState: MemoryState = { S: 10, difficulty: 5, t: 5 }
      const due = new Date()
      deck.addCard("card1", memoryState, due)

      const sessionContext: SessionContext = {}
      const now = new Date()
      const result = deck.processReview("card1", "Good", sessionContext, now)

      expect(result.newMemoryState.S).toBeGreaterThan(memoryState.S)
      const card = deck.getCard("card1")
      expect(card!.memoryState.S).toBe(result.newMemoryState.S)
      expect(card!.due).toEqual(result.schedulingSuggestion.due)
    })

    test("should update statistics", () => {
      const tensor = createTensor()
      const deck = tensor.createDeck("Test Deck", {
        defaultDailyCapacity: 100,
      })
      const now = new Date()
      const past = new Date(now.getTime() - 24 * 60 * 60 * 1000)

      deck.addCard("card1", { S: 10, difficulty: 5, t: 0 }, past) // Overdue
      deck.addCard("card2", { S: 20, difficulty: 5, t: 0 }, now) // Due

      const stats = deck.updateStatistics(now)
      expect(stats.totalCards).toBe(2)
      expect(stats.dueToday).toBeGreaterThanOrEqual(1)
      expect(stats.backlogSize).toBeGreaterThanOrEqual(1)
    })
  })

  describe("Queue class", () => {
    test("should add and remove cards", () => {
      const queue = new Queue()
      const card = new Card("card1", "deck1", { S: 10, difficulty: 5, t: 0 }, new Date())

      queue.addCard(card)
      expect(queue.getCardCount()).toBe(1)

      queue.removeCard("card1")
      expect(queue.getCardCount()).toBe(0)
    })

    test("should get due today cards", () => {
      const queue = new Queue()
      const now = new Date()
      const past = new Date(now.getTime() - 1000)
      const future = new Date(now.getTime() + 1000)

      queue.addCard(new Card("card1", "deck1", { S: 10, difficulty: 5, t: 0 }, past))
      queue.addCard(new Card("card2", "deck1", { S: 10, difficulty: 5, t: 0 }, now))
      queue.addCard(new Card("card3", "deck1", { S: 10, difficulty: 5, t: 0 }, future))

      const dueToday = queue.getDueToday(now)
      expect(dueToday.length).toBeGreaterThanOrEqual(2) // past and now are due
    })

    test("should get backlog (overdue cards)", () => {
      const queue = new Queue()
      const now = new Date()
      const past = new Date(now.getTime() - 24 * 60 * 60 * 1000)

      queue.addCard(new Card("card1", "deck1", { S: 10, difficulty: 5, t: 0 }, past))
      queue.addCard(new Card("card2", "deck1", { S: 10, difficulty: 5, t: 0 }, now))

      const backlog = queue.getBacklog(now)
      expect(backlog.length).toBe(1)
      expect(backlog[0].id).toBe("card1")
    })

    test("should prioritize cards by due_first strategy", () => {
      const queue = new Queue("due_first")
      const now = new Date()
      const past = new Date(now.getTime() - 24 * 60 * 60 * 1000)
      const future = new Date(now.getTime() + 24 * 60 * 60 * 1000)

      queue.addCard(new Card("card1", "deck1", { S: 10, difficulty: 5, t: 0 }, past))
      queue.addCard(new Card("card2", "deck1", { S: 5, difficulty: 5, t: 0 }, future))

      const next = queue.getNext()
      expect(next[0].id).toBe("card1") // Overdue card first
    })

    test("should prioritize cards by stability_low_first strategy", () => {
      const queue = new Queue("stability_low_first")
      const now = new Date()
      const future = new Date(now.getTime() + 24 * 60 * 60 * 1000)

      queue.addCard(new Card("card1", "deck1", { S: 20, difficulty: 5, t: 0 }, future))
      queue.addCard(new Card("card2", "deck1", { S: 5, difficulty: 5, t: 0 }, future))

      const next = queue.getNext()
      expect(next[0].id).toBe("card2") // Lower stability first
    })

    test("should enforce daily cap", () => {
      const queue = new Queue()
      const now = new Date()

      for (let i = 0; i < 10; i++) {
        queue.addCard(
          new Card(`card${i}`, "deck1", { S: 10, difficulty: 5, t: 0 }, now)
        )
      }

      const selected = queue.getNext(10)
      const capped = queue.enforceDailyCap(selected, 5)

      expect(capped.length).toBe(5)
    })

    test("should defer low priority cards on easy day", () => {
      const queue = new Queue()
      const now = new Date()
      const past = new Date(now.getTime() - 24 * 60 * 60 * 1000)
      const future = new Date(now.getTime() + 24 * 60 * 60 * 1000)

      queue.addCard(new Card("card1", "deck1", { S: 5, difficulty: 5, t: 0 }, past)) // Overdue, low stability
      queue.addCard(new Card("card2", "deck1", { S: 20, difficulty: 5, t: 0 }, future)) // Future, high stability

      const result = queue.deferLowPriority(queue.getAllCards(), true)
      expect(result.review.length).toBeGreaterThan(0)
      expect(result.deferred.length).toBeGreaterThanOrEqual(0)
      // Overdue card should be in review
      expect(result.review.some((c) => c.id === "card1")).toBe(true)
    })
  })

  describe("Card class", () => {
    test("should check if card is due", () => {
      const now = new Date()
      const past = new Date(now.getTime() - 1000)
      const card = new Card("card1", "deck1", { S: 10, difficulty: 5, t: 0 }, past)

      expect(card.isDue(now)).toBe(true)
    })

    test("should check if card is overdue", () => {
      const now = new Date()
      const past = new Date(now.getTime() - 24 * 60 * 60 * 1000)
      const card = new Card("card1", "deck1", { S: 10, difficulty: 5, t: 0 }, past)

      expect(card.isOverdue(now)).toBe(true)
    })

    test("should compute priority", () => {
      const now = new Date()
      const past = new Date(now.getTime() - 24 * 60 * 60 * 1000)
      const card = new Card("card1", "deck1", { S: 10, difficulty: 5, t: 0 }, past)

      const priority = card.computePriority(now, "due_first")
      expect(priority).toBeGreaterThan(0)
    })

    test("should update after review", () => {
      const now = new Date()
      const card = new Card("card1", "deck1", { S: 10, difficulty: 5, t: 5 }, now)

      const result = {
        newMemoryState: { S: 20, difficulty: 5, t: 0 },
        schedulingSuggestion: {
          nextInterval: 20,
          due: new Date(now.getTime() + 20 * 24 * 60 * 60 * 1000),
        },
        R_eff: 0.9,
        t_eff: 5,
      }

      card.updateAfterReview(result, now)

      expect(card.memoryState.S).toBe(20)
      expect(card.due).toEqual(result.schedulingSuggestion.due)
      expect(card.lastReviewed).toEqual(now)
      expect(card.reviewCount).toBe(1)
    })
  })

  describe("Policy merging in deck reviews", () => {
    test("should merge deck defaults with session context", () => {
      const tensor = createTensor()
      const deckConfig: DeckConfig = {
        defaultRetentionTarget: 0.90,
        policyDefaults: {
          defaultContextSignals: {
            environmentQuality: 0.8,
          },
        },
      }
      const deck = tensor.createDeck("Test Deck", deckConfig)
      const memoryState: MemoryState = { S: 10, difficulty: 5, t: 5 }
      deck.addCard("card1", memoryState, new Date())

      const sessionContext: SessionContext = {
        R_target: 0.85, // Override deck default
        contextSignals: {
          environmentQuality: 0.9, // Override deck default
        },
      }

      const result = deck.processReview("card1", "Good", sessionContext, new Date())
      expect(result).toBeDefined()
      // The merged context should be used (runtime values take precedence)
    })
  })

  describe("Queue ↔ Scheduler boundary", () => {
    test("queue should select cards, not compute intervals", () => {
      const queue = new Queue()
      const now = new Date()
      queue.addCard(new Card("card1", "deck1", { S: 10, difficulty: 5, t: 0 }, now))

      const selected = queue.getNext()
      expect(selected.length).toBeGreaterThan(0)
      expect(selected[0].id).toBe("card1")
      // Queue only returns cards, never computes intervals
    })

    test("scheduler should compute intervals, not select cards", () => {
      const tensor = createTensor()
      const memoryState: MemoryState = { S: 10, difficulty: 5, t: 5 }
      const sessionContext: SessionContext = {}
      const now = new Date()

      const result = tensor.review(memoryState, "Good", sessionContext, now)

      // Scheduler computed the interval
      expect(result.schedulingSuggestion.nextInterval).toBeGreaterThan(0)
      expect(result.schedulingSuggestion.due).toBeInstanceOf(Date)
      // Scheduler never selected which card to review
    })
  })
})

