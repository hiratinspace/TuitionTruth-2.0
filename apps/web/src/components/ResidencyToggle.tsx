"use client";

import type { Route } from "next";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { cn } from "@tuitiontruth/ui";
import type { Residency } from "@/lib/api-client";

const OPTIONS: readonly { readonly value: Residency; readonly label: string }[] = [
  { value: "in_state", label: "In-state" },
  { value: "out_of_state", label: "Out-of-state" },
];

/**
 * Residency switch. State lives entirely in the URL (`?residency=`) so links are
 * shareable and the toggle survives refresh (TUIT-31 AC #5). Navigation re-runs
 * the server component with the new residency; the tabular-figure layout means
 * the swapped numbers cause zero reflow.
 */
export function ResidencyToggle({ current }: { readonly current: Residency }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function select(next: Residency): void {
    const params = new URLSearchParams(searchParams.toString());
    params.set("residency", next);
    router.push(`${pathname}?${params.toString()}` as Route);
  }

  return (
    <div
      role="group"
      aria-label="Residency"
      className="inline-flex rounded-[var(--radius)] border border-border bg-paper p-0.5"
    >
      {OPTIONS.map((option) => {
        const active = option.value === current;
        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={active}
            onClick={() => {
              select(option.value);
            }}
            className={cn(
              "rounded-[calc(var(--radius)-2px)] px-3 py-1 font-body text-sm transition-colors duration-[var(--duration-micro)] ease-standard",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ring)]",
              active ? "bg-primary text-on-primary" : "text-ink/70 hover:bg-muted",
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
