/**
 * Policy Merging Utilities
 * 
 * Merges deck-level policy defaults with runtime session context.
 * Runtime values always take precedence over deck defaults.
 */

import { RetentionSignals } from "./policy/adaptiveRetention"
import { ContextSignals } from "./policy/contextModulation"
import { Scheduler } from "../scheduler/types"
import {
  DeckConfig,
  SessionContext,
  MergedPolicyContext,
  PolicyDefaults,
} from "./types"

/**
 * Merge retention signals: runtime values take precedence, deck defaults fill missing fields
 */
export function mergeRetentionSignals(
  deckDefaults: Partial<RetentionSignals> | undefined,
  runtimeContext: Partial<RetentionSignals> | undefined
): RetentionSignals | undefined {
  if (!deckDefaults && !runtimeContext) {
    return undefined
  }

  // Start with deck defaults, then override with runtime values
  const merged: Partial<RetentionSignals> = {
    ...deckDefaults,
    ...runtimeContext,
  }

  // Ensure required fields are present for a complete RetentionSignals
  // If critical fields are missing, return undefined (caller should handle)
  if (
    merged.backlogSize === undefined ||
    merged.recentFailureRate === undefined ||
    merged.sessionLength === undefined ||
    merged.dailyCapacity === undefined ||
    merged.dueToday === undefined
  ) {
    return undefined
  }

  return merged as RetentionSignals
}

/**
 * Merge context signals: runtime values take precedence, deck defaults fill missing fields
 */
export function mergeContextSignals(
  deckDefaults: Partial<ContextSignals> | undefined,
  runtimeContext: Partial<ContextSignals> | undefined
): ContextSignals | undefined {
  if (!deckDefaults && !runtimeContext) {
    return undefined
  }

  // Start with deck defaults, then override with runtime values
  const merged: Partial<ContextSignals> = {
    ...deckDefaults,
    ...runtimeContext,
  }

  // ContextSignals are all optional, so return merged (even if empty)
  return Object.keys(merged).length > 0 ? (merged as ContextSignals) : undefined
}

/**
 * Merge complete policy context from deck config and session context
 */
export function mergePolicyContext(
  deckConfig: DeckConfig | undefined,
  sessionContext: SessionContext,
  defaultScheduler: Scheduler
): MergedPolicyContext {
  const policyDefaults: PolicyDefaults | undefined = deckConfig?.policyDefaults

  // Merge retention signals
  const retentionSignals = mergeRetentionSignals(
    policyDefaults?.defaultRetentionSignals,
    sessionContext.retentionSignals
  )

  // Merge context signals
  const contextSignals = mergeContextSignals(
    policyDefaults?.defaultContextSignals,
    sessionContext.contextSignals
  )

  // Merge retention target: runtime override takes precedence
  const R_target =
    sessionContext.R_target ?? deckConfig?.defaultRetentionTarget

  // Merge scheduler: runtime override takes precedence, then deck default, then global default
  const scheduler =
    sessionContext.scheduler ??
    deckConfig?.defaultScheduler ??
    defaultScheduler

  return {
    R_target,
    retentionSignals,
    contextSignals,
    reviewsSoFarInSession: sessionContext.reviewsSoFarInSession ?? 0,
    scheduler,
    early: sessionContext.early ?? false,
    postponed: sessionContext.postponed ?? false,
  }
}



