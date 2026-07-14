import { describe, expect, it, vi } from "vitest";

import { fmtMoney, fmtPercent, fmtScore, timeAgo } from "@/lib/format";

describe("fmtMoney", () => {
  it("formats integer cents as currency without floating-point drift", () => {
    expect(fmtMoney(150_493)).toBe("$1,504.93");
    expect(fmtMoney(1)).toBe("$0.01");
    expect(fmtMoney(0)).toBe("$0.00");
  });
});

describe("fmtScore", () => {
  it("keeps four decimals, because at a 0.17% base rate the tail is the signal", () => {
    expect(fmtScore(0.99985)).toBe("0.9999");
    expect(fmtScore(0.0001)).toBe("0.0001");
  });

  it("renders an unscored transaction as an em dash rather than a misleading zero", () => {
    expect(fmtScore(null)).toBe("—");
  });
});

describe("fmtPercent", () => {
  it("formats fractions", () => {
    expect(fmtPercent(0.8019)).toBe("80.2%");
    expect(fmtPercent(0.0017, 2)).toBe("0.17%");
  });
});

describe("timeAgo", () => {
  it("describes recent times in units a person reads at a glance", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-13T12:00:00Z"));

    expect(timeAgo("2026-07-13T11:59:57Z")).toBe("just now");
    expect(timeAgo("2026-07-13T11:59:30Z")).toBe("30s ago");
    expect(timeAgo("2026-07-13T11:45:00Z")).toBe("15m ago");
    expect(timeAgo("2026-07-13T09:00:00Z")).toBe("3h ago");
    expect(timeAgo("2026-07-11T12:00:00Z")).toBe("2d ago");

    vi.useRealTimers();
  });
});
