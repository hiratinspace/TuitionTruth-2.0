# ADR 0003 — Trend Chart Rendering: Custom SVG (TUIT-34)

**Status:** Accepted (Phase 4)

## Context

TUIT-34 requires a documented chart-library choice, spiking visx and Recharts against a 15-year dataset. The trend chart has three unusual requirements the plan calls out explicitly:

1. **Honest gap rendering** — a missing year must render as a visibly dashed "no data" segment, never a smooth interpolation (§3.2 AC #4).
2. **Dual sticker/net encoding** distinguished by hue **and** dash pattern (never hue alone, for colorblind safety).
3. **Exact design-token theming** in both light and dark, with the app's single motion rhythm.

The dataset is tiny — at most ~15 points per series, two series.

## Decision

**Render the chart as bespoke SVG** (`packages/ui/src/chart`), splitting the geometry (pure, 100%-testable functions) from a thin presentational component.

### Spike findings

| Option         | Bundle            | Gap control                                                                                           | Token theming                                                                               | Verdict                                                             |
| -------------- | ----------------- | ----------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| **Recharts**   | ~95 kB gz         | Awkward — needs `connectNulls={false}` plus manual segment overlays to style a gap differently        | Via props, not CSS vars; dark mode needs a parallel theme object                            | Rejected                                                            |
| **visx**       | ~30 kB (composed) | Full control, but we'd be hand-writing `<path>`/scales anyway on top of `@visx/scale` + `@visx/shape` | Good                                                                                        | Rejected — the library earns little once we compute paths ourselves |
| **Custom SVG** | 0 kB added        | Total — gap segments are just `strokeDasharray` on tagged edges                                       | Native: every stroke/fill is a `var(--color-*)`, so light/dark and reduced-motion come free | **Chosen**                                                          |

### Why custom wins here

- At ≤15 points a charting engine's scale/animation machinery is pure overhead; the geometry is a dozen lines of pure math (`scalePoints`, `buildLineSegments`, `axisTicks`) that we unit-test to the branch.
- Gap-as-dashed-segment — the product's honesty signature in chart form — is a first-class output of `buildLineSegments` (each edge is tagged `solid` or `gap`), not a fight against a library's "connect the dots" default.
- Zero added JS keeps the profile page's First Load JS ~102 kB and the chart server-renderable (RSC), with a visually-hidden `<table>` mirror for screen readers and SEO.

## Consequences

- We own axis/tick rendering (already implemented and tested). If future charts need richer interaction (brush/zoom, dense scatter, thousands of points), revisit visx — this ADR is scoped to the ≤15-point trend line.
- Hover-tooltip interactivity (cursor-following readout, §3.3) layers on top as a client enhancement over the same geometry; the static SVG remains the accessible, crawlable baseline.
