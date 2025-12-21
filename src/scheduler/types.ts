export interface SchedulerInput {
  now: Date;

  // Tensor outputs
  S_eff: number; // effective stability
  R_eff: number; // effective recall probability
  t_eff: number; // effective elapsed time (days)

  // Review outcome (still needed)
  grade: "Again" | "Hard" | "Good" | "Easy";

  // Difficulty stays explicit
  difficulty: number;
}

export interface SchedulerOutput {
  nextInterval: number; // in days
  due: Date;
}

export interface Scheduler {
  schedule(input: SchedulerInput): SchedulerOutput
}
