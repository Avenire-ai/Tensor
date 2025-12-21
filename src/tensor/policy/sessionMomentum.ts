/**
 * Session momentum policy module
 * Models cognitive fatigue within a session
 * 
 * Momentum may only decrease.
 * Momentum multiplies stability after FSRS update.
 * Never increase stability.
 */

/**
 * Compute session momentum based on reviews completed in session
 * 
 * Formula: momentum = clamp(exp(-k * reviewsSoFarInSession), 0.9, 1.0)
 * 
 * @param reviewsSoFar - Number of reviews completed in current session
 * @param k - Decay constant (default: 0.02)
 * @returns Momentum multiplier (0.9-1.0)
 */
export function computeSessionMomentum(reviewsSoFar: number, k: number = 0.02): number {
  // momentum = clamp(exp(-k * reviewsSoFarInSession), 0.9, 1.0)
  const momentum = Math.exp(-k * reviewsSoFar);
  
  return Math.min(1.0, Math.max(0.9, momentum));
}


