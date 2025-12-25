import { reviewStep } from "../reviewStep";

// Simple mock scheduler for Monte Carlo simulation
class MockScheduler {
  schedule(input: any) {
    // Simple deterministic scheduling based on stability and grade
    const { S_eff, grade } = input;
    const gradeMultiplier: Record<string, number> = {
      "Again": 0.05,
      "Hard": 0.15,
      "Good": 0.3,
      "Easy": 0.6,
    };
    
    const multiplier = gradeMultiplier[grade] || 1.0;
    const nextInterval = Math.max(1, S_eff * multiplier);
    const due = new Date(Date.now() + nextInterval * 24 * 60 * 60 * 1000);
    
    return { nextInterval, due };
  }
}

// ---------- Config ----------

const NUM_CARDS = 500; // Reduced from 500 to avoid hitting stability bounds
const REVIEWS_PER_CARD = 20; // Reduced from 50 for reasonable simulation

const INITIAL_STABILITY = 5;
const INITIAL_DIFFICULTY = 5;

// Grade distribution (biased toward realistic usage)
const GRADE_DISTRIBUTION: Array<{
  grade: "Again" | "Hard" | "Good" | "Easy";
  p: number;
}> = [
  { grade: "Again", p: 0.1 },
  { grade: "Hard", p: 0.2 },
  { grade: "Good", p: 0.55 },
  { grade: "Easy", p: 0.15 },
];

// ---------- Utilities ----------

function sampleGrade(): "Again" | "Hard" | "Good" | "Easy" {
  const r = Math.random();
  let acc = 0;
  for (const { grade, p } of GRADE_DISTRIBUTION) {
    acc += p;
    if (r <= acc) return grade;
  }
  return "Good";
}

function mean(xs: number[]) {
  return xs.reduce((a, b) => a + b, 0) / xs.length;
}

function variance(xs: number[]) {
  const m = mean(xs);
  return mean(xs.map((x) => (x - m) ** 2));
}

// ---------- Simulation ----------

export function runMonteCarlo() {
  const scheduler = new MockScheduler();
  const finalStabilities: number[] = [];
  const allIntervals: number[] = [];

  for (let c = 0; c < NUM_CARDS; c++) {
    let S = INITIAL_STABILITY;
    let difficulty = INITIAL_DIFFICULTY;
    let now = new Date();
    let t = 1;

    for (let r = 0; r < REVIEWS_PER_CARD; r++) {
      const grade = sampleGrade();

      const result = reviewStep({
        S,
        difficulty,
        t,
        grade,
        now,
        scheduler,
        reviewsSoFarInSession: r, // Track session progress
      });



      S = result.S_new;
      t = Math.max(1, result.nextInterval);
      now = result.due;

      allIntervals.push(result.nextInterval);
    }

    finalStabilities.push(S);
  }

  // ---------- Reporting ----------

  const meanStability = mean(finalStabilities);
  const varStability = variance(finalStabilities);

  const meanInterval = mean(allIntervals);
  const varInterval = variance(allIntervals);

  console.log("=== Tensor Monte Carlo Summary ===");
  console.log(`Cards simulated: ${NUM_CARDS}`);
  console.log(`Reviews per card: ${REVIEWS_PER_CARD}`);
  console.log("");
  console.log("Final Stability:");
  console.log(`  Mean: ${meanStability.toFixed(2)}`);
  console.log(`  Variance: ${varStability.toFixed(2)}`);
  console.log("");
  console.log("Intervals:");
  console.log(`  Mean: ${meanInterval.toFixed(2)} days`);
  console.log(`  Variance: ${varInterval.toFixed(2)}`);
  console.log("");
  console.log("Sanity checks:");
  console.log(`  Min stability: ${Math.min(...finalStabilities).toFixed(2)}`);
  console.log(`  Max stability: ${Math.max(...finalStabilities).toFixed(2)}`);
  console.log(`  Min interval: ${Math.min(...allIntervals).toFixed(2)}`);
  console.log(`  Max interval: ${Math.max(...allIntervals).toFixed(2)}`);
}

// Run directly
runMonteCarlo();