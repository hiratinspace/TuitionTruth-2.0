import Link from "next/link";
import { Card } from "@tuitiontruth/ui";

/**
 * Custom 404 — reached via `notFound()` (e.g. an unknown institution id) or any
 * unmatched route. Routes the user back into the directory rather than a dead end.
 */
export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-content flex-col items-center justify-center px-6 py-10">
      <Card className="max-w-md text-center">
        <p className="font-data text-sm uppercase tracking-widest text-primary">404</p>
        <h1 className="mt-2 font-display text-2xl font-semibold text-ink">Page not found</h1>
        <p className="mt-3 font-body text-sm leading-relaxed text-ink/70">
          We couldn&rsquo;t find that institution or page. It may have moved, or the link may be
          incomplete.
        </p>
        <Link
          href="/search"
          className="mt-6 inline-flex items-center gap-2 rounded-[var(--radius)] bg-primary px-5 py-2.5 font-body text-sm font-medium text-on-primary transition-colors duration-[var(--duration-micro)] ease-standard hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-paper"
        >
          Search institutions →
        </Link>
      </Card>
    </main>
  );
}
