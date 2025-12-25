/**
 * Tensor v2 Type Definitions
 * 
 * Public API types for Tensor v2. These types hide internal v1 implementation details
 * and provide a clean interface for decks, queues, and reviews.
 */

import { RetentionSignals } from "./policy/adaptiveRetention"
import { ContextSignals } from "./policy/contextModulation"
import { Scheduler } from "../scheduler/types"

/**
 * Memory state of a card
 */
export interface MemoryState {
  /** Stability (days) */
  S: number
  /** Difficulty (0-10 scale) */
  difficulty: number
  /** Elapsed time since last review (days) */
  t: number
  /** Scheduled review time (days) - optional */
  scheduled_t?: number
}

/**
 * Review outcome grade
 */
export type ReviewOutcome = "Again" | "Hard" | "Good" | "Easy"

/**
 * Runtime policy context provided by user/session
 * These values take precedence over deck defaults
 */
export interface SessionContext {
  /** Explicit retention target override */
  R_target?: number
  
  /** Retention signals (partial - missing fields filled from deck defaults) */
  retentionSignals?: Partial<RetentionSignals>
  
  /** Context signals (partial - missing fields filled from deck defaults) */
  contextSignals?: Partial<ContextSignals>
  
  /** Number of reviews completed in current session */
  reviewsSoFarInSession?: number
  
  /** Scheduler override (optional - deck default used if not provided) */
  scheduler?: Scheduler
  
  /** Whether this is an early review */
  early?: boolean
  
  /** Whether this review was postponed */
  postponed?: boolean
}

/**
 * Merged policy context (deck defaults + session context)
 * This is the internal type used when calling reviewStep
 */
export interface MergedPolicyContext {
  /** Final retention target (runtime override or deck default) */
  R_target?: number
  
  /** Complete retention signals (merged) */
  retentionSignals?: RetentionSignals
  
  /** Complete context signals (merged) */
  contextSignals?: ContextSignals
  
  /** Session state */
  reviewsSoFarInSession: number
  
  /** Scheduler to use (runtime override or deck default) */
  scheduler: Scheduler
  
  /** Early review flag */
  early: boolean
  
  /** Postponed review flag */
  postponed: boolean
}

/**
 * Result of a review operation
 */
export interface ReviewResult {
  /** New memory state after review */
  newMemoryState: MemoryState
  
  /** Scheduling suggestion (interval and due date) */
  schedulingSuggestion: {
    /** Next interval in days */
    nextInterval: number
    /** Due date for next review */
    due: Date
  }
  
  /** Effective recall probability used in computation */
  R_eff: number
  
  /** Effective elapsed time used in computation */
  t_eff: number
}

/**
 * Deck configuration (provides defaults, not overrides)
 */
export interface DeckConfig {
  /** Default retention target (used if not in runtime context) */
  defaultRetentionTarget?: number
  
  /** Default daily capacity (used if not in runtime context) */
  defaultDailyCapacity?: number
  
  /** Default R_base for adaptive retention computation */
  defaultR_base?: number
  
  /** Optional deck-specific scheduler */
  defaultScheduler?: Scheduler
  
  /** Deck-level policy signal defaults */
  policyDefaults?: PolicyDefaults
}

/**
 * Policy defaults that merge with runtime context
 */
export interface PolicyDefaults {
  /** Default context signals (merged with session context) */
  defaultContextSignals?: Partial<ContextSignals>
  
  /** Default retention signals (merged with session context) */
  defaultRetentionSignals?: Partial<RetentionSignals>
}

/**
 * Deck statistics
 */
export interface DeckStatistics {
  /** Total number of cards in deck */
  totalCards: number
  
  /** Number of cards due today */
  dueToday: number
  
  /** Number of overdue cards (backlog) */
  backlogSize: number
  
  /** Recent failure rate (0.0-1.0) */
  recentFailureRate: number
  
  /** Average stability across all cards */
  averageStability: number
  
  /** Load ratio (dueToday / dailyCapacity) */
  loadRatio: number
}

/**
 * Global statistics across all decks
 */
export interface GlobalStatistics {
  /** Total cards across all decks */
  totalCards: number
  
  /** Total cards due today across all decks */
  totalDueToday: number
  
  /** Total backlog across all decks */
  totalBacklog: number
  
  /** Global average failure rate */
  averageFailureRate: number
  
  /** Global average stability */
  averageStability: number
  
  /** Number of decks */
  deckCount: number
}

/**
 * Load metrics
 */
export interface LoadMetrics {
  /** Number of cards due today */
  dueToday: number
  
  /** Number of overdue cards */
  backlogSize: number
  
  /** Daily capacity */
  dailyCapacity: number
  
  /** Load ratio */
  loadRatio: number
}

/**
 * Performance metrics
 */
export interface PerformanceMetrics {
  /** Failure rate in time window */
  failureRate: number
  
  /** Success rate in time window */
  successRate: number
  
  /** Average stability */
  averageStability: number
  
  /** Number of reviews in time window */
  reviewCount: number
}

/**
 * Priority strategy for queue
 */
export type PriorityStrategy = "due_first" | "stability_low_first" | "mixed"

/**
 * Validation result
 */
export interface ValidationResult {
  /** Whether validation passed */
  valid: boolean
  
  /** Validation errors (if any) */
  errors: string[]
}

/**
 * Serialized deck (for persistence)
 */
export interface SerializedDeck {
  id: string
  name: string
  config: DeckConfig
  // Note: Cards and queue state are not serialized here
  // Integration layer should handle card persistence separately
}

/**
 * Tensor configuration
 */
export interface TensorConfig {
  /** Default scheduler to use if not specified */
  defaultScheduler?: Scheduler
}



