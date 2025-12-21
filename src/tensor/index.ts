/**
 * Tensor v2 Public API Exports
 * 
 * Main entry point for Tensor v2. Exports the public API while
 * hiding internal implementation details.
 */

export { Tensor } from "./api"
export { Deck } from "./deck"
export { Card } from "./card"
export { Queue } from "./queue"
export { createTensor, createMockScheduler } from "./integration"

// Export public types
export type {
  MemoryState,
  ReviewOutcome,
  ReviewResult,
  SessionContext,
  DeckConfig,
  DeckStatistics,
  GlobalStatistics,
  TensorConfig,
  PriorityStrategy,
  SerializedDeck,
  ValidationResult,
} from "./types"

// Re-export scheduler interface for users who want to provide custom schedulers
export type { Scheduler, SchedulerInput, SchedulerOutput } from "../scheduler/types"

