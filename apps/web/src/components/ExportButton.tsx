"use client";

import { Button } from "@tuitiontruth/ui";
import type { InstitutionAnalyticsDTO, InstitutionSummaryDTO, Residency } from "@/lib/api-client";
import { buildInstitutionCsv } from "@/lib/csv";

export interface ExportButtonProps {
  readonly institution: InstitutionSummaryDTO;
  readonly analytics: InstitutionAnalyticsDTO;
  readonly residency: Residency;
}

/**
 * Client-side CSV export (TUIT-33). The CSV is built by a pure, tested function;
 * this component only handles the browser download plumbing (Blob + object URL).
 */
export function ExportButton({ institution, analytics, residency }: ExportButtonProps) {
  function download(): void {
    const csv = buildInstitutionCsv(institution, analytics, residency);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${institution.name.replace(/[^a-z0-9]+/gi, "_")}_${residency}.csv`;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);
  }

  return (
    <Button
      variant="secondary"
      onClick={download}
      aria-label={`Export ${institution.name} tuition data as CSV`}
    >
      Export CSV
    </Button>
  );
}
