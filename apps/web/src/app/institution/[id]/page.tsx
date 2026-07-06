import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  Card,
  ProvenanceChip,
  TrendChart,
  formatCurrency,
  type TrendSeries,
} from "@tuitiontruth/ui";
import {
  getInstitution,
  getInstitutionAnalytics,
  type InstitutionAnalyticsDTO,
  type InstitutionSummaryDTO,
  type Residency,
} from "@/lib/api-client";
import { BigFive } from "@/components/BigFive";
import { Disclaimer } from "@/components/Disclaimer";
import { ExportButton } from "@/components/ExportButton";
import { MetricNumber } from "@/components/MetricNumber";
import { ResidencyToggle } from "@/components/ResidencyToggle";

export const runtime = "nodejs";

type Params = Promise<{ id: string }>;
type Search = Promise<Record<string, string | string[] | undefined>>;

function parseId(id: string): number | null {
  const value = Number(id);
  return Number.isInteger(value) && value > 0 ? value : null;
}

function parseResidency(raw: string | string[] | undefined): Residency {
  return raw === "out_of_state" ? "out_of_state" : "in_state";
}

const SECTOR: Record<string, string> = { public: "Public", private: "Private" };
const TYPE: Record<string, string> = { two_year: "2-year", four_year: "4-year" };

function subtitle(institution: InstitutionSummaryDTO): string {
  const kind = `${SECTOR[institution.sector] ?? institution.sector} ${TYPE[institution.institutionType] ?? institution.institutionType}`;
  const place = [institution.city, institution.state].filter(Boolean).join(", ");
  return place.length > 0 ? `${kind} · ${place}` : kind;
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { id } = await params;
  const institutionId = parseId(id);
  if (institutionId === null) {
    return { title: "Institution — TuitionTruth" };
  }
  const result = await getInstitution(institutionId);
  if (!result.ok) {
    return { title: "Institution — TuitionTruth" };
  }
  const institution = result.data;
  const place = [institution.city, institution.state].filter(Boolean).join(", ");
  return {
    title: `${institution.name} — tuition & net price | TuitionTruth`,
    description: `Tuition, net price after aid, and cost-growth trend for ${institution.name}${place ? ` (${place})` : ""}. Every figure sourced and dated.`,
  };
}

/** Build the chart series from the stored histories, sticker + net. */
function toTrendSeries(analytics: InstitutionAnalyticsDTO): TrendSeries[] {
  const series: TrendSeries[] = [];
  if (analytics.metrics.stickerSeries.length > 0) {
    series.push({
      id: "sticker",
      label: "Sticker price",
      variant: "sticker",
      points: analytics.metrics.stickerSeries,
    });
  }
  if (analytics.metrics.netSeries.length > 0) {
    series.push({
      id: "net",
      label: "Net price after aid",
      variant: "net",
      points: analytics.metrics.netSeries,
    });
  }
  return series;
}

export default async function InstitutionPage({
  params,
  searchParams,
}: {
  params: Params;
  searchParams: Search;
}) {
  const { id } = await params;
  const institutionId = parseId(id);
  if (institutionId === null) {
    notFound();
  }
  const residency = parseResidency((await searchParams).residency);

  const [institutionResult, analyticsResult] = await Promise.all([
    getInstitution(institutionId),
    getInstitutionAnalytics(institutionId, residency),
  ]);

  if (!institutionResult.ok) {
    if (institutionResult.error.isNotFound) {
      notFound();
    }
    throw new Error(institutionResult.error.message);
  }
  const institution = institutionResult.data;
  const analytics = analyticsResult.ok ? analyticsResult.data : null;

  return (
    <main className="mx-auto max-w-content px-6 py-10 md:px-10">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-semibold text-ink md:text-4xl">
            {institution.name}
          </h1>
          <p className="mt-1 font-body text-sm text-ink/70">{subtitle(institution)}</p>
        </div>
        <div className="flex items-center gap-3">
          {analytics !== null && (
            <ProvenanceChip
              provenance={{
                asOf: new Date(analytics.computedAt).toLocaleDateString("en-US", {
                  month: "short",
                  year: "numeric",
                }),
                source: "IPEDS + Scorecard",
                extractedAt: analytics.computedAt,
              }}
            />
          )}
          <ResidencyToggle current={residency} />
        </div>
      </div>

      {analytics === null ? (
        <Card className="mt-8">
          <p className="font-body text-ink/70">
            Analytics for this institution haven&rsquo;t been computed yet. They appear as soon as
            the next ingestion run completes.
          </p>
        </Card>
      ) : (
        <>
          {/* Headline + trend */}
          <section className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
            <Card>
              <div className="font-data text-xs uppercase tracking-wider text-ink/50">
                Net price (est.)
              </div>
              {/* Plex Mono tabular at 56px: guarantees zero layout shift on the
                  residency toggle (a hard Phase 4 exit criterion) over the serif
                  treatment in the blueprint. */}
              <div className="mt-2 font-data text-[56px] font-medium leading-none tabular-nums text-ink">
                <MetricNumber
                  metric={analytics.metrics.latestNet}
                  render={(value) => formatCurrency(value)}
                />
              </div>
              <div className="mt-2 font-body text-sm text-ink/60">
                after average institutional aid
              </div>
              <div className="mt-6">
                <ExportButton
                  institution={institution}
                  analytics={analytics}
                  residency={residency}
                />
              </div>
            </Card>

            <Card>
              <div className="mb-3 flex items-center justify-between">
                <span className="font-data text-xs uppercase tracking-wider text-ink/50">
                  Historical trend
                </span>
                <span className="flex items-center gap-4 font-data text-xs text-ink/60">
                  <span className="inline-flex items-center gap-1.5">
                    <span aria-hidden className="inline-block h-0.5 w-4 bg-ink" /> Sticker
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <span
                      aria-hidden
                      className="inline-block h-0.5 w-4 border-t-2 border-dashed border-primary"
                    />{" "}
                    Net
                  </span>
                </span>
              </div>
              <TrendChart
                series={toTrendSeries(analytics)}
                ariaLabel={`Tuition and net-price trend for ${institution.name}`}
              />
            </Card>
          </section>

          {/* Big 5 */}
          <section className="mt-6">
            <BigFive metrics={analytics.metrics} />
          </section>
        </>
      )}

      <footer className="mt-10 border-t border-border pt-6">
        <Disclaimer />
      </footer>
    </main>
  );
}
