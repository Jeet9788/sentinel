import { AlertTriangle } from "lucide-react";

import type { Decision } from "@/lib/decision";
import { DECISION_COLOR, DECISION_LABEL } from "@/lib/format";
import { cn } from "@/lib/utils";

/**
 * Decision colors are never the only carrier of meaning — every badge shows the
 * word too, so the state survives colorblindness, a bad monitor, and a printout.
 */
export function DecisionBadge({
  decision,
  scoringError = false,
  className,
}: {
  decision: Decision;
  scoringError?: boolean;
  className?: string;
}) {
  const color = DECISION_COLOR[decision];

  return (
    <span className={cn("inline-flex items-center gap-1.5", className)}>
      <span
        className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-medium tracking-wide uppercase"
        style={{
          color,
          backgroundColor: `color-mix(in srgb, ${color} 14%, transparent)`,
          boxShadow: `inset 0 0 0 1px color-mix(in srgb, ${color} 35%, transparent)`,
        }}
      >
        <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: color }} />
        {DECISION_LABEL[decision]}
      </span>

      {scoringError && (
        <span
          title="Scored by policy fallback: the model was unreachable, so this went to a human."
          className="inline-flex items-center gap-1 rounded-full bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground"
        >
          <AlertTriangle className="h-3 w-3" />
          no score
        </span>
      )}
    </span>
  );
}
