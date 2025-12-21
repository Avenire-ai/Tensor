import { type StepUnit, type FSRSParameters, type Card, type DateInput, State } from "../models";
import { TypeConvert } from "../convert";
import { clamp } from "../help";

export const default_request_retention = 0.9;
export const default_maximum_interval = 36500;
export const default_enable_fuzz = false;
export const default_enable_short_term = true;
export const default_learning_steps: readonly StepUnit[] = Object.freeze([
  "1m",
  "10m",
]); // New->Learning,Learning->Learning

export const default_relearning_steps: readonly StepUnit[] = Object.freeze([
  "10m",
]); // Relearning->Relearning

export const S_MIN = 0.001;
export const S_MAX = 36500.0;
export const INIT_S_MAX = 100.0;
export const FSRS5_DEFAULT_DECAY = 0.5;
export const FSRS6_DEFAULT_DECAY = 0.1542;
export const default_w = Object.freeze([
  0.212,
  1.2931,
  2.3065,
  8.2956,
  6.4133,
  0.8334,
  3.0194,
  0.001,
  1.8722,
  0.1666,
  0.796,
  1.4835,
  0.0614,
  0.2629,
  1.6483,
  0.6014,
  1.8729,
  0.5425,
  0.0912,
  0.0658,
  FSRS6_DEFAULT_DECAY,
]) satisfies readonly number[];

export const W17_W18_Ceiling = 2.0;
export const CLAMP_PARAMETERS = (
  w17_w18_ceiling: number,
  enable_short_term: boolean = default_enable_short_term,
) => [
  [S_MIN, INIT_S_MAX] /** initial stability (Again) */,
  [S_MIN, INIT_S_MAX] /** initial stability (Hard) */,
  [S_MIN, INIT_S_MAX] /** initial stability (Good) */,
  [S_MIN, INIT_S_MAX] /** initial stability (Easy) */,
  [1.0, 10.0] /** initial difficulty (Good) */,
  [0.001, 4.0] /** initial difficulty (multiplier) */,
  [0.001, 4.0] /** difficulty (multiplier) */,
  [0.001, 0.75] /** difficulty (multiplier) */,
  [0.0, 4.5] /** stability (exponent) */,
  [0.0, 0.8] /** stability (negative power) */,
  [0.001, 3.5] /** stability (exponent) */,
  [0.001, 5.0] /** fail stability (multiplier) */,
  [0.001, 0.25] /** fail stability (negative power) */,
  [0.001, 0.9] /** fail stability (power) */,
  [0.0, 4.0] /** fail stability (exponent) */,
  [0.0, 1.0] /** stability (multiplier for Hard) */,
  [1.0, 6.0] /** stability (multiplier for Easy) */,
  [0.0, w17_w18_ceiling] /** short-term stability (exponent) */,
  [0.0, w17_w18_ceiling] /** short-term stability (exponent) */,
  [
    enable_short_term ? 0.01 : 0.0,
    0.8,
  ] /** short-term last-stability (exponent) */,
  [0.1, 0.8] /** decay */,
];

/**
 * @returns The input if the parameters are valid, throws if they are invalid
 * @example
 * try {
 *   generatorParameters({
 *     w: checkParameters([0.40255])
 *   });
 * } catch (e: any) {
 *   alert(e);
 * }
 */
export const checkParameters = (parameters: number[] | readonly number[]) => {
  const invalid = parameters.find(
    (param) => !Number.isFinite(param) && !Number.isNaN(param),
  );
  if (invalid !== undefined) {
    throw Error(`Non-finite or NaN value in parameters ${parameters}`);
  } else if (![17, 19, 21].includes(parameters.length)) {
    throw Error(
      `Invalid parameter length: ${parameters.length}. Must be 17, 19 or 21 for FSRSv4, 5 and 6 respectively.`,
    );
  }
  return parameters;
};

