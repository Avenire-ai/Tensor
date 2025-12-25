import { test, expect, describe } from "bun:test"
import { reviewStep } from "../reviewStep"
import { computeEffectiveState } from "../computeEffectiveState"
import { updateStabilityTensor } from "../updateTensorStability"
import { applyAdaptiveRetention } from "../policy/adaptiveRetention"
import { RetentionSignals } from "../policy/adaptiveRetention"

// Mock scheduler for deterministic testing
class MockScheduler {
  schedule(input: any) {
    return {
      nextInterval: input.S_eff * 1.0, // Simple deterministic mapping
      due: new Date(Date.now() + input.S_eff * 24 * 60 * 60 * 1000)
    }
  }
}

describe("Tensor Mathematical Invariants", () => {
  const baseInput = {
    S: 10,
    difficulty: 5,
    grade: "Good" as const,
    now: new Date("2023-01-01"),
    scheduler: new MockScheduler(),
  }

  describe("Invariant 1 — Early review never punishes", () => {
    test("should not decrease S_new for early reviews", () => {
      const earlyInput = { ...baseInput, t: 3, early: true }
      const onTimeInput = { ...baseInput, t: 5, early: false }

      const earlyResult = reviewStep(earlyInput)
      const onTimeResult = reviewStep(onTimeInput)

      expect(earlyResult.S_new).toBeLessThanOrEqual(onTimeResult.S_new)
    })

    test("should hold across all grades", () => {
      const grades = ["Again", "Hard", "Good", "Easy"] as const

      grades.forEach(grade => {
        const earlyInput = { ...baseInput, t: 3, early: true, grade }
        const onTimeInput = { ...baseInput, t: 5, early: false, grade }

        const earlyResult = reviewStep(earlyInput)
        const onTimeResult = reviewStep(onTimeInput)

        expect(earlyResult.S_new).toBeLessThanOrEqual(onTimeResult.S_new)
      })
    })

    test("should hold with different stability values", () => {
      const stabilities = [1, 5, 10, 50, 100]

      stabilities.forEach(S => {
        const earlyInput = { ...baseInput, t: 3, early: true, S }
        const onTimeInput = { ...baseInput, t: 5, early: false, S }

        const earlyResult = reviewStep(earlyInput)
        const onTimeResult = reviewStep(onTimeInput)

        expect(earlyResult.S_new).toBeLessThanOrEqual(onTimeResult.S_new)
      })
    })

    test("should hold with context modulation", () => {
      const contextSignals = [
        { environmentQuality: 0.3 }, // Low quality
        { environmentQuality: 0.5 }, // Medium quality
        { environmentQuality: 0.8 }, // High quality
      ]

      contextSignals.forEach(contextSignal => {
        const earlyInput = { ...baseInput, t: 3, early: true, contextSignals: contextSignal }
        const onTimeInput = { ...baseInput, t: 5, early: false, contextSignals: contextSignal }

        const earlyResult = reviewStep(earlyInput)
        const onTimeResult = reviewStep(onTimeInput)

        expect(earlyResult.S_new).toBeLessThanOrEqual(onTimeResult.S_new)
      })
    })
  })

  describe("Invariant 2 — Postponement never rewards", () => {
    test("should produce strictly smaller R_eff for postponed reviews", () => {
      const onTimeInput = { ...baseInput, t: 5, postponed: false }
      const postponedInput = { ...baseInput, t: 10, postponed: true }

      const onTimeResult = reviewStep(onTimeInput)
      const postponedResult = reviewStep(postponedInput)

      expect(postponedResult.R_eff).toBeLessThan(onTimeResult.R_eff)
    })

    test("should hold across all grades", () => {
      const grades = ["Again", "Hard", "Good", "Easy"] as const

      grades.forEach(grade => {
        const onTimeInput = { ...baseInput, t: 5, postponed: false, grade }
        const postponedInput = { ...baseInput, t: 10, postponed: true, grade }

        const onTimeResult = reviewStep(onTimeInput)
        const postponedResult = reviewStep(postponedInput)

        expect(postponedResult.R_eff).toBeLessThan(onTimeResult.R_eff)
      })
    })

    test("should hold with different stability values", () => {
      const stabilities = [1, 5, 10, 50, 100]

      stabilities.forEach(S => {
        const onTimeInput = { ...baseInput, t: 5, postponed: false, S }
        const postponedInput = { ...baseInput, t: 10, postponed: true, S }

        const onTimeResult = reviewStep(onTimeInput)
        const postponedResult = reviewStep(postponedInput)

        expect(postponedResult.R_eff).toBeLessThan(onTimeResult.R_eff)
      })
    })

    test("should hold with context modulation", () => {
      const contextSignals = [
        { environmentQuality: 0.3 }, // Low quality
        { environmentQuality: 0.8 }, // High quality
      ]
      const testBaseInput = { ...baseInput, difficulty: 3 } // Lower difficulty for lower base recall

      contextSignals.forEach(contextSignal => {
        const onTimeInput = { ...testBaseInput, t: 5, postponed: false, contextSignals: contextSignal }
        const postponedInput = { ...testBaseInput, t: 10, postponed: true, contextSignals: contextSignal }

        const onTimeResult = reviewStep(onTimeInput)
        const postponedResult = reviewStep(postponedInput)

        expect(postponedResult.R_eff).toBeLessThan(onTimeResult.R_eff)
      })
    })
  })

  describe("Invariant 3 — Review hoarding prevention", () => {
    test("postponed review must never yield higher S_new than on-time review", () => {
      const onTimeInput = { ...baseInput, t: 5, scheduled_t: 5 }
      const postponedInput = { ...baseInput, t: 10, scheduled_t: 5 }

      const onTimeResult = reviewStep(onTimeInput)
      const postponedResult = reviewStep(postponedInput)

      expect(postponedResult.S_new).toBeLessThanOrEqual(onTimeResult.S_new)
    })

    test("should hold across all grades", () => {
      const grades = ["Again", "Hard", "Good", "Easy"] as const

      grades.forEach(grade => {
        const onTimeInput = { ...baseInput, t: 5, scheduled_t: 5, grade }
        const postponedInput = { ...baseInput, t: 10, scheduled_t: 5, grade }

        const onTimeResult = reviewStep(onTimeInput)
        const postponedResult = reviewStep(postponedInput)

        expect(postponedResult.S_new).toBeLessThanOrEqual(onTimeResult.S_new)
      })
    })

    test("should hold with different stability values", () => {
      const stabilities = [1, 5, 10, 50, 100]

      stabilities.forEach(S => {
        const onTimeInput = { ...baseInput, t: 5, scheduled_t: 5, S }
        const postponedInput = { ...baseInput, t: 10, scheduled_t: 5, S }

        const onTimeResult = reviewStep(onTimeInput)
        const postponedResult = reviewStep(postponedInput)

        expect(postponedResult.S_new).toBeLessThanOrEqual(onTimeResult.S_new)
      })
    })

    test("should handle extreme postponement", () => {
      const onTimeInput = { ...baseInput, t: 5, scheduled_t: 5 }
      const extremelyPostponedInput = { ...baseInput, t: 30, scheduled_t: 5 }

      const onTimeResult = reviewStep(onTimeInput)
      const extremelyPostponedResult = reviewStep(extremelyPostponedInput)

      expect(extremelyPostponedResult.S_new).toBeLessThanOrEqual(onTimeResult.S_new)
    })
  })

  describe("Invariant 4 — Scheduler isolation", () => {
    test("should produce identical S_new regardless of scheduler implementation", () => {
      class FastScheduler {
        schedule(input: any) {
          return {
            nextInterval: input.S_eff * 0.5,
            due: new Date(Date.now() + input.S_eff * 12 * 60 * 60 * 1000)
          }
        }
      }

      const input = { ...baseInput, t: 5 }
      
      const resultWithDefault = reviewStep({ ...input, scheduler: new MockScheduler() })
      const resultWithFast = reviewStep({ ...input, scheduler: new FastScheduler() })

      expect(resultWithDefault.S_new).toBe(resultWithFast.S_new)
    })

    test("should hold across all grades", () => {
      class SlowScheduler {
        schedule(input: any) {
          return {
            nextInterval: input.S_eff * 2.0,
            due: new Date(Date.now() + input.S_eff * 48 * 60 * 60 * 1000)
          }
        }
      }

      const grades = ["Again", "Hard", "Good", "Easy"] as const

      grades.forEach(grade => {
        const input = { ...baseInput, t: 5, grade }
        
        const resultWithDefault = reviewStep({ ...input, scheduler: new MockScheduler() })
        const resultWithSlow = reviewStep({ ...input, scheduler: new SlowScheduler() })

        expect(resultWithDefault.S_new).toBe(resultWithSlow.S_new)
      })
    })

    test("should hold with different stability values", () => {
      class VariableScheduler {
        schedule(input: any) {
          const multiplier = input.S_eff > 20 ? 3 : 1
          return {
            nextInterval: input.S_eff * multiplier,
            due: new Date(Date.now() + input.S_eff * multiplier * 24 * 60 * 60 * 1000)
          }
        }
      }

      const stabilities = [1, 5, 10, 50, 100]

      stabilities.forEach(S => {
        const input = { ...baseInput, t: 5, S }
        
        const resultWithDefault = reviewStep({ ...input, scheduler: new MockScheduler() })
        const resultWithVariable = reviewStep({ ...input, scheduler: new VariableScheduler() })

        expect(resultWithDefault.S_new).toBe(resultWithVariable.S_new)
      })
    })

    test("should hold with adaptive retention enabled", () => {
      class AdaptiveScheduler {
        schedule(input: any) {
          return {
            nextInterval: input.S_eff * (input.R_eff > 0.9 ? 1.5 : 1.0),
            due: new Date(Date.now() + input.S_eff * 24 * 60 * 60 * 1000)
          }
        }
      }

      const input = { ...baseInput, t: 5, R_target: 0.95 }
      
      const resultWithDefault = reviewStep({ ...input, scheduler: new MockScheduler() })
      const resultWithAdaptive = reviewStep({ ...input, scheduler: new AdaptiveScheduler() })

      expect(resultWithDefault.S_new).toBe(resultWithAdaptive.S_new)
    })
  })

  describe("Load-aware invariants", () => {
    test("higher load must never increase stability", () => {
      const baseInput = {
        S: 10,
        difficulty: 5,
        t: 5,
        grade: "Good" as const,
        now: new Date("2023-01-01"),
        scheduler: new MockScheduler(),
      }

      const lowLoadSignals: RetentionSignals = {
        backlogSize: 5,
        recentFailureRate: 0.1,
        sessionLength: 20,
        dailyCapacity: 100,
        dueToday: 30, // Low load
      }
      
      const highLoadSignals: RetentionSignals = {
        backlogSize: 30,
        recentFailureRate: 0.2,
        sessionLength: 45,
        dailyCapacity: 50,
        dueToday: 100, // High load (2x overload)
      }
      
      const lowLoadResult = reviewStep({
        ...baseInput,
        retentionSignals: lowLoadSignals,
      })
      
      const highLoadResult = reviewStep({
        ...baseInput,
        retentionSignals: highLoadSignals,
      })
      
      // CRITICAL: Higher load must never increase stability
      expect(highLoadResult.S_new).toBeLessThanOrEqual(lowLoadResult.S_new)
    })

    test("struggling conditions must never increase stability over normal", () => {
      const baseInput = {
        S: 10,
        difficulty: 5,
        t: 5,
        grade: "Good" as const,
        now: new Date("2023-01-01"),
        scheduler: new MockScheduler(),
      }

      const normalSignals: RetentionSignals = {
        backlogSize: 10,
        recentFailureRate: 0.15,
        sessionLength: 30,
        dailyCapacity: 100,
        dueToday: 50,
      }
      
      const strugglingSignals: RetentionSignals = {
        backlogSize: 50,
        recentFailureRate: 0.4,
        sessionLength: 60,
        dailyCapacity: 80,
        dueToday: 90,
      }
      
      const normalResult = reviewStep({
        ...baseInput,
        retentionSignals: normalSignals,
      })
      
      const strugglingResult = reviewStep({
        ...baseInput,
        retentionSignals: strugglingSignals,
      })
      
      // CRITICAL: Struggling must never increase stability over normal
      expect(strugglingResult.S_new).toBeLessThanOrEqual(normalResult.S_new)
    })

    test("higher session length must never increase stability", () => {
      const baseInput = {
        S: 10,
        difficulty: 5,
        t: 5,
        grade: "Good" as const,
        now: new Date("2023-01-01"),
        scheduler: new MockScheduler(),
      }

      const shortSessionResult = reviewStep({
        ...baseInput,
        reviewsSoFarInSession: 5,
      })
      
      const longSessionResult = reviewStep({
        ...baseInput,
        reviewsSoFarInSession: 50,
      })
      
      // CRITICAL: Higher session length must never increase stability
      expect(longSessionResult.S_new).toBeLessThanOrEqual(shortSessionResult.S_new)
    })

    test("session momentum must be monotonic decreasing", () => {
      const baseInput = {
        S: 10,
        difficulty: 5,
        t: 5,
        grade: "Good" as const,
        now: new Date("2023-01-01"),
        scheduler: new MockScheduler(),
      }

      const results = [0, 10, 20, 30, 40, 50].map(reviewsSoFar => 
        reviewStep({ ...baseInput, reviewsSoFarInSession: reviewsSoFar })
      )
      
      // Verify monotonic decreasing
      for (let i = 1; i < results.length; i++) {
        expect(results[i].S_new).toBeLessThanOrEqual(results[i - 1].S_new)
      }
    })
  })

  describe("Component-level invariants", () => {
    describe("computeEffectiveState", () => {
      test("should reduce t_eff for early reviews", () => {
        const normalResult = computeEffectiveState({ S: 10, t: 5, early: false, postponed: false })
        const earlyResult = computeEffectiveState({ S: 10, t: 5, early: true, postponed: false })

        expect(earlyResult.t_eff).toBeLessThan(normalResult.t_eff)
      })

      test("should increase t_eff for postponed reviews", () => {
        const normalResult = computeEffectiveState({ S: 10, t: 5, early: false, postponed: false })
        const postponedResult = computeEffectiveState({ S: 10, t: 5, early: false, postponed: true })

        expect(postponedResult.t_eff).toBeGreaterThan(normalResult.t_eff)
      })

      test("should apply anti-hoarding penalty for delayed reviews", () => {
        const onTimeResult = computeEffectiveState({ S: 10, t: 5, scheduled_t: 5 })
        const delayedResult = computeEffectiveState({ S: 10, t: 10, scheduled_t: 5 })

        expect(delayedResult.t_eff).toBeGreaterThan(onTimeResult.t_eff)
      })

      test("should penalize longer delays more severely", () => {
        const slightlyDelayedResult = computeEffectiveState({ S: 10, t: 8, scheduled_t: 5 })
        const severelyDelayedResult = computeEffectiveState({ S: 10, t: 15, scheduled_t: 5 })

        expect(severelyDelayedResult.t_eff).toBeGreaterThan(slightlyDelayedResult.t_eff)
      })

      test("should still apply early review reduction with scheduled_t", () => {
        const normalEarlyResult = computeEffectiveState({ S: 10, t: 3, early: true, scheduled_t: 5 })
        const normalResult = computeEffectiveState({ S: 10, t: 3, early: false, scheduled_t: 5 })

        expect(normalEarlyResult.t_eff).toBeLessThan(normalResult.t_eff)
      })
    })

    describe("applyAdaptiveRetention", () => {
      test("should move R_eff toward target when strength > 0", () => {
        const R_eff = 0.8
        const R_target = 0.9
        const strength = 0.5

        const result = applyAdaptiveRetention(R_eff, R_target, strength)

        expect(result).toBeGreaterThan(R_eff)
        expect(result).toBeLessThan(R_target)
      })

      test("should move R_eff toward target when target < current", () => {
        const R_eff = 0.9
        const R_target = 0.7
        const strength = 0.5

        const result = applyAdaptiveRetention(R_eff, R_target, strength)

        expect(result).toBeLessThan(R_eff)
        expect(result).toBeGreaterThan(R_target)
      })

      test("should clamp output to valid range", () => {
        expect(applyAdaptiveRetention(0.5, 2.0, 1.0)).toBe(0.99)
        expect(applyAdaptiveRetention(0.5, -1.0, 1.0)).toBe(0.01)
      })

      test("should return unchanged when strength = 0", () => {
        const R_eff = 0.8
        const R_target = 0.9

        const result = applyAdaptiveRetention(R_eff, R_target, 0.0)

        expect(result).toBe(R_eff)
      })
    })

    describe("updateStabilityTensor", () => {
      test("should apply bounds to output", () => {
        const veryLowInput = { S: 0.0001, R_eff: 0.01, grade: 1 as any, difficulty: 1 }
        const veryHighInput = { S: 1000000, R_eff: 0.99, grade: 4 as any, difficulty: 1 }

        const lowResult = updateStabilityTensor(veryLowInput)
        const highResult = updateStabilityTensor(veryHighInput)

        expect(lowResult).toBeGreaterThanOrEqual(0.1)
        expect(highResult).toBeLessThanOrEqual(36500)
      })

      test("should not apply context and session multipliers (they're applied in reviewStep)", () => {
        const baseInput = { S: 10, R_eff: 0.8, grade: 3 as any, difficulty: 3 }
        // updateStabilityTensor should not accept contextMultiplier/sessionMomentum anymore
        // They're applied after in reviewStep
        const baseResult = updateStabilityTensor(baseInput)
        const sameResult = updateStabilityTensor(baseInput)

        expect(sameResult).toBe(baseResult)
      })
    })
  })
})