// tensor/updateStabilityTensor.ts

import { next_recall_stability } from "../fsrs/core/stability"
import { default_w } from "../fsrs/core/params"
import { Grade } from "../fsrs/models"

export interface StabilityUpdateInput {
  S: number
  R_eff: number
  grade: Grade
  difficulty: number
  scheduled_t?: number
  actual_t?: number

  contextMultiplier?: number
  sessionMomentum?: number
}

export function updateStabilityTensor(
  input: StabilityUpdateInput
): number {
  const {
    S,
    R_eff,
    grade,
    difficulty,
    scheduled_t,
    actual_t,
    contextMultiplier = 1,
    sessionMomentum = 1,
  } = input

  // Core FSRS stability update using next_recall_stability
  const S_base = next_recall_stability(
    [...default_w],
    difficulty,
    S,
    R_eff,
    grade
  )

  // Tensor-level modulation
  let S_new = S_base * contextMultiplier * sessionMomentum

  // Apply anti-hoarding penalty if review was delayed
  if (scheduled_t !== undefined && actual_t !== undefined && actual_t > scheduled_t) {
    const delay_ratio = actual_t / scheduled_t
    const penalty = Math.pow(delay_ratio, 0.8) // Sub-linear penalty
    S_new = S_new / penalty
  }

  // Apply bounds to ensure valid stability values
  const MIN_STABILITY = 0.1
  const MAX_STABILITY = 36500

  return Math.min(MAX_STABILITY, Math.max(MIN_STABILITY, S_new))
}
