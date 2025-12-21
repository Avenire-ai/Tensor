import { test, expect, describe } from "bun:test"
import {
  mergeRetentionSignals,
  mergeContextSignals,
  mergePolicyContext,
} from "../policyMerge"
import { DeckConfig, SessionContext } from "../types"
import { RetentionSignals } from "../policy/adaptiveRetention"
import { ContextSignals } from "../policy/contextModulation"
import { Scheduler, SchedulerInput, SchedulerOutput } from "../../scheduler/types"

// Mock scheduler for testing
class MockScheduler implements Scheduler {
  schedule(input: SchedulerInput): SchedulerOutput {
    return {
      nextInterval: input.S_eff,
      due: new Date(input.now.getTime() + input.S_eff * 24 * 60 * 60 * 1000),
    }
  }
}

describe("Policy Merging", () => {
  describe("mergeRetentionSignals", () => {
    test("should use runtime values when provided", () => {
      const deckDefaults: Partial<RetentionSignals> = {
        dailyCapacity: 100,
        backlogSize: 10,
        recentFailureRate: 0.15,
        sessionLength: 30,
        dueToday: 50,
      }
      const runtimeContext: Partial<RetentionSignals> = {
        dailyCapacity: 150,
        recentFailureRate: 0.2,
        backlogSize: 20,
        sessionLength: 45,
        dueToday: 75,
      }

      const merged = mergeRetentionSignals(deckDefaults, runtimeContext)

      expect(merged).toBeDefined()
      expect(merged!.dailyCapacity).toBe(150) // Runtime value
      expect(merged!.recentFailureRate).toBe(0.2) // Runtime value
      expect(merged!.backlogSize).toBe(20) // Runtime value (overrides deck default)
    })

    test("should use deck defaults when runtime values not provided", () => {
      const deckDefaults: Partial<RetentionSignals> = {
        dailyCapacity: 100,
        backlogSize: 5,
        recentFailureRate: 0.15,
        sessionLength: 30,
        dueToday: 50,
      }
      const runtimeContext: Partial<RetentionSignals> = {}

      const merged = mergeRetentionSignals(deckDefaults, runtimeContext)

      expect(merged).toBeDefined()
      expect(merged!.dailyCapacity).toBe(100)
      expect(merged!.backlogSize).toBe(5)
      expect(merged!.recentFailureRate).toBe(0.15)
    })

    test("should return undefined if critical fields missing", () => {
      const deckDefaults: Partial<RetentionSignals> = {
        dailyCapacity: 100,
        // Missing other required fields
      }
      const runtimeContext: Partial<RetentionSignals> = {}

      const merged = mergeRetentionSignals(deckDefaults, runtimeContext)

      expect(merged).toBeUndefined()
    })

    test("should return undefined if both are undefined", () => {
      const merged = mergeRetentionSignals(undefined, undefined)
      expect(merged).toBeUndefined()
    })
  })

  describe("mergeContextSignals", () => {
    test("should use runtime values when provided", () => {
      const deckDefaults: Partial<ContextSignals> = {
        environmentQuality: 0.8,
        timeOfDay: 0.7,
      }
      const runtimeContext: Partial<ContextSignals> = {
        environmentQuality: 0.9,
      }

      const merged = mergeContextSignals(deckDefaults, runtimeContext)

      expect(merged).toBeDefined()
      expect(merged!.environmentQuality).toBe(0.9) // Runtime value
      expect(merged!.timeOfDay).toBe(0.7) // Deck default
    })

    test("should use deck defaults when runtime values not provided", () => {
      const deckDefaults: Partial<ContextSignals> = {
        environmentQuality: 0.8,
        timeOfDay: 0.7,
      }
      const runtimeContext: Partial<ContextSignals> = {}

      const merged = mergeContextSignals(deckDefaults, runtimeContext)

      expect(merged).toBeDefined()
      expect(merged!.environmentQuality).toBe(0.8)
      expect(merged!.timeOfDay).toBe(0.7)
    })

    test("should return undefined if both are undefined", () => {
      const merged = mergeContextSignals(undefined, undefined)
      expect(merged).toBeUndefined()
    })
  })

  describe("mergePolicyContext", () => {
    test("should merge deck config with session context", () => {
      const deckConfig: DeckConfig = {
        defaultRetentionTarget: 0.90,
        defaultDailyCapacity: 100,
        policyDefaults: {
          defaultContextSignals: {
            environmentQuality: 0.8,
          },
          defaultRetentionSignals: {
            dailyCapacity: 100,
            backlogSize: 5,
            recentFailureRate: 0.15,
            sessionLength: 30,
            dueToday: 50,
          },
        },
      }

      const sessionContext: SessionContext = {
        R_target: 0.85, // Override deck default
        retentionSignals: {
          dailyCapacity: 150, // Override deck default
          backlogSize: 10,
          recentFailureRate: 0.2,
          sessionLength: 45,
          dueToday: 75,
        },
        contextSignals: {
          environmentQuality: 0.9, // Override deck default
        },
        reviewsSoFarInSession: 10,
      }

      const defaultScheduler = new MockScheduler()
      const merged = mergePolicyContext(deckConfig, sessionContext, defaultScheduler)

      expect(merged.R_target).toBe(0.85) // Runtime override
      expect(merged.retentionSignals).toBeDefined()
      expect(merged.retentionSignals!.dailyCapacity).toBe(150) // Runtime override
      expect(merged.contextSignals).toBeDefined()
      expect(merged.contextSignals!.environmentQuality).toBe(0.9) // Runtime override
      expect(merged.reviewsSoFarInSession).toBe(10)
      expect(merged.scheduler).toBe(defaultScheduler)
    })

    test("should use deck defaults when runtime values not provided", () => {
      const deckConfig: DeckConfig = {
        defaultRetentionTarget: 0.90,
        defaultScheduler: new MockScheduler(),
        policyDefaults: {
          defaultContextSignals: {
            environmentQuality: 0.8,
          },
        },
      }

      const sessionContext: SessionContext = {}

      const defaultScheduler = new MockScheduler()
      const merged = mergePolicyContext(deckConfig, sessionContext, defaultScheduler)

      expect(merged.R_target).toBe(0.90) // Deck default
      expect(merged.scheduler).toBe(deckConfig.defaultScheduler) // Deck default
      expect(merged.contextSignals?.environmentQuality).toBe(0.8) // Deck default
    })

    test("should handle undefined deck config", () => {
      const sessionContext: SessionContext = {
        R_target: 0.85,
        reviewsSoFarInSession: 5,
      }

      const defaultScheduler = new MockScheduler()
      const merged = mergePolicyContext(undefined, sessionContext, defaultScheduler)

      expect(merged.R_target).toBe(0.85)
      expect(merged.reviewsSoFarInSession).toBe(5)
      expect(merged.scheduler).toBe(defaultScheduler)
    })
  })
})

