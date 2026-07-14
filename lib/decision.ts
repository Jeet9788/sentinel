export type Decision = "approved" | "review" | "blocked";

export type Thresholds = {
  /** Below this, approve without a human. */
  tLow: number;
  /** At or above this, block without a human. */
  tHigh: number;
};

/**
 * The entire policy of the system, in one function.
 *
 * A fraud model does not make decisions; it produces a probability. Turning that
 * probability into an action is a business choice about the relative cost of two
 * errors: letting fraud through, versus declining a real customer. The two
 * thresholds are where that choice is expressed, which is why they are tunable
 * at runtime rather than baked into the model.
 *
 * The review band is [tLow, tHigh): everything the model is not confident enough
 * to settle alone goes to a human.
 */
export function decide(score: number, { tLow, tHigh }: Thresholds): Decision {
  if (!(tLow >= 0 && tHigh <= 1 && tLow < tHigh)) {
    throw new RangeError(`invalid thresholds: expected 0 <= tLow < tHigh <= 1, got ${tLow}/${tHigh}`);
  }
  if (!(score >= 0 && score <= 1)) {
    throw new RangeError(`invalid score: expected 0 <= score <= 1, got ${score}`);
  }

  if (score < tLow) return "approved";
  if (score < tHigh) return "review";
  return "blocked";
}
