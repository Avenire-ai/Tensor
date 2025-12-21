/**
 * Integration Helpers
 * 
 * Framework-agnostic integration utilities for Tensor v2.
 * Handles serialization, validation, and factory functions.
 */

import { Tensor, TensorConfig } from "./api"
import { Deck } from "./deck"
import { SerializedDeck, MemoryState, ValidationResult } from "./types"
import { Scheduler } from "../scheduler/types"

/**
 * Create a Tensor instance with configuration
 */
export function createTensor(config: TensorConfig = {}): Tensor {
  return new Tensor(config)
}

/**
 * Serialize a deck for persistence
 * Note: Cards and queue state are not serialized here.
 * Integration layer should handle card persistence separately.
 */
export function serializeDeck(deck: Deck): SerializedDeck {
  return {
    id: deck.id,
    name: deck.name,
    config: deck.config,
  }
}

/**
 * Deserialize a deck from persisted data
 * Note: Cards must be added separately after deserialization.
 */
export function deserializeDeck(
  data: SerializedDeck,
  tensor: Tensor
): Deck {
  const deck = tensor.createDeck(data.name, data.config)
  // Note: deck.id will be different from data.id
  // If you need to preserve IDs, you'll need to modify Deck constructor
  return deck
}

/**
 * Validate memory state
 */
export function validateMemoryState(state: MemoryState): ValidationResult {
  const errors: string[] = []

  // Validate stability
  if (typeof state.S !== "number" || state.S < 0) {
    errors.push("Stability (S) must be a non-negative number")
  }
  if (state.S > 36500) {
    errors.push("Stability (S) exceeds maximum allowed value (36500)")
  }

  // Validate difficulty
  if (typeof state.difficulty !== "number") {
    errors.push("Difficulty must be a number")
  }
  if (state.difficulty < 0 || state.difficulty > 10) {
    errors.push("Difficulty must be between 0 and 10")
  }

  // Validate elapsed time
  if (typeof state.t !== "number" || state.t < 0) {
    errors.push("Elapsed time (t) must be a non-negative number")
  }

  // Validate scheduled time (if provided)
  if (state.scheduled_t !== undefined) {
    if (typeof state.scheduled_t !== "number" || state.scheduled_t < 0) {
      errors.push("Scheduled time (scheduled_t) must be a non-negative number")
    }
    if (state.scheduled_t > state.t) {
      errors.push("Scheduled time cannot be greater than elapsed time")
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  }
}

/**
 * Migrate from v1 data format to v2
 * This is a placeholder - actual migration would depend on v1 data structure
 */
export function migrateFromV1(v1Data: any): any {
  // Placeholder implementation
  // Actual migration would depend on v1 data structure
  return {
    decks: [],
    cards: [],
  }
}

/**
 * Create a simple mock scheduler for testing
 */
export function createMockScheduler(
  intervalMultiplier: number = 1.0
): Scheduler {
  return {
    schedule(input) {
      const nextInterval = input.S_eff * intervalMultiplier
      const due = new Date(
        input.now.getTime() + nextInterval * 24 * 60 * 60 * 1000
      )
      return { nextInterval, due }
    },
  }
}

