/**
 * Load pressure policy module
 * Computes load pressure from due cards vs daily capacity
 * 
 * Pressure must be monotonic decreasing with load.
 * Pressure must be a single scalar.
 */

/**
 * Compute load pressure from due cards vs daily capacity
 * 
 * Formula: pressure = clamp(dailyCapacity / dueToday, 0.85, 1.0)
 * 
 * @param dueToday - Number of cards due today
 * @param dailyCapacity - Maximum cards user can handle per day
 * @returns Pressure multiplier (0.85-1.0, where 0.85 = max pressure)
 */
export function computeLoadPressure(dueToday: number, dailyCapacity: number): number {
  if (dueToday <= 0) return 1.0; // No load, full pressure
  if (dailyCapacity <= 0) return 0.85; // Max pressure for invalid capacity
  
  // pressure = clamp(dailyCapacity / dueToday, 0.85, 1.0)
  const pressure = Math.min(1.0, Math.max(0.85, dailyCapacity / dueToday));
  
  return pressure;
}