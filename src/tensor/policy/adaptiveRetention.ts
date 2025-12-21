/**
 * Adaptive retention policy module
 * Handles dynamic retention targeting and pressure-scaled adaptive retention
 */

export interface RetentionSignals {
  /** Number of cards currently overdue/backlogged */
  backlogSize: number;
  
  /** Recent failure rate (0.0-1.0) */
  recentFailureRate: number;
  
  /** Current session length in minutes */
  sessionLength: number;
  
  /** User's daily capacity for reviews */
  dailyCapacity: number;
  
  /** Number of cards due today */
  dueToday: number;
  
  /** Recent success rate (0.0-1.0) - optional, computed from failure rate if not provided */
  recentSuccessRate?: number;
  
  /** User intent signal (0.0-1.0) - optional, inferred from backlog/session if not provided */
  userIntent?: number;
}

/**
 * Compute dynamic retention target
 * 
 * Formula: R_target = clamp(R_base + γ * recentSuccessRate + δ * userIntent, 0.75, 0.97)
 * 
 * @param signals - Current system signals
 * @param R_base - Base retention target (default: 0.85)
 * @param gamma - Weight for recent success rate (default: 0.1)
 * @param delta - Weight for user intent (default: 0.02)
 * @returns Dynamic retention target (0.75-0.97)
 */
export function computeRTarget(
  signals: RetentionSignals,
  R_base: number = 0.85,
  gamma: number = 0.1,
  delta: number = 0.02
): number {
  // Compute recent success rate from failure rate if not provided
  const recentSuccessRate = signals.recentSuccessRate ?? (1.0 - signals.recentFailureRate);
  
  // Compute user intent from backlog and session if not provided
  // Lower backlog and shorter sessions indicate higher intent
  const userIntent = signals.userIntent ?? Math.max(0, Math.min(1, 
    1.0 - (signals.backlogSize / 100.0) - (signals.sessionLength / 120.0)
  ));
  
  // R_target = clamp(R_base + γ * recentSuccessRate + δ * userIntent, 0.75, 0.97)
  let R_target = R_base + gamma * recentSuccessRate + delta * userIntent;
  
  // Additional penalty for high load (ensures struggling conditions reduce target more)
  const loadRatio = signals.dailyCapacity > 0 ? signals.dueToday / signals.dailyCapacity : 1.0;
  if (loadRatio > 1.0) {
    // Reduce target when overloaded
    R_target -= 0.05 * Math.min(1.0, (loadRatio - 1.0));
  }
  
  return Math.min(0.97, Math.max(0.75, R_target));
}

/**
 * Apply adaptive retention with pressure-scaled strength
 * 
 * Formula: R_eff_new = R_eff + adaptiveStrength * (R_target - R_eff)
 * where adaptiveStrength = baseStrength * pressure
 * 
 * CRITICAL: Pressure must reduce adaptive strength
 * Never modify stability here
 * 
 * @param R_eff - Current effective recall probability
 * @param R_target - Target recall probability
 * @param strength - Adaptive strength (should be pressure-scaled: baseStrength * pressure)
 * @returns Adjusted recall probability clamped to (0.01, 0.99)
 */
export function applyAdaptiveRetention(
  R_eff: number,
  R_target: number,
  strength: number
): number {
  // R_eff_new = R_eff + adaptiveStrength * (R_target - R_eff)
  const R_eff_new = R_eff + strength * (R_target - R_eff);
  
  // Clamp to valid probability range
  return Math.min(0.99, Math.max(0.01, R_eff_new));
}

/**
 * Apply pressure-scaled adaptive retention (convenience wrapper)
 * 
 * @param R_eff - Current effective recall probability
 * @param R_target - Target recall probability (independent of pressure)
 * @param baseStrength - Base adaptive strength (typically 0.5)
 * @param pressure - Load pressure (0.85-1.0)
 * @returns Adjusted recall probability clamped to (0.01, 0.99)
 */
export function applyPressureScaledAdaptiveRetention(
  R_eff: number,
  R_target: number,
  baseStrength: number,
  pressure: number
): number {
  // CRITICAL: adaptiveStrength must scale with pressure
  const adaptiveStrength = baseStrength * pressure;
  
  return applyAdaptiveRetention(R_eff, R_target, adaptiveStrength);
}

/**
 * Compute dynamic retention target (alias for backward compatibility)
 */
export const computeDynamicRetentionTarget = computeRTarget;