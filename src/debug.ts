import { computeEffectiveState } from "./tensor/computeEffectiveState";

// Debug anti-hoarding mechanism
console.log("=== Debugging Anti-Hoarding ===");

const baseInput = { S: 10, t: 5, scheduled_t: 5 };
const delayedInput = { S: 10, t: 10, scheduled_t: 5 };

const baseResult = computeEffectiveState(baseInput);
const delayedResult = computeEffectiveState(delayedInput);

console.log("Base input (t=5, scheduled_t=5):");
console.log(`  t_eff: ${baseResult.t_eff}`);
console.log(`  R_eff: ${baseResult.R_eff}`);

console.log("Delayed input (t=10, scheduled_t=5):");
console.log(`  t_eff: ${delayedResult.t_eff}`);
console.log(`  R_eff: ${delayedResult.R_eff}`);

// Manual calculation verification
const lambda = 1.2;
const expected_t_eff = 10 - 5 + lambda * 5;
console.log(`Expected t_eff: ${expected_t_eff}`);
console.log(`Actual t_eff: ${delayedResult.t_eff}`);
