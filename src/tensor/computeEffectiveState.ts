// tensor/computeEffectiveState.ts

import { forgetting_curve } from "../fsrs/core/recall"
import { default_w } from "../fsrs/core/params"

export interface EffectiveStateInput {
  S: number
  t: number
  scheduled_t?: number

  early?: boolean
  postponed?: boolean

  contextMultiplier?: number
}

export interface EffectiveState {
  R_eff: number
  t_eff: number
}

export function computeEffectiveState(
  input: EffectiveStateInput
): EffectiveState {
  const {
    S,
    t,
    scheduled_t,
    early = false,
    postponed = false,
    contextMultiplier = 1,
  } = input

  // Calculate effective elapsed time with anti-hoarding mechanism
  let t_eff = t

  if (scheduled_t !== undefined && t > scheduled_t) {
    // Anti-hoarding: moderate penalty for delay
    const lambda = 1.5
    t_eff = (t - scheduled_t) + lambda * scheduled_t
  } else {
    t_eff = t
  }

  // Apply early review reduction (still applies even with scheduled_t)
  if (early) {
    t_eff = Math.max(0, t_eff * 0.85)
  }

  // Apply postponed review increase (only if not already handled by anti-hoarding)
  if (postponed && scheduled_t === undefined) {
    t_eff = t_eff * 1.15
  }

  // Base recall probability from FSRS math
  let R_eff = forgetting_curve([...default_w], t_eff, S)

  // Apply context modulation with bounds to maintain valid probability
  R_eff *= contextMultiplier
  R_eff = Math.min(0.99, Math.max(0.01, R_eff))

  return { R_eff, t_eff }
}
