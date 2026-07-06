/**
 * Persistent informational disclaimer (TUIT-35 / scoping legal checklist). Must
 * remain visible on every data-bearing surface — these are estimates, not
 * official pricing, and institution names are used nominatively.
 */
export function Disclaimer() {
  return (
    <p className="font-body text-xs leading-relaxed text-ink/60">
      Figures are informational estimates compiled from public sources (IPEDS, the U.S. Department
      of Education College Scorecard, and published institutional pricing) — not official quotes.
      Net price reflects average institutional aid and will differ from any individual&rsquo;s cost.
      Always confirm current pricing directly with the institution. Institution names are used for
      identification only.
    </p>
  );
}
