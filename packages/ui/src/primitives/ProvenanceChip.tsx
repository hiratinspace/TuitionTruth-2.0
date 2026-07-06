import type { Provenance } from "../types";
import { cn } from "./cn";

export interface ProvenanceChipProps {
  readonly provenance: Provenance;
  readonly className?: string;
}

/**
 * The signature element (§3.1, TUIT-35). Every displayed number can carry one:
 * a ledger-style citation "as of Mar 2026 · IPEDS" that expands to the full
 * source URL, extraction timestamp, and confidence.
 *
 * Built on native `<details>` so disclosure works on click, tap, and keyboard
 * with zero JS — a deliberate accessibility upgrade over a hover-only tooltip,
 * which is invisible to touch and keyboard users.
 */
export function ProvenanceChip({ provenance, className }: ProvenanceChipProps) {
  const { asOf, source, sourceUrl, extractedAt, confidence } = provenance;
  return (
    <details className={cn("group relative inline-block", className)}>
      <summary
        className={cn(
          "inline-flex cursor-pointer list-none items-center gap-1.5 rounded-full bg-muted px-3 py-1",
          "font-data text-xs text-ink/70 outline-none",
          "focus-visible:ring-2 focus-visible:ring-[var(--color-ring)] focus-visible:ring-offset-1",
          "[&::-webkit-details-marker]:hidden",
        )}
      >
        <span aria-hidden="true">ⓘ</span>
        <span>
          as of {asOf} · {source}
        </span>
      </summary>
      <div
        className={cn(
          "absolute left-0 top-[calc(100%+6px)] z-10 w-64 rounded-[var(--radius)] border border-border bg-paper p-3 shadow-md",
        )}
        role="group"
        aria-label="Data provenance"
      >
        <dl className="space-y-1.5 font-data text-xs text-ink/80">
          <Row label="As of">{asOf}</Row>
          <Row label="Source">{source}</Row>
          {extractedAt !== undefined && <Row label="Extracted">{extractedAt}</Row>}
          {confidence !== undefined && (
            <Row label="Confidence">{`${String(Math.round(confidence * 100))}%`}</Row>
          )}
        </dl>
        {sourceUrl !== undefined && (
          <a
            href={sourceUrl}
            target="_blank"
            rel="noreferrer noopener"
            className="mt-2 inline-block break-all font-data text-xs text-primary underline underline-offset-2"
          >
            View source
          </a>
        )}
      </div>
    </details>
  );
}

function Row({ label, children }: { readonly label: string; readonly children: string }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="text-ink/50">{label}</dt>
      <dd className="text-right">{children}</dd>
    </div>
  );
}
