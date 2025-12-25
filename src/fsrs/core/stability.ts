import { clamp } from "../help";
import { S_MIN } from "../constant";
import { type Grade } from "../models";
import { Rating } from "../models";

/**
 * The formula used is :
 * $$ S_0(G) = w_{G-1}$$
 * $$S_0 = \max \lbrace S_0,0.1\rbrace $$

 * @param g Grade (rating at Anki) [1.again,2.hard,3.good,4.easy]
 * @return Stability (interval when R=90%)
 */
export const init_stability = (params: number[], g: Grade): number => {
  return Math.max(params[g - 1], 0.1);
};

/**
 * The formula used is :
 * $$S^\prime_r(D,S,R,G) = S\cdot(e^{w_8}\cdot (11-D)\cdot S^{-w_9}\cdot(e^{w_{10}\cdot(1-R)}-1)\cdot w_{15}(\text{if} G=2) \cdot w_{16}(\text{if} G=4)+1)$$
 * @param {number} params - Parameter array
 * @param {number} d Difficulty D \in [1,10]
 * @param {number} s Stability (interval when R=90%)
 * @param {number} r Retrievability (probability of recall)
 * @param {Grade} g Grade (Rating[0.again,1.hard,2.good,3.easy])
 * @return {number} S^\prime_r new stability after recall
 */
export const next_recall_stability = (
  params: number[],
  d: number,
  s: number,
  r: number,
  g: Grade,
): number => {
  const hard_penalty = Rating.Hard === g ? params[15] : 1;
  const easy_bound = Rating.Easy === g ? params[16] : 1;
  return +clamp(
    s *
      (1 +
        Math.exp(params[8]) *
          (11 - d) *
          Math.pow(s, -params[9]) *
          (Math.exp((1 - r) * params[10]) - 1) *
          hard_penalty *
          easy_bound),
    S_MIN,
    36500.0,
  ).toFixed(8);
};

/**
 * The formula used is :
 * $$S^\prime_f(D,S,R) = w_{11}\cdot D^{-w_{12}}\cdot ((S+1)^{w_{13}}-1) \cdot e^{w_{14}\cdot(1-R)}$$
 * enable_short_term = true : $$S^\prime_f \in \min \lbrace \max \lbrace S^\prime_f,0.01\rbrace, \frac{S}{e^{w_{17} \cdot w_{18}}} \rbrace$$
 * enable_short_term = false : $$S^\prime_f \in \min \lbrace \max \lbrace S^\prime_f,0.01\rbrace, S \rbrace$$
 * @param {number} params - Parameter array
 * @param {number} d Difficulty D \in [1,10]
 * @param {number} s Stability (interval when R=90%)
 * @param {number} r Retrievability (probability of recall)
 * @param {boolean} enable_short_term - Whether short-term memory is enabled
 * @return {number} S^\prime_f new stability after forgetting
 */
export const next_forget_stability = (
  params: number[],
  d: number,
  s: number,
  r: number,
  enable_short_term: boolean = false,
): number => {
  const s_new = params[11] *
    Math.pow(d, -params[12]) *
    (Math.pow(s + 1, params[13]) - 1) *
    Math.exp((1 - r) * params[14]);

  if (!enable_short_term) {
    return +clamp(s_new, S_MIN, s).toFixed(8);
  }

  const s_min = s / Math.exp(params[17] * params[18]);
  return +clamp(s_new, S_MIN, s_min).toFixed(8);
};

/**
 * The formula used is :
 * $$S^\prime_s(S,G) = S \cdot e^{w_{17} \cdot (G-3+w_{18})}$$
 * @param {number} params - Parameter array
 * @param {number} s Stability (interval when R=90%)
 * @param {Grade} g Grade (Rating[0.again,1.hard,2.good,3.easy])
 */
export const next_short_term_stability = (
  params: number[],
  s: number,
  g: Grade,
): number => {
  const sinc =
    Math.pow(s, -params[19]) *
    Math.exp(params[17] * (g - 3 + params[18]));

  const maskedSinc = g >= Rating.Hard ? Math.max(sinc, 1.0) : sinc;
  return +clamp(s * maskedSinc, S_MIN, 36500.0).toFixed(8);
};