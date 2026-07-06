import { describe, expect, it } from "vitest";
import type { InstitutionAnalyticsDTO, InstitutionSummaryDTO } from "@/lib/api-client";
import { buildInstitutionCsv } from "./csv";

const institution: InstitutionSummaryDTO = {
  id: 1,
  ipedsUnitId: 100,
  name: "Example, University of",
  city: "Springfield",
  state: "IL",
  sector: "public",
  institutionType: "four_year",
  websiteUrl: null,
};

function analyticsWith(
  stickerSeries: { year: number; value: number }[],
  netSeries: { year: number; value: number }[],
): InstitutionAnalyticsDTO {
  return {
    institutionId: 1,
    residency: "in_state",
    latestYear: 2024,
    scalars: {
      latestSticker: null,
      latestNet: null,
      discountRate: null,
      cagr5yr: null,
      cagr10yr: null,
      yoyRate: null,
      projectionYear: null,
      projectionValue: null,
    },
    metrics: {
      latestSticker: { status: "insufficient_data", reason: "n/a" },
      latestNet: { status: "insufficient_data", reason: "n/a" },
      discount: { status: "insufficient_data", reason: "n/a" },
      cagr5yr: { status: "insufficient_data", reason: "n/a" },
      cagr10yr: { status: "insufficient_data", reason: "n/a" },
      yoy: { status: "insufficient_data", reason: "n/a" },
      projection: { status: "insufficient_data", reason: "n/a" },
      stickerSeries,
      netSeries,
    },
    computedAt: "2026-07-05T00:00:00.000Z",
  };
}

describe("buildInstitutionCsv", () => {
  it("emits a metadata header and a merged Year/Sticker/Net table", () => {
    const csv = buildInstitutionCsv(
      institution,
      analyticsWith(
        [
          { year: 2023, value: 10_000 },
          { year: 2024, value: 10_500 },
        ],
        [
          { year: 2023, value: 6_000 },
          { year: 2024, value: 6_200 },
        ],
      ),
      "in_state",
    );
    expect(csv).toContain("# TuitionTruth export — Example, University of");
    expect(csv).toContain("# Residency: In-state");
    expect(csv).toContain("year,sticker_price,net_price");
    expect(csv).toContain("2023,10000.00,6000.00");
    expect(csv).toContain("2024,10500.00,6200.00");
    expect(csv.endsWith("\n")).toBe(true);
  });

  it("leaves empty cells for years missing from one series (sparse data)", () => {
    const csv = buildInstitutionCsv(
      institution,
      analyticsWith([{ year: 2022, value: 9_000 }], [{ year: 2024, value: 6_200 }]),
      "out_of_state",
    );
    const lines = csv.trim().split("\n");
    // Union of years {2022, 2024}; each has a gap in the other series.
    expect(lines).toContain("2022,9000.00,");
    expect(lines).toContain("2024,,6200.00");
    expect(csv).toContain("# Residency: Out-of-state");
  });

  it("produces a valid (header-only body) CSV for an institution with no series", () => {
    const csv = buildInstitutionCsv(institution, analyticsWith([], []), "in_state");
    const lines = csv.trim().split("\n");
    // Last line is the column header; no data rows follow.
    expect(lines.at(-1)).toBe("year,sticker_price,net_price");
  });
});
