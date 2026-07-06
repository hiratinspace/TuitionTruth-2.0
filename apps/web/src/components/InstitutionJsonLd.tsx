import type { InstitutionSummaryDTO } from "@/lib/api-client";

/**
 * schema.org structured data for an institution profile — the rich-result hook
 * that powers the freemium SEO funnel (Phase 5). Emitted as JSON-LD; the `<`
 * escape prevents a `</script>` in any field from breaking out of the tag.
 */
export function InstitutionJsonLd({
  institution,
  netPrice,
}: {
  institution: InstitutionSummaryDTO;
  netPrice: number | null;
}) {
  const data: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "CollegeOrUniversity",
    name: institution.name,
    address: {
      "@type": "PostalAddress",
      ...(institution.city !== null ? { addressLocality: institution.city } : {}),
      addressRegion: institution.state,
      addressCountry: "US",
    },
    ...(institution.websiteUrl !== null ? { url: institution.websiteUrl } : {}),
  };
  if (netPrice !== null) {
    data.description = `Estimated net price after average institutional aid: $${netPrice.toLocaleString("en-US")} — an informational estimate compiled from public data.`;
  }

  const json = JSON.stringify(data).replace(/</g, "\\u003c");
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: json }} />;
}
