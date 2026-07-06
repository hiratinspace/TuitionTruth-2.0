import type { InstitutionAnalyticsDTO, InstitutionSummaryDTO, Residency } from "@/lib/api-client";

/** Escape a CSV field per RFC 4180 (quote when it contains `," `, or newline). */
function escapeField(value: string): string {
  if (/[",\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function row(cells: readonly string[]): string {
  return cells.map(escapeField).join(",");
}

/**
 * Build an export CSV for one institution's series (TUIT-33). Leads with a
 * commented metadata block (institution, residency, computed-at, disclaimer) so
 * the file is self-describing, then a Year/Sticker/Net table over the *union*
 * of years present in either series — a year missing from one series yields an
 * empty cell, never a fabricated 0, so sparse-data institutions export cleanly.
 */
export function buildInstitutionCsv(
  institution: InstitutionSummaryDTO,
  analytics: InstitutionAnalyticsDTO,
  residency: Residency,
): string {
  const stickerByYear = new Map(analytics.metrics.stickerSeries.map((p) => [p.year, p.value]));
  const netByYear = new Map(analytics.metrics.netSeries.map((p) => [p.year, p.value]));
  const years = [...new Set([...stickerByYear.keys(), ...netByYear.keys()])].sort((a, b) => a - b);

  const residencyLabel = residency === "in_state" ? "In-state" : "Out-of-state";
  const lines: string[] = [
    `# TuitionTruth export — ${institution.name}`,
    `# Location: ${[institution.city, institution.state].filter(Boolean).join(", ")}`,
    `# Residency: ${residencyLabel}`,
    `# Computed at: ${analytics.computedAt}`,
    `# Amounts in USD. Informational estimates, not official pricing — confirm with the institution.`,
    row(["year", "sticker_price", "net_price"]),
  ];

  for (const year of years) {
    const sticker = stickerByYear.get(year);
    const net = netByYear.get(year);
    lines.push(
      row([
        String(year),
        sticker === undefined ? "" : sticker.toFixed(2),
        net === undefined ? "" : net.toFixed(2),
      ]),
    );
  }

  return `${lines.join("\n")}\n`;
}
