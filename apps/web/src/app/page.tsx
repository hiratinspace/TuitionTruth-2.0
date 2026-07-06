import Link from "next/link";

/**
 * Landing surface. Real, shippable content — no lorem, no fake institution
 * figures — built entirely from the design tokens so the identity ("The Modern
 * Registrar's Ledger") is proven end-to-end. The single illustrative number is
 * explicitly labelled as an example; the CTA routes into the live directory.
 */
export default function HomePage() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-content flex-col justify-between px-6 py-10 md:px-10">
      <header className="flex items-center justify-between">
        <span className="font-display text-lg font-semibold text-ink">TuitionTruth</span>
        <nav className="flex items-center gap-4">
          <Link
            href="/search"
            className="font-body text-sm text-ink/70 underline-offset-4 hover:text-ink hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ring)]"
          >
            Search institutions
          </Link>
          <span className="rounded-full border border-border px-3 py-1 font-data text-xs text-primary">
            v2 · in development
          </span>
        </nav>
      </header>

      <section className="grid gap-12 py-16 md:grid-cols-[1.4fr_1fr] md:items-center">
        <div>
          <p className="font-data text-sm uppercase tracking-widest text-primary">
            College cost, told straight
          </p>
          <h1 className="mt-4 font-display text-4xl font-semibold leading-tight text-ink md:text-6xl">
            What will this degree actually cost — and how fast is that number rising?
          </h1>
          <p className="mt-6 max-w-prose text-lg leading-relaxed text-ink/80">
            Sticker price is often fiction. TuitionTruth tracks tuition, mandatory fees, and net
            price after aid across thousands of institutions — then shows the growth rate behind the
            headline. Every figure carries its source and its date. Nothing is hidden about where a
            number came from.
          </p>
          <div className="mt-8">
            <Link
              href="/search"
              className="inline-flex items-center gap-2 rounded-[var(--radius)] bg-primary px-5 py-2.5 font-body text-sm font-medium text-on-primary transition-colors duration-[var(--duration-micro)] ease-standard hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-paper"
            >
              Search institutions →
            </Link>
          </div>
        </div>

        {/* Signature element: the Provenance Chip. Illustrative example only. */}
        <figure className="rounded-[var(--radius)] border border-border bg-paper p-6 shadow-sm">
          <figcaption className="font-data text-xs uppercase tracking-wider text-ink/50">
            Net price (example)
          </figcaption>
          <div className="mt-2 font-data text-5xl font-medium tabular-nums text-ink">$18,279</div>
          <div className="mt-1 text-sm text-ink/60">after average institutional aid</div>
          <div className="mt-5 inline-flex items-center gap-2 rounded-full bg-muted px-3 py-1 font-data text-xs text-ink/70">
            <span aria-hidden="true" className="inline-block h-1.5 w-1.5 rounded-full bg-falling" />
            as of Mar 2026 · IPEDS + verified
          </div>
        </figure>
      </section>

      <footer className="border-t border-border pt-6 text-sm text-ink/60">
        <p>
          Informational estimates, not official pricing — always confirm with the institution.
          Foundation live: monorepo, strict typing, and reversible migrations in place.
        </p>
      </footer>
    </main>
  );
}
