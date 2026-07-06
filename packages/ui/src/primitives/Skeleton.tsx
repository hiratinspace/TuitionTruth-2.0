import { cn } from "./cn";

export interface SkeletonProps {
  readonly className?: string;
  /** Accessible label announced while content loads. */
  readonly label?: string;
}

/**
 * A shimmering placeholder on the muted base. Skeletons mirror the real layout
 * exactly (§3.3) — callers size them to the element they stand in for — so
 * hydration causes no layout shift. `animate-pulse` collapses to static under
 * prefers-reduced-motion via the global rule.
 */
export function Skeleton({ className, label = "Loading" }: SkeletonProps) {
  return (
    <span
      role="status"
      aria-label={label}
      aria-busy="true"
      className={cn("block animate-pulse rounded-[var(--radius)] bg-muted", className)}
    />
  );
}
