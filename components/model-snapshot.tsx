import { ArrowRight, Cpu } from "lucide-react";
import Link from "next/link";

import { PanelHead } from "@/components/panel-head";

const RADIUS = 26;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

/**
 * The model's presence on the operations dashboard: PR-AUC as a ring gauge —
 * the number an interviewer should ask about — plus ROC-AUC and the two policy
 * thresholds the console currently runs on.
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
  const dashOffset = CIRCUMFERENCE * (1 - prAuc);

  return (
    <section className="panel panel-interactive p-4">
      <PanelHead
        icon={Cpu}
        title="Model v1"
        description="XGBoost · served as ONNX"
        meta={
          <Link
            href="/model"
            className="inline-flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
          >
            Tune <ArrowRight className="h-3 w-3" aria-hidden />
          </Link>
        }
      />

      <div className="mt-4 flex items-center gap-4">
        {/* PR-AUC ring: the primary metric drawn as how much of the circle it fills. */}
        <div
          className="relative shrink-0"
          style={{ filter: "drop-shadow(0 0 6px rgba(76, 141, 246, 0.35))" }}
        >
          <svg width="72" height="72" viewBox="0 0 72 72" role="img" aria-label={`PR-AUC ${prAuc}`}>
            <circle
              cx="36"
              cy="36"
              r={RADIUS}
              fill="none"
              stroke="rgba(230,234,242,0.08)"
              strokeWidth="5"
            />
            <circle
              cx="36"
              cy="36"
              r={RADIUS}
              fill="none"
              stroke="var(--series)"
              strokeWidth="5"
              strokeLinecap="round"
              strokeDasharray={CIRCUMFERENCE}
              strokeDashoffset={dashOffset}
              transform="rotate(-90 36 36)"
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span
              className="text-sm font-semibold tabular leading-none"
              style={{ fontFamily: "var(--font-heading)" }}
            >
              {prAuc.toFixed(3)}
            </span>
            <span className="eyebrow mt-0.5 text-[8px]">PR-AUC</span>
          </div>
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-baseline justify-between gap-2">
            <span className="eyebrow">ROC-AUC</span>
            <span
              className="text-lg font-semibold tabular"
              style={{ fontFamily: "var(--font-heading)" }}
            >
              {rocAuc.toFixed(3)}
            </span>
          </div>
          <div className="mt-2 space-y-1 border-t border-border pt-2 text-[11px] tabular">
            <p className="flex justify-between gap-2">
              <span className="text-muted-foreground">approve below</span>
              <span style={{ color: "var(--approved)" }}>{tLow}</span>
            </p>
            <p className="flex justify-between gap-2">
              <span className="text-muted-foreground">block at</span>
              <span style={{ color: "var(--blocked)" }}>≥ {tHigh}</span>
            </p>
            <p className="flex justify-between gap-2">
              <span className="text-muted-foreground">between</span>
              <span>→ human</span>
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
