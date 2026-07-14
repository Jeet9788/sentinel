import { describe, expect, it } from "vitest";

import { decide } from "@/lib/decision";

const thresholds = { tLow: 0.2, tHigh: 0.8 };

describe("decide", () => {
  it("auto-approves scores below the low threshold", () => {
    expect(decide(0, thresholds)).toBe("approved");
    expect(decide(0.19, thresholds)).toBe("approved");
  });

  it("sends the uncertain middle to a human", () => {
    expect(decide(0.5, thresholds)).toBe("review");
  });

  it("auto-blocks scores at or above the high threshold", () => {
    expect(decide(0.95, thresholds)).toBe("blocked");
    expect(decide(1, thresholds)).toBe("blocked");
  });

  // The boundaries are where money is won and lost, so they are pinned down:
  // the review band is [tLow, tHigh) — inclusive at the bottom, exclusive at the top.
  it("treats tLow as the first reviewable score", () => {
    expect(decide(0.2, thresholds)).toBe("review");
  });

  it("treats tHigh as the first blockable score", () => {
    expect(decide(0.8, thresholds)).toBe("blocked");
  });

  it("rejects nonsensical thresholds rather than guessing", () => {
    expect(() => decide(0.5, { tLow: 0.8, tHigh: 0.2 })).toThrow(RangeError);
    expect(() => decide(0.5, { tLow: 0.5, tHigh: 0.5 })).toThrow(RangeError);
    expect(() => decide(0.5, { tLow: -0.1, tHigh: 0.9 })).toThrow(RangeError);
    expect(() => decide(0.5, { tLow: 0.1, tHigh: 1.5 })).toThrow(RangeError);
  });

  it("rejects scores outside [0, 1]", () => {
    expect(() => decide(1.2, thresholds)).toThrow(RangeError);
    expect(() => decide(-0.01, thresholds)).toThrow(RangeError);
    expect(() => decide(Number.NaN, thresholds)).toThrow(RangeError);
  });
});