export const migrateParameters = (
  parameters?: number[] | readonly number[],
  numRelearningSteps: number = 0,
  enableShortTerm: boolean = default_enable_short_term,
) => {
  if (parameters === undefined) {
    return [...default_w];
  }
  switch (parameters.length) {
    case 21:
      return clipParameters(
        Array.from(parameters),
        numRelearningSteps,
        enableShortTerm,
      );
    case 19:
      console.debug("[FSRS-6]auto fill w from 19 to 21 length");
      return clipParameters(
        Array.from(parameters),
        numRelearningSteps,
        enableShortTerm,
      ).concat([0.0, FSRS5_DEFAULT_DECAY]);
    case 17: {
      const w = clipParameters(
        Array.from(parameters),
        numRelearningSteps,
        enableShortTerm,
      );
      w[4] = +(w[5] * 2.0 + w[4]).toFixed(8);
      w[5] = +(Math.log(w[5] * 3.0 + 1.0) / 3.0).toFixed(8);
      w[6] = +(w[6] + 0.5).toFixed(8);
      console.debug("[FSRS-6]auto fill w from 17 to 21 length");
      return w.concat([0.0, 0.0, 0.0, FSRS5_DEFAULT_DECAY]);
    }
    default:
      // To throw use "checkParameters"
      // ref: https://github.com/open-spaced-repetition/ts-fsrs/pull/174#discussion_r2070436201
      console.warn("[FSRS]Invalid parameters length, using default parameters");
      return [...default_w];
  }
};

export const clipParameters = (
  parameters: number[],
  numRelearningSteps: number,
  enableShortTerm: boolean = default_enable_short_term,
) => {
  let w17_w18_ceiling = W17_W18_Ceiling;
  if (Math.max(0, numRelearningSteps) > 1) {
    // PLS = w11 * D ^ -w12 * [(S + 1) ^ w13 - 1] * e ^ (w14 * (1 - R))
    // PLS * e ^ (num_relearning_steps * w17 * w18) should be <= S
    // Given D = 1, R = 0.7, S = 1, PLS is equal to w11 * (2 ^ w13 - 1) * e ^ (w14 * 0.3)
    // So num_relearning_steps * w17 * w18 + ln(w11) + ln(2 ^ w13 - 1) + w14 * 0.3 should be <= ln(1)
    // => num_relearning_steps * w17 * w18 <= - ln(w11) - ln(2 ^ w13 - 1) - w14 * 0.3
    // => w17 * w18 <= -[ln(w11) + ln(2 ^ w13 - 1) + w14 * 0.3] / num_relearning_steps
    const value =
      -(
        Math.log(parameters[11]) +
        Math.log(Math.pow(2.0, parameters[13]) - 1.0) +
        parameters[14] * 0.3
      ) / numRelearningSteps;

    w17_w18_ceiling = clamp(+value.toFixed(8), 0.01, 2.0);
  }
  const clip = CLAMP_PARAMETERS(w17_w18_ceiling, enableShortTerm).slice(
    0,
    parameters.length,
  );
  return clip.map(([min, max], index) =>
    clamp(parameters[index] || 0, min, max),
  );
};

export const generatorParameters = (
  props?: Partial<FSRSParameters>,
): FSRSParameters => {
  const learning_steps = Array.isArray(props?.learning_steps)
    ? props!.learning_steps
    : default_learning_steps;
  const relearning_steps = Array.isArray(props?.relearning_steps)
    ? props!.relearning_steps
    : default_relearning_steps;
  const enable_short_term =
    props?.enable_short_term ?? default_enable_short_term;
  const w = migrateParameters(
    props?.w,
    relearning_steps.length,
    enable_short_term,
  );

  return {
    request_retention: props?.request_retention || default_request_retention,
    maximum_interval: props?.maximum_interval || default_maximum_interval,
    w: w,
    enable_fuzz: props?.enable_fuzz ?? default_enable_fuzz,
    enable_short_term: enable_short_term,
    learning_steps: learning_steps,
    relearning_steps: relearning_steps,
  } satisfies FSRSParameters;
};

/**
 * Create an empty card
 * @param now Current time
 * @param afterHandler Convert the result to another type. (Optional)
 * @example
 * ```typescript
 * const card: Card = createEmptyCard(new Date());
 * ```
 */
export function createEmptyCard<R = Card>(
  now?: DateInput,
  afterHandler?: (card: Card) => R,
): R {
  const emptyCard: Card = {
    due: now ? TypeConvert.time(now) : new Date(),
    stability: 0,
    difficulty: 0,
    scheduled_days: 0,
    reps: 0,
    lapses: 0,
    learning_steps: 0,
    state: State.New,
    last_review: undefined,
  };
  if (afterHandler && typeof afterHandler === "function") {
    return afterHandler(emptyCard);
  } else {
    return emptyCard as R;
  }
}