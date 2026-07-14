import type { Decision } from "@/lib/decision";

const money = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const compactMoney = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  notation: "compact",
  maximumFractionDigits: 1,
});

export function fmtMoney(cents: number): string {
  return money.format(cents / 100);
}

export function fmtMoneyCompact(cents: number): string {
  return compactMoney.format(cents / 100);
}

/** Four decimals: at 0.17% base rate, the difference between 0.01 and 0.001 is the whole job. */
export function fmtScore(score: number | null): string {
  return score === null ? "—" : score.toFixed(4);
}

export function fmtPercent(fraction: number, digits = 1): string {
  return `${(fraction * 100).toFixed(digits)}%`;
}

export function timeAgo(iso: string): string {
  const seconds = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (seconds < 10) return "just now";
  if (seconds < 60) return `${Math.floor(seconds)}s ago`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86_400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86_400)}d ago`;
}

export const DECISION_COLOR: Record<Decision, string> = {
  approved: "var(--approved)",
  review: "var(--review)",
  blocked: "var(--blocked)",
};

export const DECISION_LABEL: Record<Decision, string> = {
  approved: "Approved",
  review: "Review",
  blocked: "Blocked",
};
