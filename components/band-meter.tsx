import { decide } from "@/lib/decision";
import { DECISION_COLOR, DECISION_LABEL, fmtScore } from "@/lib/format";
import { cn } from "@/lib/utils";

type Props = {
  score: number | null;
  tLow: number;
  tHigh: number;
  /** Compact mode drops the labels — for use inside a table row. */
  compact?: boolean;
  className?: string;
};

/**
 * The signature device of the console: a score is never shown as a bare number,
 * always against the policy it was judged by.
 *
 * The bar is the [0,1] probability range, tinted by what the system does in each
 * band — approve, ask a human, block — with a tick where this transaction landed.
 * An analyst can see at a glance not just how risky a transaction is, but how
 * close it came to being handled differently. The same device backs the score
 * histogram and the threshold tuner, so "score versus policy" reads the same way
 * everywhere in the product.
 */
export function BandMeter({ score, tLow, tHigh, compact = false, className }: Props) {
  const decision = score === null ? null : decide(score, { tLow, tHigh });
  const position = score === null ? null : Math.min(100, Math.max(0, score * 100));

  return (
    <div className={cn("w-full", className)}>
      <div
        className="relative h-2 w-full overflow-hidden rounded-full"
        role="img"
        aria-label={
          score === null
            ? "No score: transaction routed to review"
            : `Score ${fmtScore(score)} of 1. Policy: approve below ${tLow}, block at or above ${tHigh}. Decision: ${DECISION_LABEL[decide(score, { tLow, tHigh })]}.`
        }
      >
        <div
          className="absolute inset-y-0 left-0"
          style={{ width: `${tLow * 100}%`, backgroundColor: "var(--approved)", opacity: 0.28 }}
        />
        <div
          className="absolute inset-y-0"
          style={{
            left: `${tLow * 100}%`,
            width: `${(tHigh - tLow) * 100}%`,
            backgroundColor: "var(--review)",
            opacity: 0.28,
          }}
        />
        <div
          className="absolute inset-y-0 right-0"
          style={{ width: `${(1 - tHigh) * 100}%`, backgroundColor: "var(--blocked)", opacity: 0.28 }}
        />

        {position !== null && decision !== null && (
          <div
            className="absolute -top-0.5 h-3 w-[3px] rounded-full ring-2"
            style={{
              left: `calc(${position}% - 1.5px)`,
              backgroundColor: DECISION_COLOR[decision],
              // A 2px surface ring keeps the tick legible where it overlaps a band.
              ["--tw-ring-color" as string]: "var(--card)",
            }}
          />
        )}
      </div>

      {!compact && (
        <div className="mt-1.5 flex justify-between text-[10px] text-muted-foreground tabular">
          <span>0</span>
          <span>approve &lt; {tLow}</span>
          <span>block ≥ {tHigh}</span>
          <span>1</span>
        </div>
      )}
    </div>
  );
}
