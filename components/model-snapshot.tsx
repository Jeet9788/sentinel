import { ArrowRight } from "lucide-react";
import Link from "next/link";

/**
 * The model's presence on the operations dashboard: the headline metric, and
 * the two thresholds the current policy runs on. Everything else lives on the
 * Model page — this is the "what is deciding all of this" card.
 */
export function ModelSnapshot({
  prAuc,
  rocAuc,
  tLow,
  tHigh,
}: {
  prAuc: number;
  rocAuc: number;
  tLow: number;
  tHigh: number;
}) {
  return (
    <section className="panel panel-interactive p-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold" style={{ fontFamily: "var(--font-heading)" }}>
            Model v1
          </h2>
          <p className="text-xs text-muted-foreground">XGBoost · served as ONNX</p>
        </div>
        <Link
          href="/model"
          className="inline-flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
        >
          Tune <ArrowRight className="h-3 w-3" aria-hidden />
        </Link>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-3">
        <div>
          <p className="eyebrow">PR-AUC</p>
          <p
            className="mt-1 text-2xl font-semibold tabular"
            style={{ fontFamily: "var(--font-heading)" }}
          >
            {prAuc.toFixed(3)}
          </p>
        </div>
        <div>
          <p className="eyebrow">ROC-AUC</p>
          <p
            className="mt-1 text-2xl font-semibold tabular"
            style={{ fontFamily: "var(--font-heading)" }}
          >
            {rocAuc.toFixed(3)}
          </p>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-1.5 text-[11px]">
        <span className="rounded-full border border-foreground/10 bg-foreground/[0.05] px-2 py-0.5 tabular">
          approve <span style={{ color: "var(--approved)" }}>&lt; {tLow}</span>
        </span>
        <span className="rounded-full border border-foreground/10 bg-foreground/[0.05] px-2 py-0.5 tabular">
          block <span style={{ color: "var(--blocked)" }}>≥ {tHigh}</span>
        </span>
        <span className="rounded-full border border-foreground/10 bg-foreground/[0.05] px-2 py-0.5 text-muted-foreground">
          between → human
        </span>
      </div>
    </section>
  );
}
