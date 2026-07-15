export type ThresholdRow = {
  threshold: number;
  precision: number;
  recall: number;
  flaggedRate: number;
  tp: number;
  fp: number;
  fn: number;
  tn: number;
};

export type ThresholdPreview = {
  pctApproved: number;
  pctReview: number;
  pctBlocked: number;
  /** Precision of the auto-block band — how often an auto-block is right. */
  estPrecision: number;
  /** Recall across review+block — the share of fraud that reaches a human or better. */
  estRecall: number;
};

function nearest(table: ThresholdRow[], threshold: number): ThresholdRow {
  return table.reduce((best, row) =>
    Math.abs(row.threshold - threshold) < Math.abs(best.threshold - threshold) ? row : best,
  );
}

/**
 * Projects what a pair of thresholds would do, using the model's holdout
 * threshold table rather than the live feed.
 *
 * This is a deliberate choice. The live stream is salted with injected fraud for
 * the demo, so its score distribution is not representative — reading "% blocked"
 * off it would flatter the numbers. The holdout table was measured once, on real
 * out-of-sample data, and is the honest answer to "if these were your thresholds,
 * here is what would happen."
 *
 * - approve / review / block percentages come from how much traffic falls in
 *   each band (via each threshold's flagged rate).
 * - estPrecision is the precision of the block band (at tHigh): of the
 *   transactions we would auto-block, how many are really fraud.
 * - estRecall is the recall at tLow: of all fraud, how much we catch rather than
 *   silently approve.
 */
export function previewThresholds(
  table: ThresholdRow[],
  tLow: number,
  tHigh: number,
): ThresholdPreview {
  const low = nearest(table, tLow);
  const high = nearest(table, tHigh);

  const pctBlocked = high.flaggedRate;
  const pctReview = Math.max(0, low.flaggedRate - high.flaggedRate);
  const pctApproved = Math.max(0, 1 - low.flaggedRate);

  return {
    pctApproved,
    pctReview,
    pctBlocked,
    estPrecision: high.precision,
    estRecall: low.recall,
  };
}
