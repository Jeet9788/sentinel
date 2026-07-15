import type { ThresholdRow } from "@/lib/threshold-preview";

/**
 * The confusion matrix at a chosen threshold, drawn from the holdout counts.
 *
 * "Caught" means score >= the threshold. The two cells that matter most are the
 * off-diagonal ones: false negatives are fraud that slipped through, false
 * positives are real customers who got stopped. Everything about tuning the
 * thresholds is a negotiation between those two numbers.
 */
export function ConfusionMatrix({ row }: { row: ThresholdRow }) {
  const cells = [
    { label: "Caught fraud", value: row.tp, kind: "good" as const, hint: "true positive" },
    { label: "False alarm", value: row.fp, kind: "warn" as const, hint: "false positive" },
    { label: "Missed fraud", value: row.fn, kind: "bad" as const, hint: "false negative" },
    { label: "Cleared", value: row.tn, kind: "muted" as const, hint: "true negative" },
  ];

  const color = {
    good: "var(--approved)",
    warn: "var(--review)",
    bad: "var(--blocked)",
    muted: "var(--muted-foreground)",
  };

  return (
    <div>
      <div className="grid grid-cols-2 gap-2">
        {cells.map((cell) => (
          <div key={cell.label} className="rounded-md border border-border bg-background p-3">
            <p className="text-[11px] uppercase tracking-wider text-muted-foreground">{cell.label}</p>
            <p
              className="mt-1 text-2xl font-semibold tabular"
              style={{ fontFamily: "var(--font-heading)", color: color[cell.kind] }}
            >
              {cell.value.toLocaleString()}
            </p>
            <p className="text-[10px] text-muted-foreground">{cell.hint}</p>
          </div>
        ))}
      </div>
      <p className="mt-2 text-[11px] text-muted-foreground">
        On the {(row.tp + row.fp + row.fn + row.tn).toLocaleString()}-transaction holdout, at score
        ≥ {row.threshold.toFixed(2)}.
      </p>
    </div>
  );
}
