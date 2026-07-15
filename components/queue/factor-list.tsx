import { ArrowDown, ArrowUp } from "lucide-react";

import type { TopFactor } from "@/lib/db/schema";

/**
 * Why the model scored this transaction the way it did.
 *
 * Each row answers one question: what would the score have been if this feature
 * had been unremarkable? The gap is the feature's impact. Bars are scaled to the
 * largest impact in the set, so the first row is always full-width and the rest
 * are read relative to it — an analyst needs the ranking, not the absolute
 * probability delta.
 */
export function FactorList({ factors }: { factors: TopFactor[] | null }) {
  if (!factors || factors.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No explanation available — this transaction was routed to review because the model could
        not be reached, so there is no score to explain.
      </p>
    );
  }

  const largest = Math.max(...factors.map((factor) => Math.abs(factor.impact)), 0.0001);

  return (
    <ul className="space-y-2.5">
      {factors.map((factor) => {
        const magnitude = Math.abs(factor.impact) / largest;
        const raisedRisk = factor.direction === "up";
        const color = raisedRisk ? "var(--blocked)" : "var(--approved)";

        return (
          <li key={factor.feature}>
            <div className="flex items-baseline justify-between gap-3 text-sm">
              <span className="flex items-center gap-1.5">
                {raisedRisk ? (
                  <ArrowUp className="h-3.5 w-3.5 shrink-0" style={{ color }} />
                ) : (
                  <ArrowDown className="h-3.5 w-3.5 shrink-0" style={{ color }} />
                )}
                <span>{factor.label}</span>
              </span>
              <span className="tabular text-xs" style={{ color }}>
                {factor.impact > 0 ? "+" : ""}
                {factor.impact.toFixed(3)}
              </span>
            </div>
            <div className="mt-1 h-1 w-full overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full"
                style={{ width: `${Math.max(2, magnitude * 100)}%`, backgroundColor: color }}
              />
            </div>
          </li>
        );
      })}
    </ul>
  );
}
