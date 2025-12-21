/**
 * Context modulation policy module
 * Light contextual modulation (environment, difficulty)
 * 
 * Must be bounded.
 * Must be multiplicative.
 * Must never override load pressure.
 */

export interface ContextSignals {
  /** Environment quality (0.0-1.0, where 1.0 is optimal) */
  environmentQuality?: number;
  
  /** Card difficulty (0.0-1.0, where 0.0 is easiest) */
  difficulty?: number;
  
  /** Time of day factor (0.0-1.0, where 1.0 is optimal time) */
  timeOfDay?: number;
}

/**
 * Compute context multiplier
 * 
 * Formula: contextMultiplier ∈ [0.85, 1.05]
 * 
 * @param signals - Context signals (optional)
 * @returns Context multiplier (0.85-1.05)
 */
export function computeContextMultiplier(signals?: ContextSignals): number {
  if (!signals) {
    return 1.0; // Default: no modulation
  }
  
  // Base multiplier
  let multiplier = 1.0;
  
  // Adjust for environment quality
  if (signals.environmentQuality !== undefined) {
    multiplier += (signals.environmentQuality - 0.5) * 0.1;
  }
  
  // Adjust for difficulty (easier cards get slight boost)
  if (signals.difficulty !== undefined) {
    multiplier += (1.0 - signals.difficulty) * 0.05;
  }
  
  // Adjust for time of day
  if (signals.timeOfDay !== undefined) {
    multiplier += (signals.timeOfDay - 0.5) * 0.05;
  }
  
  // Clamp to [0.85, 1.05]
  return Math.min(1.05, Math.max(0.85, multiplier));
}

