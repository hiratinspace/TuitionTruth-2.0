import type { Metadata } from "next";
import Link from "next/link";
import { Card } from "@tuitiontruth/ui";
import {
  searchInstitutions,
  type InstitutionSearchQuery,
  type InstitutionSummaryDTO,
} from "@/lib/api-client";
import { SearchForm } from "@/components/SearchForm";

export const runtime = "nodejs";

export const metadata: Metadata = {
  title: "Search institutions — TuitionTruth",
  description:
    "Find a college and see its real tuition, net price after aid, and cost-growth rate.",
};

type Search = Promise<Record<string, string | string[] | undefined>>;

function first(value: string | string[] | undefined): string {
  if (Array.isArray(value)) {
    return value[0] ?? "";
  }
  return value ?? "";
}

const SECTOR: Record<string, string> = { public: "Public", private: "Private" };
const TYPE: Record<string, string> = { two_year: "2-year", four_year: "4-year" };

function subtitle(institution: InstitutionSummaryDTO): string {
  const kind = `${SECTOR[institution.sector] ?? institution.sector} ${TYPE[institution.institutionType] ?? institution.institutionType}`;
  const place = [institution.city, institution.state].filter(Boolean).join(", ");
  return place.length > 0 ? `${kind} · ${place}` : kind;
}

export default async function SearchPage({ searchParams }: { searchParams: Search }) {
  const params = await searchParams;
  const q = first(params.q);
  const state = first(params.state);
  const sector = first(params.sector);
  const type = first(params.type);

  const hasCriteria = q.length > 0 || state.length > 0 || sector.length > 0 || type.length > 0;

  const query: InstitutionSearchQuery = {
    ...(q.length > 0 ? { q } : {}),
    ...(state.length > 0 ? { state } : {}),
    ...(sector === "public" || sector === "private" ? { sector } : {}),
    ...(type === "two_year" || type === "four_year" ? { institutionType: type } : {}),
  };
  const result = hasCriteria ? await searchInstitutions(query) : null;

  return (
    <main id="main-content" tabIndex={-1} className="mx-auto max-w-content px-6 py-10 md:px-10">
      <h1 className="font-display text-3xl font-semibold text-ink md:text-4xl">
        Find an institution
      </h1>
      <p className="mt-1 font-body text-sm text-ink/70">
        Search by name, then narrow by state, sector, or level.
      </p>

      <div className="mt-6">
        <SearchForm initial={{ q, state, sector, type }} />
      </div>

      <section className="mt-8">
        {result === null && (
          <p className="font-body text-ink/60">Enter a search above to see institutions.</p>
        )}

        {result !== null && !result.ok && (
          <Card>
            <p className="font-body text-destructive">
              Search is temporarily unavailable ({result.error.code}). Please try again.
            </p>
          </Card>
        )}

        {result !== null && result.ok && result.data.results.length === 0 && (
          <p className="font-body text-ink/60">No institutions match those criteria.</p>
        )}

        {result !== null && result.ok && result.data.results.length > 0 && (
          <ul className="grid gap-3 md:grid-cols-2">
            {result.data.results.map((institution) => (
              <li key={institution.id}>
                <Link
                  href={`/institution/${String(institution.id)}`}
                  className="block rounded-[var(--radius)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ring)]"
                >
                  <Card interactive>
                    <div className="font-display text-lg font-semibold text-ink">
                      {institution.name}
                    </div>
                    <div className="mt-1 font-body text-sm text-ink/60">
                      {subtitle(institution)}
                    </div>
                  </Card>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
