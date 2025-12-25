/**
 * $$\text{decay} = -w_{20}$$
 *
 * $$\text{factor} = e^{\frac{\ln 0.9}{\text{decay}}} - 1$$
 */
export const computeDecayFactor = (
  decayOrParams: number | number[] | readonly number[],
) => {
  const decay =
    typeof decayOrParams === "number" ? -decayOrParams : -decayOrParams[20];
  const factor = Math.exp(Math.pow(decay, -1) * Math.log(0.9)) - 1.0;
  return { decay, factor: +factor.toFixed(8) };
};

/**
 * The formula used is :
 * $$R(t,S) = (1 + \text{FACTOR} \times \frac{t}{9 \cdot S})^{\text{DECAY}}$$
 * @param {number} decay - The decay factor, decay should be greater than or equal to 0.1 and less than or equal to 0.8.
 * @param {number} elapsed_days t days since the last review
 * @param {number} stability Stability (interval when R=90%)
 * @return {number} r Retrievability (probability of recall)
 */
export function forgetting_curve(
  decay: number,
  elapsed_days: number,
  stability: number,
): number;
export function forgetting_curve(
  parameters: number[] | readonly number[],
  elapsed_days: number,
  stability: number,
): number;
export function forgetting_curve(
  decayOrParams: number | number[] | readonly number[],
  elapsed_days: number,
  stability: number,
): number {
  const { decay, factor } = computeDecayFactor(decayOrParams);
  return +Math.pow(1 + (factor * elapsed_days) / stability, decay).toFixed(8);
}