# Scoping Analysis: Real-Time Tuition Intelligence Platform

*Prepared as a Senior Product Manager / EdTech Systems Architect scoping document*

Here's a full architectural and product breakdown, structured around five pillars. Each section is split into **Immediate Priorities** (what you need to ship a defensible v1) and **Future Scale Considerations** (what you'll need once you have traction).

---

## 1. MVP Scope & Features

The core value prop is simple: **"What will this degree actually cost me, and how fast is that number rising?"** Everything in v1 should serve that question.

### Immediate Priorities
- **Single-institution profile page** as the atomic unit — not a full comparison engine yet. Get one page right before building 6,000 of them well.
- **Core dashboard metrics (the "Big 5")**:
  - Current **sticker price** (in-state vs. out-of-state, tuition-only vs. tuition+fees+room/board)
  - **5-year and 10-year CAGR** (compound annual growth rate) of tuition
  - **Net price estimate** (sticker minus average institutional aid — critical, since sticker price is often fiction)
  - **YoY % change** with a simple up/down trend arrow
  - **Projected cost in N years** (basic linear/CAGR extrapolation, clearly labeled as an estimate)
- **Search + filter**: state, public/private, 2-year/4-year — nothing fancier.
- **Historical trend chart**: a single clean line chart (10–15 years) is more valuable at launch than a dozen half-built visualizations.
- **Data freshness indicator**: every number needs a visible "as of [date], source: [IPEDS/Scorecard]" tag. This is a trust product — hide nothing about provenance.

