import { computeEffectiveState } from "./computeEffectiveState"
import { updateStabilityTensor } from "./updateTensorStability"
import { Scheduler, SchedulerOutput } from "../scheduler/types"
import { Grade } from "../fsrs/models"
import { computeLoadPressure } from "./policy/loadPressure"
import { computeRTarget, applyAdaptiveRetention, RetentionSignals } from "./policy/adaptiveRetention"
import { computeSessionMomentum } from "./policy/sessionMomentum"
import { computeContextMultiplier } from "./policy/contextModulation"

export interface ReviewStepInput {
  S: number
  difficulty: number
  t: number
  scheduled_t?: number
  grade: "Again" | "Hard" | "Good" | "Easy"

  early?: boolean
  postponed?: boolean
  R_target?: number

  // Policy signals
  retentionSignals?: RetentionSignals
  reviewsSoFarInSession?: number
  contextSignals?: Parameters<typeof computeContextMultiplier>[0]

  now: Date
  scheduler: Scheduler
}

export interface ReviewStepOutput {
  S_new: number
  nextInterval: number
  due: Date
  R_eff: number
  t_eff: number
}

export function reviewStep(input: ReviewStepInput): ReviewStepOutput {
  const {
    S,
    difficulty,
    t,
    scheduled_t,
    grade,
    early = false,
    postponed = false,
    R_target,
    retentionSignals,
    reviewsSoFarInSession = 0,
    contextSignals,
    now,
    scheduler,
  } = input

  // Grade mapping for FSRS compatibility
  const gradeMap: Record<ReviewStepInput["grade"], Grade> = {
    Again: 1,
    Hard: 2,
    Good: 3,
    Easy: 4,
  }

  // Step 1: Compute effective state
  const { R_eff, t_eff } = computeEffectiveState({
    S,
    t,
    scheduled_t,
    early,
    postponed,
    contextMultiplier: 1, // Context modulation applied later
  })

  // Step 2: Compute load pressure
  const pressure = retentionSignals
    ? computeLoadPressure(retentionSignals.dueToday, retentionSignals.dailyCapacity)
    : 1.0

  // Step 3: Compute dynamic R_target (independent of pressure)
  const R_target_computed = R_target ?? (retentionSignals
    ? computeRTarget(retentionSignals)
    : 0.9)

  // Step 4: Apply adaptive retention with pressure-scaled strength
  const baseStrength = 0.5
  const adaptiveStrength = baseStrength * pressure
  const adjustedR_eff = applyAdaptiveRetention(R_eff, R_target_computed, adaptiveStrength)

  // Step 5: Update stability tensor (FSRS math - no pressure here)
  // Do NOT pass contextMultiplier or sessionMomentum - they're applied after
  let S_new = updateStabilityTensor({
    S,
    R_eff: adjustedR_eff,
    grade: gradeMap[grade],
    difficulty,
    scheduled_t,
    actual_t: t,
  })

  // Step 6: Apply sessionMomentum × loadPressure × contextMultiplier
  const sessionMomentum = computeSessionMomentum(reviewsSoFarInSession)
  const contextMultiplier = computeContextMultiplier(contextSignals)
  S_new = S_new * sessionMomentum * pressure * contextMultiplier
  
  // CRITICAL: Ensure higher load never increases stability
  // If pressure < 1.0, compute baseline without retentionSignals and ensure we don't exceed it
  if (retentionSignals && pressure < 1.0) {
    const baselineR_eff = computeEffectiveState({
      S,
      t,
      scheduled_t,
      early,
      postponed,
      contextMultiplier: 1,
    }).R_eff
    const baselineS_new = updateStabilityTensor({
      S,
      R_eff: baselineR_eff,
      grade: gradeMap[grade],
      difficulty,
      scheduled_t,
      actual_t: t,
    })
    const maxAllowedS_new = baselineS_new * sessionMomentum * pressure * contextMultiplier
    S_new = Math.min(S_new, maxAllowedS_new)
  }

  // Step 7: Schedule next review
  const schedulerResult: SchedulerOutput = scheduler.schedule({
    S_eff: S_new,
    t_eff,
    R_eff: adjustedR_eff,
    grade,
    difficulty,
    now,
  })

  return {
    S_new,
    nextInterval: schedulerResult.nextInterval,
    due: schedulerResult.due,
    R_eff: adjustedR_eff,
    t_eff,
  }
}