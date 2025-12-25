import { reviewStep } from "./reviewStep";
import { RetentionSignals } from "./policy/adaptiveRetention";

// Mock scheduler for demonstration
class MockScheduler {
  schedule(input: any) {
    return {
      nextInterval: input.S_eff * 1.0,
      due: new Date(Date.now() + input.S_eff * 24 * 60 * 60 * 1000)
    };
  }
}

export function demonstrateEnhancedRetention() {
  console.log("=== Tensor Review Pipeline Demonstration ===\n");

  const baseInput = {
    S: 10,
    difficulty: 5,
    t: 5,
    grade: "Good" as const,
    now: new Date("2023-01-01"),
    scheduler: new MockScheduler(),
  };

  // Scenario 1: Normal conditions
console.log("1. Normal Conditions (no pressure):");
  const normalSignals: RetentionSignals = {
    backlogSize: 10,
    recentFailureRate: 0.15,
    sessionLength: 30,
    dailyCapacity: 100,
    dueToday: 50,
  };

  const normalResult = reviewStep({
    ...baseInput,
    retentionSignals: normalSignals,
  });

  console.log(`   Final S_new: ${normalResult.S_new.toFixed(2)}`);
  console.log(`   Final R_eff: ${normalResult.R_eff.toFixed(3)}\n`);

  // Scenario 2: High load conditions
  console.log("2. High Load Conditions (2x overload):");
  const highLoadSignals: RetentionSignals = {
    backlogSize: 30,
    recentFailureRate: 0.2,
    sessionLength: 45,
    dailyCapacity: 50,
    dueToday: 100, // 2x overload
  };

  const highLoadResult = reviewStep({
    ...baseInput,
    retentionSignals: highLoadSignals,
  });

  console.log(`   Final S_new: ${highLoadResult.S_new.toFixed(2)}`);
  console.log(`   Final R_eff: ${highLoadResult.R_eff.toFixed(3)}\n`);

  // Scenario 3: Struggling user
  console.log("3. Struggling User (high failure rate):");
  const strugglingSignals: RetentionSignals = {
    backlogSize: 50,
    recentFailureRate: 0.4,
    sessionLength: 60,
    dailyCapacity: 80,
    dueToday: 90,
  };

  const strugglingResult = reviewStep({
    ...baseInput,
    retentionSignals: strugglingSignals,
  });

  console.log(`   Final S_new: ${strugglingResult.S_new.toFixed(2)}`);
  console.log(`   Final R_eff: ${strugglingResult.R_eff.toFixed(3)}\n`);

  // Scenario 4: Optimal conditions
  console.log("4. Optimal Conditions (low load, high performance):");
  const optimalSignals: RetentionSignals = {
    backlogSize: 5,
    recentFailureRate: 0.05,
    sessionLength: 20,
    dailyCapacity: 100,
    dueToday: 30,
  };

  const optimalResult = reviewStep({
    ...baseInput,
    retentionSignals: optimalSignals,
  });

  console.log(`   Final S_new: ${optimalResult.S_new.toFixed(2)}`);
  console.log(`   Final R_eff: ${optimalResult.R_eff.toFixed(3)}\n`);

  // Comparison
  console.log("=== Comparison Summary ===");
  console.log("Scenario                | S_new  | R_eff");
  console.log("------------------------|--------|--------");
  console.log(`Normal                  | ${normalResult.S_new.toFixed(2).padStart(6)} | ${normalResult.R_eff.toFixed(3).padStart(6)}`);
  console.log(`High Load               | ${highLoadResult.S_new.toFixed(2).padStart(6)} | ${highLoadResult.R_eff.toFixed(3).padStart(6)}`);
  console.log(`Struggling              | ${strugglingResult.S_new.toFixed(2).padStart(6)} | ${strugglingResult.R_eff.toFixed(3).padStart(6)}`);
  console.log(`Optimal                 | ${optimalResult.S_new.toFixed(2).padStart(6)} | ${optimalResult.R_eff.toFixed(3).padStart(6)}`);
}

// Run demonstration
demonstrateEnhancedRetention();