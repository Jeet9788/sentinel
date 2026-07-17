import type { ReactNode } from "react";

/**
 * The header every console page opens with: a mono eyebrow that names the
 * section (the same monospace as the data, so the signposting matches the
 * content), a Space Grotesk title, and a one-line description. Consistent across
 * pages so the product reads as one tool.
 */
export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow: string;
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div className="min-w-0">
        <p className="eyebrow mb-2">{eyebrow}</p>
        <h1
          className="text-3xl font-bold tracking-[-0.02em]"
          style={{ fontFamily: "var(--font-heading)" }}
        >
          {title}
        </h1>
        {description && (
          <p className="mt-1.5 max-w-2xl text-sm text-muted-foreground">{description}</p>
        )}
      </div>
      {actions && <div className="shrink-0">{actions}</div>}
    </div>
  );
}
