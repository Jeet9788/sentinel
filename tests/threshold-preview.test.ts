import { describe, expect, it } from "vitest";

import { previewThresholds, type ThresholdRow } from "@/lib/threshold-preview";

// A tiny synthetic holdout table: as the threshold rises, fewer transactions are
// flagged, precision climbs, recall falls — the real shape, in miniature.
const table: ThresholdRow[] = [
  { threshold: 0.0, precision: 0.1, recall: 1.0, flaggedRate: 1.0, tp: 10, fp: 90, fn: 0, tn: 0 },
  { threshold: 0.2, precision: 0.5, recall: 0.9, flaggedRate: 0.2, tp: 9, fp: 9, fn: 1, tn: 81 },
  { threshold: 0.5, precision: 0.8, recall: 0.7, flaggedRate: 0.1, tp: 7, fp: 2, fn: 3, tn: 88 },
  { threshold: 0.9, precision: 0.95, recall: 0.5, flaggedRate: 0.05, tp: 5, fp: 0, fn: 5, tn: 90 },
];

describe("previewThresholds", () => {
  it("splits traffic into three bands that sum to one", () => {
    const p = previewThresholds(table, 0.2, 0.9);
    expect(p.pctApproved + p.pctReview + p.pctBlocked).toBeCloseTo(1, 5);
  });

  it("reads the bands off the flagged rates at each threshold", () => {
    const p = previewThresholds(table, 0.2, 0.9);
    expect(p.pctBlocked).toBeCloseTo(0.05); // flaggedRate at tHigh=0.9
    expect(p.pctReview).toBeCloseTo(0.15); // 0.2 - 0.05
    expect(p.pctApproved).toBeCloseTo(0.8); // 1 - 0.2
  });

  it("reports block precision at tHigh and catch recall at tLow", () => {
    const p = previewThresholds(table, 0.2, 0.9);
    expect(p.estPrecision).toBeCloseTo(0.95); // precision at tHigh
    expect(p.estRecall).toBeCloseTo(0.9); // recall at tLow
  });

  it("snaps to the nearest measured threshold rather than interpolating noise", () => {
    // 0.52 and 0.88 are closest to the 0.5 and 0.9 rows.
    const p = previewThresholds(table, 0.52, 0.88);
    expect(p.estRecall).toBeCloseTo(0.7); // recall at the 0.5 row
    expect(p.estPrecision).toBeCloseTo(0.95); // precision at the 0.9 row
  });

  it("moving tHigh up trades block coverage for block precision", () => {
    const loose = previewThresholds(table, 0.2, 0.5);
    const strict = previewThresholds(table, 0.2, 0.9);
    expect(strict.estPrecision).toBeGreaterThan(loose.estPrecision);
    expect(strict.pctBlocked).toBeLessThan(loose.pctBlocked);
  });

  it("never returns a negative band, even if thresholds are close", () => {
    const p = previewThresholds(table, 0.2, 0.2);
    expect(p.pctReview).toBeGreaterThanOrEqual(0);
  });
});