**Dashboard layout recommendation**: Lead with the net price and trend line above the fold (that's the "aha" moment), sticker price and fee breakdown below it, comparison/export tools in a secondary tab.

### Future Scale Considerations
- Side-by-side multi-school comparison tool (3–5 schools)
- Personalized "your estimated cost" calculator (factoring in family income bracket, state residency, major)
- Alerts/notifications when a tracked school announces a tuition change
- Mobile app with push notifications for tuition-decision season (Feb–May)

---

## 2. Data Sourcing & Infrastructure

This is the hardest and most legally sensitive part of the build. Tuition data has three structural problems: **fragmentation** (no single canonical source updates in real time), **opacity** (sticker price ≠ what anyone pays), and **lag** (federal data is often 1–2 years stale by the time it's usable).

### Immediate Priorities — Primary (government) sources
- **College Scorecard API** (api.data.gov/ed/collegescorecard): This is your backbone. It's a free, authenticated REST API covering costs, completion, and institutional data, queryable by fields like `tuition.in_state` and `completion.rate`, with wildcard field support for pulling nested cost objects at once. Note the constraint: the default rate limit is **1,000 requests per IP per hour**, so build a caching layer, not a live pass-through.
- **IPEDS (NCES)**: No direct public REST API, but it's the authoritative source Scorecard itself is partly derived from. IPEDS is a system of 12 interrelated annual survey components collected every fall, winter, and spring, covering finance and enrollment data — you'll want to ingest their downloadable data files directly (not just via Scorecard) for finance-specific fields like net tuition revenue per FTE.
- **Urban Institute Education Data Portal API**: A well-built wrapper that unifies IPEDS, College Scorecard, Common Core of Data, and Census data into a single JSON API — worth using as a secondary/cross-validation source rather than your sole pipeline, since it's a third-party layer on top of the same underlying government data.
- **Ingestion cadence**: Set expectations correctly with users — this is **not** real-time data by nature. College Scorecard's institution-level data currently covers 1996-97 through 2025-26, but IPEDS releases are provisional and staggered (the most recent 2026 release was still provisional Fall 2024 enrollment and FY2024 finance data). Your "real-time" differentiator has to come from *scraping current sticker prices off admissions/bursar pages*, not from federal data, which lags by 1–2 academic years.

### Immediate Priorities — Scraping layer (for current-year pricing)
- Target **bursar/financial aid office pages** specifically, not general admissions pages — they're more structured and change less often in markup.
- Build **per-institution scraper configs**, not a generic crawler — tuition pages have zero standardization across ~6,000 institutions. Start with your top 200–500 schools by search volume, expand from there.
- Use **change-detection diffing** (hash the extracted numeric fields) to flag updates for human QA rather than trusting fully automated extraction — tuition tables are a high-stakes-for-errors data type.
- Normalize into a canonical schema early: `{institution_id, academic_year, residency_status, tuition, mandatory_fees, room_board, effective_date, source_url, confidence_score}`.

### Future Scale Considerations
- Crowdsourced/verified user submissions (with moderation) to fill scraper gaps and catch fee changes faster than official channels
- Direct data-sharing partnerships with institutions or SIS/ERP vendors (Ellucian, Workday Student) — the gold-standard long-term source
- International tuition tracking (would require entirely separate per-country data infrastructure)
- ML-based extraction (vision/LLM-based table parsing) to replace brittle CSS-selector scrapers as you scale past a few hundred institutions

---

## 3. Analytical Framework

### Immediate Priorities
- **Historical CAGR as the core growth metric** — straightforward, explainable, defensible: `CAGR = (End Value/Start Value)^(1/years) - 1`. Avoid fancier models until you've validated the basics with users.
- **Segment your inflation baselines** — a single "average tuition inflation" number is nearly meaningless. Minimum required segmentation:
  - Public vs. private
  - In-state vs. out-of-state
  - 2-year vs. 4-year
  - Region/state (state legislatures directly control public tuition caps — huge variance driver)
- **Simple linear/CAGR-based projection** for the "cost in N years" feature, with an explicit confidence caveat in the UI. Do not present projections with false precision (e.g., "$47,382 in 2030" — round and hedge).
- **Data modeling constraints to design around from day one**:
  - **Sticker price ≠ net price** — CAGR on sticker price can show 5% growth while net price (after aid) is flat or declining. You must model both series independently.
  - **Fee reclassification risk** — schools sometimes shift costs between "tuition" and "fees" line items to manage optics; your normalization layer needs to track *total mandatory cost*, not just the "tuition" label, or your trend lines will show artificial volatility.
  - **Academic year vs. fiscal year mismatches** across your data sources.
  - **Missing-year gaps** — not every institution reports every field every year; your CAGR calculation needs graceful handling of nulls (don't silently interpolate without flagging it).

### Future Scale Considerations
- Multi-factor projection models incorporating regional CPI, state education budget trends, and enrollment pressure as leading indicators
- Cohort-based "what similar students actually paid" modeling using aid-distribution data, not just published rates
- Anomaly detection to auto-flag scraped data that deviates implausibly from historical trend (catches both scraper bugs and genuine one-off tuition freezes/spikes)

---

## 4. Monetization & Target Audience

### Immediate Priorities — Buyer segmentation

| Segment | Need | Willingness to Pay |
|---|---|---|
| **Parents/students (B2C)** | Planning & comparison tool | Low direct WTP, high volume — best as freemium funnel |
| **High school counselors** | Bulk comparison for advisees | Moderate — B2B/B2B2C SaaS seat licenses |
| **Fintech/529 plan providers, student loan platforms** | API-embedded cost data | High — this is your real revenue engine |
| **Higher-ed consultants/advisors** | White-labeled reporting | Moderate, sticky |

- **Recommended v1 monetization**: **Freemium B2C + API-first B2B**. Free tier covers single-school lookups and basic trend charts (drives traffic, SEO, and word of mouth); paid tier unlocks comparisons, projections, and export; the real margin comes from a **metered API** sold to fintechs and edtech platforms who don't want to build this data pipeline themselves.
- **Counselor/school-district licensing** is a strong early B2B wedge — school counseling offices already buy comparable tools (Naviance, Scoir) and have budget line items for exactly this.

### Future Scale Considerations
- White-label embeddable widgets for 529 plan providers and student loan comparison sites (revenue share or flat licensing)
- Enterprise data licensing to research institutions, think tanks, and journalists
- Premium "advisor" tier with scenario-planning tools (aid negotiation modeling, multi-year cash-flow planning)

---

## 5. Risk & Compliance

This is where the deep scoping matters most — data products in education finance carry real liability exposure.

### Immediate Priorities
- **Scraping legality**: Institutional websites are generally public-facing and not behind authentication, which is the strongest legal footing for scraping (post-*hiQ v. LinkedIn* case law leans toward permitting scraping of public data), but:
  - Always check and respect `robots.txt` and Terms of Service per institution — some explicitly prohibit automated collection.
  - Rate-limit your crawlers aggressively; aggressive scraping that resembles a DoS attack is a separate legal exposure (CFAA-adjacent) regardless of copyright/ToS questions.
  - Prefer official APIs/data downloads wherever they exist (as above) — reduces legal surface area substantially versus scraping.
- **Data accuracy liability**: This is a "financial decision support" product — treat it like one.
  - Every number needs a clear **"informational estimate, not official pricing — confirm with the institution"** disclaimer, prominently placed, not buried in a footer.
  - Maintain an audit trail (source URL + timestamp) for every data point so you can defend or correct any disputed figure.
  - Do not present projections as guarantees; label all forward-looking figures as estimates with methodology disclosed.
- **Privacy**: Since your MVP tracks **institutional** data (tuition rates), not individual student records, you largely avoid **FERPA** exposure at launch. This changes the moment you add personalized calculators that store user financial/family data — at that point you're collecting PII and should design consent flows, data retention limits, and (if any users are minors, which is likely given the high-school-counselor audience) COPPA-adjacent care from day one.
- **Trademark/branding**: Displaying institution names, logos, and seals requires care — nominative fair use for factual reference (e.g., "Stanford University's tuition is...") is generally fine; using their logos/branding in your UI without permission is not.

### Future Scale Considerations
- Formal data-sharing agreements with institutions to move off scraping entirely for partnered schools (reduces both legal risk and improves data freshness simultaneously)
- SOC 2 compliance once you're selling API access to fintech/enterprise B2B customers — they'll require it in procurement
- Legal review cadence tied to any expansion into international institutions (wildly different data protection regimes — GDPR if EU schools are added)
- Insurance (E&O / tech liability) once the product influences material financial decisions at scale

---

## Bottom Line on Sequencing

Ship v1 on Scorecard/IPEDS data only (fast, free, legally clean) with a small, hand-curated scraper layer for your top 100–200 "high search intent" schools to get current-year pricing. Prove the CAGR/net-price framework resonates with users before investing in the harder scraping infrastructure or the API monetization layer — the data engineering here is the long pole, not the frontend.
