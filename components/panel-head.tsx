import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

/**
 * The anatomy every dashboard panel opens with: a tinted icon tile that names
 * the panel's domain color, the title pair, and a right-hand meta slot for
 * chips and controls. One shape, so the console reads as designed rather than
 * assembled.
 */
export function PanelHead({
  icon: Icon,
  color = "var(--series)",
  title,
  description,
  meta,
}: {
  icon: LucideIcon;
  color?: string;
  title: string;
  description?: string;
  meta?: ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div className="flex items-start gap-2.5">
        <span
          className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border"
          style={{
            color,
            backgroundColor: `color-mix(in srgb, ${color} 12%, transparent)`,
            borderColor: `color-mix(in srgb, ${color} 28%, transparent)`,
          }}
          aria-hidden
        >
          <Icon className="h-3.5 w-3.5" />
        </span>
        <div className="min-w-0">
          <h2 className="text-sm font-semibold" style={{ fontFamily: "var(--font-heading)" }}>
            {title}
          </h2>
          {description && <p className="text-xs text-muted-foreground">{description}</p>}
        </div>
      </div>
      {meta && <div className="flex shrink-0 items-center gap-2">{meta}</div>}
    </div>
  );
}

/** Small mono chip for panel meta: ranges, scales, counts. */
export function MetaChip({ children, color }: { children: ReactNode; color?: string }) {
  return (
    <span
      className="eyebrow rounded-full border border-foreground/10 bg-foreground/[0.05] px-2 py-1"
      style={color ? { color } : undefined}
    >
      {children}
    </span>
  );
}

/** Inline legend chip: a color dot and its label, for chart headers. */
export function LegendChip({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground">
      <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: color }} aria-hidden />
      {label}
    </span>
  );
}
