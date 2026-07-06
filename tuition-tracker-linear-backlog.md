# Linear Ticket Backlog: College Tuition Tracking Platform

**Prepared by:** Agile Technical PM / Product Owner
**Scope:** Core Data Infrastructure → Data Ingestion → Analytical Engine → Frontend Dashboard
**Ticket Prefix:** `TUIT-`

All dependency and blocker relationships below are explicit and bidirectionally consistent (if A depends on B, B lists A as a blocker) so they can be linked directly in Linear via "blocks / is blocked by" relations.

---

## Ticket Index (Quick Reference)

| ID | Title | Phase |
|---|---|---|
| TUIT-1 | Provision Relational Database Environment | 1 |
| TUIT-2 | Set Up Database Migration Tooling | 1 |
| TUIT-3 | Design Schema – Institutions Table | 1 |
| TUIT-4 | Design Schema – Historical Tuition Rates Table | 1 |
| TUIT-5 | Design Schema – Fees & Cost Breakdown Table | 1 |
| TUIT-6 | Design Schema – Financial Aid & Net Price Table | 1 |
| TUIT-7 | Implement Data Versioning & Audit Trail Schema | 1 |
| TUIT-8 | Define Indexing & Query Performance Strategy | 1 |
| TUIT-9 | Implement Data Validation Constraints & Referential Integrity | 1 |
| TUIT-10 | Build College Scorecard API Client | 2 |
| TUIT-11 | Build IPEDS Bulk Data Import Connector | 2 |
| TUIT-12 | Implement API Rate-Limiting & Caching Layer | 2 |
| TUIT-13 | Build Generic Web Scraper Framework | 2 |
| TUIT-14 | Build Per-Institution Scraper Configuration System | 2 |
| TUIT-15 | Implement Scrapers for Top 100 Priority Institutions (Batch 1) | 2 |
| TUIT-16 | Build ETL Normalization Pipeline (Canonical Schema Mapping) | 2 |
| TUIT-17 | Implement Change-Detection & Diffing Engine | 2 |
| TUIT-18 | Build Manual QA Review Queue for Flagged Data Changes | 2 |
| TUIT-19 | Set Up Pipeline Orchestration & Scheduling | 2 |
| TUIT-20 | Implement Pipeline Error Handling & Alerting | 2 |
| TUIT-21 | Build CAGR Calculation Service | 3 |
| TUIT-22 | Build Net Price vs. Sticker Price Calculation Module | 3 |
| TUIT-23 | Implement Data Segmentation Logic | 3 |
| TUIT-24 | Build YoY Change Calculation Service | 3 |
| TUIT-25 | Build Tuition Projection/Forecasting Engine | 3 |
| TUIT-26 | Implement Anomaly Detection for Ingested Data | 3 |
| TUIT-27 | Build Analytics REST API Endpoints | 3 |
| TUIT-28 | Implement Analytics Results Caching Layer | 3 |
| TUIT-29 | Set Up Design System & Component Library | 4 |
| TUIT-30 | Build Frontend API Integration Layer | 4 |
| TUIT-31 | Build Institution Search & Filter UI | 4 |
| TUIT-32 | Build Institution Profile Page Layout | 4 |
| TUIT-33 | Build Core Metrics Dashboard Cards ("Big 5") | 4 |
| TUIT-34 | Build Historical Trend Chart Component | 4 |
| TUIT-35 | Build Data Freshness & Source Attribution Indicator | 4 |
| TUIT-36 | Implement Responsive/Mobile Layout | 4 |
| TUIT-37 | Build CSV/Export Functionality | 4 |

---

## Phase 1: Core Data Infrastructure & Database Design

### TUIT-1: [Infra] Provision Relational Database Environment
**Epic/Module:** Data Infrastructure
**Description:** Stand up the production and staging relational database instances (PostgreSQL recommended) that will serve as the system of record for all institution, tuition, fee, and aid data.

**Acceptance Criteria:**
1. PostgreSQL instance provisioned in staging and production environments
2. Connection pooling (e.g., PgBouncer) configured
3. Automated daily backups enabled with 30-day retention
4. Environment-specific credentials stored in secrets manager (not in code/repo)
5. Basic uptime/health-check monitoring configured
6. Network access restricted to application VPC/service accounts only

**Dependencies:** None (foundational ticket)

**Blockers:** TUIT-2 (Set Up Database Migration Tooling), TUIT-3 (Design Schema – Institutions Table)

---

### TUIT-2: [Backend] Set Up Database Migration Tooling
**Epic/Module:** Data Infrastructure
**Description:** Implement a version-controlled schema migration framework (e.g., Alembic, Flyway, or Prisma Migrate) so all subsequent schema tickets ship as trackable, reversible migrations.

**Acceptance Criteria:**
1. Migration tool integrated into the backend repo and CI pipeline
2. `migrate up` / `migrate down` commands verified against staging DB
3. Migration history table confirmed and queryable
4. Documentation added to repo README for running migrations locally and in CI/CD
5. Rollback tested on a dummy migration with no data loss

**Dependencies:** TUIT-1 (Provision Relational Database Environment)

**Blockers:** TUIT-3 (Design Schema – Institutions Table)

---

### TUIT-3: [Backend] Design Schema – Institutions Table
**Epic/Module:** Data Infrastructure
**Description:** Design and migrate the core `institutions` table — the parent entity that all tuition, fee, and aid records will reference via foreign key.

**Acceptance Criteria:**
1. Schema includes: institution_id (PK), name, IPEDS unitid, OPEID, state, sector (public/private), institution_type (2yr/4yr), city, website_url, is_active
2. Unique constraint on IPEDS unitid to prevent duplicate institution records
3. Migration applied cleanly to staging with zero errors
4. Seed script created to bulk-load initial ~6,000 institution records from IPEDS directory data
5. Basic CRUD repository/service layer methods implemented and unit tested

**Dependencies:** TUIT-1 (Provision Relational Database Environment), TUIT-2 (Set Up Database Migration Tooling)

**Blockers:** TUIT-4 (Historical Tuition Rates Table), TUIT-5 (Fees & Cost Breakdown Table), TUIT-6 (Financial Aid & Net Price Table), TUIT-23 (Data Segmentation Logic)

---

### TUIT-4: [Backend] Design Schema – Historical Tuition Rates Table
**Epic/Module:** Data Infrastructure
**Description:** Design and migrate the `tuition_rates` table to store year-over-year tuition figures per institution, segmented by residency status.

**Acceptance Criteria:**
1. Schema includes: id (PK), institution_id (FK), academic_year, residency_status (in-state/out-of-state), tuition_amount, currency, effective_date, source_type (api/scrape/manual), source_url, confidence_score, created_at
2. Composite unique constraint on (institution_id, academic_year, residency_status) to prevent duplicate-year records
3. Foreign key constraint to `institutions` enforced with `ON DELETE RESTRICT`
4. Migration includes index on (institution_id, academic_year) for fast historical lookups
5. Unit tests confirm insert/query performance on a seeded dataset of 10,000+ rows

**Dependencies:** TUIT-3 (Design Schema – Institutions Table)

**Blockers:** TUIT-7 (Data Versioning & Audit Trail Schema), TUIT-8 (Indexing & Query Performance Strategy), TUIT-9 (Data Validation Constraints), TUIT-10 (College Scorecard API Client), TUIT-11 (IPEDS Bulk Data Import Connector), TUIT-13 (Generic Web Scraper Framework), TUIT-16 (ETL Normalization Pipeline)

---

### TUIT-5: [Backend] Design Schema – Fees & Cost Breakdown Table
**Epic/Module:** Data Infrastructure
**Description:** Design and migrate the `fees_breakdown` table to store mandatory fees, room & board, and other cost components separately from base tuition, enabling total-cost-of-attendance tracking independent of how institutions label line items.

**Acceptance Criteria:**
1. Schema includes: id (PK), institution_id (FK), academic_year, fee_type (mandatory_fee/room/board/books/other), amount, effective_date, source_url
2. Foreign key constraint to `institutions` enforced
3. Supports multiple fee_type rows per institution per year (one-to-many)
4. Migration includes a view or computed aggregate for "total_mandatory_cost" per institution/year
5. Data dictionary documented explaining fee_type taxonomy for future scraper/API mapping consistency

**Dependencies:** TUIT-3 (Design Schema – Institutions Table)

**Blockers:** TUIT-7 (Data Versioning & Audit Trail Schema), TUIT-8 (Indexing & Query Performance Strategy), TUIT-9 (Data Validation Constraints)

---

### TUIT-6: [Backend] Design Schema – Financial Aid & Net Price Table
**Epic/Module:** Data Infrastructure
**Description:** Design and migrate the `net_price_data` table to store average institutional aid and calculated net price figures, distinct from sticker price.

**Acceptance Criteria:**
1. Schema includes: id (PK), institution_id (FK), academic_year, income_bracket (nullable, for segmented net price), average_aid_amount, net_price_amount, data_source, effective_date
2. Foreign key constraint to `institutions` enforced
3. Nullable income_bracket field supports both aggregate and income-segmented net price records
4. Migration validated against sample College Scorecard net price data structure
5. Unit tests cover null-handling for institutions with no reported aid data

**Dependencies:** TUIT-3 (Design Schema – Institutions Table)

**Blockers:** TUIT-7 (Data Versioning & Audit Trail Schema), TUIT-8 (Indexing & Query Performance Strategy), TUIT-9 (Data Validation Constraints), TUIT-22 (Net Price vs. Sticker Price Calculation Module)

---

### TUIT-7: [Backend] Implement Data Versioning & Audit Trail Schema
**Epic/Module:** Data Infrastructure
**Description:** Build a generic audit/versioning layer that logs every insert/update to tuition, fee, and aid tables — required for dispute resolution, accuracy liability defense, and change-detection downstream.

**Acceptance Criteria:**
1. `audit_log` table captures: table_name, record_id, field_changed, old_value, new_value, changed_by (system/scraper/manual), source_url, timestamp
2. Trigger-based or application-layer hooks implemented on tuition_rates, fees_breakdown, and net_price_data tables
3. Audit records are immutable (no update/delete permissions at the DB role level)
4. Query performance validated for retrieving full history of a single record in <200ms
5. Retention policy documented (minimum 7 years, aligned with financial record-keeping norms)

**Dependencies:** TUIT-4 (Historical Tuition Rates Table), TUIT-5 (Fees & Cost Breakdown Table), TUIT-6 (Financial Aid & Net Price Table)

**Blockers:** TUIT-17 (Change-Detection & Diffing Engine)

---

### TUIT-8: [Backend] Define Indexing & Query Performance Strategy
**Epic/Module:** Data Infrastructure
**Description:** Analyze expected query patterns (trend lookups, segmentation filters, comparison queries) and implement supporting indexes across core tables ahead of ingestion and analytics workloads.

**Acceptance Criteria:**
1. Indexes created on institution_id, academic_year, and residency_status across relevant tables
2. Composite index added to support segmentation queries (sector + institution_type + state)
3. Query plans (EXPLAIN ANALYZE) documented for the top 5 anticipated dashboard queries, all under 100ms on seeded 10k-row dataset
4. Slow-query logging enabled and threshold alerting configured
5. Index maintenance plan documented (e.g., autovacuum tuning notes)

**Dependencies:** TUIT-4 (Historical Tuition Rates Table), TUIT-5 (Fees & Cost Breakdown Table), TUIT-6 (Financial Aid & Net Price Table)

**Blockers:** TUIT-21 (CAGR Calculation Service)

---

### TUIT-9: [Backend] Implement Data Validation Constraints & Referential Integrity
**Epic/Module:** Data Infrastructure
**Description:** Add database- and application-level validation rules to prevent malformed or implausible data (negative tuition, future-dated records without flag, orphaned foreign keys) from entering the system — critical given this is a financial decision-support product.

**Acceptance Criteria:**
1. CHECK constraints added preventing negative or zero tuition/fee amounts
2. Application-layer validation rejects academic_year values outside a configurable sane range (e.g., 1990–current+2)
3. Foreign key constraints enforced across all child tables with appropriate ON DELETE behavior
4. Validation failures logged with enough context (source, payload) to debug without exposing this in user-facing errors
5. Test suite covers at least 10 malformed-input scenarios with expected rejection behavior

**Dependencies:** TUIT-4 (Historical Tuition Rates Table), TUIT-5 (Fees & Cost Breakdown Table), TUIT-6 (Financial Aid & Net Price Table)

**Blockers:** TUIT-13 (Generic Web Scraper Framework), TUIT-16 (ETL Normalization Pipeline)

---

## Phase 2: Data Ingestion Pipelines (Scraping & APIs)

### TUIT-10: [Data] Build College Scorecard API Client
**Epic/Module:** Data Ingestion
**Description:** Build an authenticated client for the College Scorecard API to pull institutional cost, completion, and characteristics data into the normalized schema.

**Acceptance Criteria:**
1. Client authenticates via API key stored in secrets manager
2. Supports field selection (e.g., `latest.cost.tuition.in_state`) matching the schema's required fields
3. Handles the API's documented rate limit of 1,000 requests/hour per IP with backoff/retry logic
4. Pagination handled correctly for full institution-set pulls
5. Unit tests mock API responses and confirm correct mapping to internal data model
6. Failure responses (429, 5xx) logged and surfaced to the alerting system (see TUIT-20)

**Dependencies:** TUIT-4 (Design Schema – Historical Tuition Rates Table)

**Blockers:** TUIT-12 (API Rate-Limiting & Caching Layer), TUIT-16 (ETL Normalization Pipeline)

---

### TUIT-11: [Data] Build IPEDS Bulk Data Import Connector
**Epic/Module:** Data Ingestion
**Description:** Build a connector to ingest IPEDS bulk data files (fall/winter/spring collection cycles) covering finance and enrollment data not fully available via the Scorecard API.

**Acceptance Criteria:**
1. Connector downloads and parses IPEDS flat-file/CSV data releases
2. Field mapping documented between IPEDS variable codes and internal schema fields
3. Handles provisional vs. final data flags, tagging records accordingly
4. Import job is idempotent — re-running on the same file does not create duplicates
5. Import summary report generated (rows processed, rows rejected, validation errors)

**Dependencies:** TUIT-4 (Design Schema – Historical Tuition Rates Table)

**Blockers:** TUIT-16 (ETL Normalization Pipeline)

---

### TUIT-12: [Data] Implement API Rate-Limiting & Caching Layer
**Epic/Module:** Data Ingestion
**Description:** Add a caching layer in front of external API calls to stay within rate limits and avoid redundant calls for data that changes infrequently.

**Acceptance Criteria:**
1. Response caching implemented (Redis or equivalent) with configurable TTL per data type
2. Cache-hit ratio logged and visible on a basic ops dashboard
3. Manual cache-bust endpoint/command available for forced refresh
4. Confirmed that API client throughput stays under the documented 1,000 req/hour limit under load testing
5. Cache failures degrade gracefully to direct API calls rather than hard-failing

**Dependencies:** TUIT-10 (Build College Scorecard API Client)

**Blockers:** TUIT-16 (ETL Normalization Pipeline)

---

### TUIT-13: [Data] Build Generic Web Scraper Framework
**Epic/Module:** Data Ingestion
**Description:** Build the reusable scraping framework (HTTP fetch + HTML parsing + extraction abstraction) that per-institution scraper configs will plug into.

**Acceptance Criteria:**
1. Framework supports configurable CSS/XPath selectors per target field
2. Respects `robots.txt` by default with an explicit override flag requiring manual approval
3. Built-in rate limiting per domain to avoid aggressive-crawl legal/technical exposure
4. Extraction failures produce structured error output (not silent nulls)
5. Framework outputs data in the canonical ingestion schema shape before hand-off to ETL
6. Logging captures source_url and timestamp for every extraction, feeding the audit trail

**Dependencies:** TUIT-4 (Historical Tuition Rates Table), TUIT-9 (Data Validation Constraints & Referential Integrity)

**Blockers:** TUIT-14 (Per-Institution Scraper Configuration System)

---

### TUIT-14: [Data] Build Per-Institution Scraper Configuration System
**Epic/Module:** Data Ingestion
**Description:** Build a configuration-driven system allowing new institution scrapers to be added via config files/records rather than new code, given the lack of standardization across ~6,000 bursar/financial aid pages.

**Acceptance Criteria:**
1. Config schema supports per-institution selector definitions, target URL, and field mappings
2. Configs stored in DB or version-controlled config files (decision documented)
3. Validation tooling flags configs with missing required field mappings before activation
4. At least 3 sample configs built and tested end-to-end against real institution pages as proof of concept
5. Documentation written for future engineers/analysts to add new institution configs without core code changes

**Dependencies:** TUIT-13 (Build Generic Web Scraper Framework)

**Blockers:** TUIT-15 (Scrapers for Top 100 Priority Institutions)

---

### TUIT-15: [Data] Implement Scrapers for Top 100 Priority Institutions (Batch 1)
**Epic/Module:** Data Ingestion
**Description:** Using the scraper framework and config system, build and validate working scraper configs for the top 100 institutions by anticipated search volume/traffic.

**Acceptance Criteria:**
1. 100 institution scraper configs created and passing extraction validation
2. Manual spot-check of 20 random configs confirms >95% field extraction accuracy against source pages
3. All 100 configs scheduled for at least one successful full run in staging
4. Failure list documented for institutions where standard selectors don't apply, flagged for manual config follow-up
5. Extracted data successfully lands in staging tables via the ETL pipeline hand-off point

**Dependencies:** TUIT-14 (Per-Institution Scraper Configuration System)

**Blockers:** TUIT-16 (ETL Normalization Pipeline)

---

### TUIT-16: [Data] Build ETL Normalization Pipeline (Canonical Schema Mapping)
**Epic/Module:** Data Ingestion
**Description:** Build the ETL layer that takes raw output from the API clients and scrapers and normalizes it into the canonical schema, resolving field-naming and unit inconsistencies across sources.

**Acceptance Criteria:**
1. Pipeline accepts input from College Scorecard client, IPEDS connector, and scraper framework outputs
2. Canonical mapping documented for every source field to target schema field
3. Conflicting values from multiple sources for the same institution/year are resolved via documented precedence rules (e.g., scraped current-year data takes precedence over stale API data)
4. Pipeline runs are idempotent and re-runnable without creating duplicate historical records
5. End-to-end test confirms a sample institution's data flows correctly from raw source through to queryable normalized tables

**Dependencies:** TUIT-10 (College Scorecard API Client), TUIT-11 (IPEDS Bulk Data Import Connector), TUIT-12 (API Rate-Limiting & Caching Layer), TUIT-15 (Scrapers for Top 100 Priority Institutions), TUIT-9 (Data Validation Constraints & Referential Integrity)

**Blockers:** TUIT-17 (Change-Detection & Diffing Engine), TUIT-19 (Pipeline Orchestration & Scheduling), TUIT-21 (CAGR Calculation Service), TUIT-22 (Net Price vs. Sticker Price Calculation Module), TUIT-23 (Data Segmentation Logic)

---

### TUIT-17: [Data] Implement Change-Detection & Diffing Engine
**Epic/Module:** Data Ingestion
**Description:** Build a diffing engine that hashes extracted numeric fields per institution/year and flags changes for human QA rather than auto-committing scraped updates directly to production data.

**Acceptance Criteria:**
1. Hash comparison implemented against the most recent audit-logged value for each field
2. Detected changes generate a "pending review" record rather than an immediate live update
3. Threshold logic distinguishes trivial formatting changes from substantive value changes
4. Diff output includes old value, new value, source_url, and detected timestamp
5. Integration test confirms a simulated tuition change correctly generates exactly one pending review item

**Dependencies:** TUIT-7 (Data Versioning & Audit Trail Schema), TUIT-16 (ETL Normalization Pipeline)

**Blockers:** TUIT-18 (Manual QA Review Queue), TUIT-26 (Anomaly Detection for Ingested Data), TUIT-35 (Data Freshness & Source Attribution Indicator)

---

### TUIT-18: [Data] Build Manual QA Review Queue for Flagged Data Changes
**Epic/Module:** Data Ingestion
**Description:** Build an internal review interface/queue where flagged changes from the diffing engine are approved or rejected by a human operator before becoming live data.

**Acceptance Criteria:**
1. Queue lists pending changes with old/new value, source, and confidence score
2. Approve/reject actions implemented with reviewer identity logged
3. Approved changes commit to production tables and generate an audit log entry
4. Rejected changes are archived (not deleted) with rejection reason captured
5. Queue supports basic filtering (by institution, by field type, by date flagged)

**Dependencies:** TUIT-17 (Change-Detection & Diffing Engine)

**Blockers:** None (terminal node in ingestion QA flow)

---

### TUIT-19: [Data] Set Up Pipeline Orchestration & Scheduling
**Epic/Module:** Data Ingestion
**Description:** Implement orchestration (e.g., Airflow, Dagster, or cron-based job runner) to schedule API pulls, scraper runs, and ETL jobs on appropriate cadences.

**Acceptance Criteria:**
1. Scheduler configured with distinct cadences per source (e.g., scrapers daily, IPEDS bulk import aligned to release cycles)
2. Job dependency graph enforces ETL only runs after source jobs complete successfully
3. Manual trigger capability available for on-demand re-runs
4. Job run history and status visible in an ops dashboard or orchestration UI
5. Failed job runs do not block unrelated downstream jobs (isolated failure domains)

**Dependencies:** TUIT-16 (ETL Normalization Pipeline)

**Blockers:** TUIT-20 (Pipeline Error Handling & Alerting)

---

### TUIT-20: [Data] Implement Pipeline Error Handling & Alerting
**Epic/Module:** Data Ingestion
**Description:** Add structured error handling and alerting across the ingestion pipeline so failures (API downtime, scraper breakage from site redesigns, validation rejections) are surfaced to the team promptly.

**Acceptance Criteria:**
1. All pipeline stages emit structured error events with context (source, institution, stage, error type)
2. Alerting integrated with team notification channel (e.g., Slack/PagerDuty) for critical failures
3. Non-critical failures (e.g., single scraper config broken) logged without paging, but visible on a dashboard
4. Alert fatigue mitigated via deduplication/throttling for repeated identical errors
5. Runbook documented for the top 3 anticipated failure modes

**Dependencies:** TUIT-19 (Pipeline Orchestration & Scheduling)

**Blockers:** None (terminal node in ingestion reliability flow)

---

## Phase 3: Analytical Engine (Inflation Rate Calculations)

### TUIT-21: [Backend] Build CAGR Calculation Service
**Epic/Module:** Analytics
**Description:** Build the core service that calculates compound annual growth rate for tuition over configurable time windows (e.g., 5-year, 10-year) per institution.

**Acceptance Criteria:**
1. Service implements `CAGR = (End Value / Start Value)^(1/years) - 1` against normalized historical tuition data
2. Configurable time window parameter (default 5yr and 10yr presets)
3. Gracefully handles missing-year gaps without silently interpolating (documented null-handling behavior)
4. Unit tests cover edge cases: single data point, all-null range, negative growth
5. Performance validated to compute CAGR for 1,000 institutions in under 5 seconds (batch mode)

**Dependencies:** TUIT-16 (ETL Normalization Pipeline), TUIT-8 (Indexing & Query Performance Strategy)

**Blockers:** TUIT-24 (YoY Change Calculation Service), TUIT-25 (Tuition Projection/Forecasting Engine), TUIT-26 (Anomaly Detection for Ingested Data), TUIT-27 (Analytics REST API Endpoints)

---

### TUIT-22: [Backend] Build Net Price vs. Sticker Price Calculation Module
**Epic/Module:** Analytics
**Description:** Build the module that computes and exposes net price (sticker minus average aid) alongside sticker price trends, since the two series can diverge significantly and must be modeled independently.

**Acceptance Criteria:**
1. Module joins `tuition_rates` and `net_price_data` per institution/year
2. Outputs both series independently — no blending sticker and net price into a single misleading number
3. Handles institutions with no reported net price data by explicitly flagging "insufficient data" rather than defaulting to sticker price silently
4. Unit tests confirm correct calculation against known sample data (e.g., a mocked institution with documented aid figures)
5. Output schema documented for consumption by the API layer

**Dependencies:** TUIT-6 (Financial Aid & Net Price Table), TUIT-16 (ETL Normalization Pipeline)

**Blockers:** TUIT-27 (Analytics REST API Endpoints)

---

### TUIT-23: [Backend] Implement Data Segmentation Logic
**Epic/Module:** Analytics
**Description:** Build segmentation logic so trend and CAGR calculations can be sliced by public/private, in-state/out-of-state, institution type (2yr/4yr), and state/region — since a single blended average is not meaningful for this domain.

**Acceptance Criteria:**
1. Segmentation service accepts filter parameters (sector, residency, institution_type, state) and returns matching institution cohorts
2. Aggregate calculations (avg CAGR, avg tuition) computed per segment, not just per institution
3. Segment definitions documented and aligned with IPEDS classification codes for consistency
4. Unit tests confirm correct cohort membership for at least 5 segment combinations
5. Performance validated for computing segment aggregates across the full institution set in under 10 seconds

**Dependencies:** TUIT-3 (Design Schema – Institutions Table), TUIT-16 (ETL Normalization Pipeline)

**Blockers:** TUIT-25 (Tuition Projection/Forecasting Engine), TUIT-27 (Analytics REST API Endpoints)

---

### TUIT-24: [Backend] Build YoY Change Calculation Service
**Epic/Module:** Analytics
**Description:** Build a lightweight service computing simple year-over-year percentage change per institution, complementing the multi-year CAGR metric with a more immediate signal.

**Acceptance Criteria:**
1. Service computes `(current_year - prior_year) / prior_year` per institution per field (tuition, total cost)
2. Returns null/flagged status when prior-year data is missing rather than a misleading 0%
3. Output includes directionality (increase/decrease/flat) for direct UI consumption
4. Unit tests cover zero-value and missing-data edge cases
5. Integrated into the same output contract as the CAGR service for consistent API consumption

**Dependencies:** TUIT-21 (Build CAGR Calculation Service)

**Blockers:** TUIT-27 (Analytics REST API Endpoints)

---

### TUIT-25: [Backend] Build Tuition Projection/Forecasting Engine
**Epic/Module:** Analytics
**Description:** Build the forward-looking projection engine that estimates future tuition costs using historical CAGR, clearly labeled as an estimate rather than a guarantee.

**Acceptance Criteria:**
1. Projection formula uses trailing CAGR (configurable window) applied forward N years
2. Output includes a confidence/methodology label distinguishing it from historical fact
3. Segmentation-aware — projections can be generated per segment, not just per institution
4. Rounding logic applied to avoid false precision (e.g., round to nearest $100)
5. Unit tests validate projection output against manually calculated expected values for sample data

**Dependencies:** TUIT-21 (Build CAGR Calculation Service), TUIT-23 (Implement Data Segmentation Logic)

**Blockers:** TUIT-27 (Analytics REST API Endpoints)

---

### TUIT-26: [Backend] Implement Anomaly Detection for Ingested Data
**Epic/Module:** Analytics
**Description:** Build a detection layer that flags newly ingested tuition values that deviate implausibly from historical trend, catching both scraper bugs and genuine one-off events (tuition freezes/spikes) for review.

**Acceptance Criteria:**
1. Detection compares new values against trailing CAGR-implied expected range with a configurable tolerance band
2. Flagged anomalies route into the same QA review queue as diffing-engine changes (TUIT-18)
3. False-positive rate validated against a historical dataset of known legitimate tuition freezes/spikes (target: does not over-flag known-good events)
4. Anomaly flags include a human-readable explanation (e.g., "42% above trend-implied value")
5. Unit tests cover both true anomalies and legitimate outlier events

**Dependencies:** TUIT-17 (Change-Detection & Diffing Engine), TUIT-21 (Build CAGR Calculation Service)

**Blockers:** None (feeds into existing QA queue, no new downstream ticket)

---

### TUIT-27: [Backend] Build Analytics REST API Endpoints
**Epic/Module:** Analytics
**Description:** Expose all analytics services (CAGR, net price, segmentation, YoY, projections) via a unified REST API layer consumable by the frontend and, eventually, external B2B API customers.

**Acceptance Criteria:**
1. Endpoints implemented for: institution CAGR, YoY change, net price comparison, segment aggregates, and projections
2. Consistent response schema and error format across all endpoints
3. API versioning strategy in place (e.g., `/v1/`) to support future breaking changes
4. Authentication/authorization middleware applied (even if initially internal-only)
5. OpenAPI/Swagger documentation generated and published for internal consumption
6. Load-tested to confirm p95 response time under 300ms for single-institution queries

**Dependencies:** TUIT-21 (CAGR Calculation Service), TUIT-22 (Net Price vs. Sticker Price Calculation Module), TUIT-23 (Data Segmentation Logic), TUIT-24 (YoY Change Calculation Service), TUIT-25 (Tuition Projection/Forecasting Engine)

**Blockers:** TUIT-28 (Analytics Results Caching Layer), TUIT-30 (Frontend API Integration Layer)

---

### TUIT-28: [Backend] Implement Analytics Results Caching Layer
**Epic/Module:** Analytics
**Description:** Add a caching layer in front of the analytics API to avoid recomputing expensive aggregate calculations (segment-wide CAGR, projections) on every request.

**Acceptance Criteria:**
1. Cache implemented (Redis or equivalent) keyed by endpoint + query parameters
2. Cache invalidation triggered automatically when underlying tuition data is updated (tied into ETL/QA approval flow)
3. Cache-hit ratio monitored and visible on ops dashboard
4. Fallback to live computation on cache miss with no user-facing errors
5. Load test confirms meaningful latency improvement (target: >70% reduction in p95 response time for cached segment queries)

**Dependencies:** TUIT-27 (Build Analytics REST API Endpoints)

**Blockers:** TUIT-33 (Core Metrics Dashboard Cards), TUIT-34 (Historical Trend Chart Component)

---

## Phase 4: Frontend Dashboard & Visualization

### TUIT-29: [Frontend] Set Up Design System & Component Library
**Epic/Module:** Frontend
**Description:** Establish the shared component library and design tokens (typography, color, spacing) that all dashboard UI will be built from, ensuring visual consistency across the profile page, search, and future comparison tools.

**Acceptance Criteria:**
1. Design tokens defined (colors, spacing scale, typography) and implemented as shared CSS variables/theme config
2. Core reusable components built: buttons, cards, badges, input fields, data tables
3. Component library documented (e.g., Storybook) for team reference
4. Accessibility baseline confirmed (color contrast ratios, focus states) on all core components
5. Library published as an internal package consumable by all frontend feature tickets

**Dependencies:** None (can proceed in parallel with backend work)

**Blockers:** TUIT-30 (Frontend API Integration Layer), TUIT-32 (Institution Profile Page Layout)

---

### TUIT-30: [Frontend] Build Frontend API Integration Layer
**Epic/Module:** Frontend
**Description:** Build the shared data-fetching layer (API client, caching/state management, error handling) that all dashboard views will use to consume the backend analytics API.

**Acceptance Criteria:**
1. Typed API client generated or hand-built matching the backend's OpenAPI contract
2. Global loading/error state handling implemented consistently across consuming components
3. Client-side caching/deduplication implemented for repeated queries within a session
4. Retry logic implemented for transient network failures
5. Integration tests confirm correct handling of both success and error API responses

**Dependencies:** TUIT-27 (Build Analytics REST API Endpoints), TUIT-29 (Design System & Component Library)

**Blockers:** TUIT-31 (Institution Search & Filter UI), TUIT-32 (Institution Profile Page Layout)

---

### TUIT-31: [Frontend] Build Institution Search & Filter UI
**Epic/Module:** Frontend
**Description:** Build the search and filter interface allowing users to find institutions by name, state, sector, and institution type.

**Acceptance Criteria:**
1. Search input supports fuzzy/partial institution name matching
2. Filters implemented for state, public/private, and 2yr/4yr, combinable
3. Results list paginated or virtualized for performance with large result sets
4. Empty-state and no-results messaging implemented
5. Search/filter state reflected in URL query params for shareable/bookmarkable links

**Dependencies:** TUIT-30 (Build Frontend API Integration Layer)

**Blockers:** TUIT-36 (Responsive/Mobile Layout)

---

### TUIT-32: [Frontend] Build Institution Profile Page Layout
**Epic/Module:** Frontend
**Description:** Build the core page shell and layout structure for a single institution's profile — the primary atomic unit of the v1 product experience.

**Acceptance Criteria:**
1. Page layout implemented with designated regions for metrics cards, trend chart, and freshness indicator (per approved wireframe)
2. Dynamic routing implemented (e.g., `/institution/:id`) with correct data fetched per route param
3. Loading skeleton states implemented for all major page regions
4. 404/not-found state implemented for invalid institution IDs
5. Page structure reviewed against MVP dashboard requirements (net price + trend above the fold)

**Dependencies:** TUIT-30 (Frontend API Integration Layer), TUIT-29 (Design System & Component Library)

**Blockers:** TUIT-33 (Core Metrics Dashboard Cards), TUIT-34 (Historical Trend Chart Component), TUIT-35 (Data Freshness & Source Attribution Indicator)

---

### TUIT-33: [Frontend] Build Core Metrics Dashboard Cards ("Big 5")
**Epic/Module:** Frontend
**Description:** Build the five headline metric cards: current sticker price, 5yr/10yr CAGR, net price estimate, YoY change, and projected cost in N years.

**Acceptance Criteria:**
1. All five metric cards implemented and wired to the analytics API
2. In-state vs. out-of-state toggle implemented and correctly re-fetches/re-renders affected cards
3. YoY change card displays directional indicator (up/down arrow) with color coding
4. Projection card clearly labels the figure as an estimate with methodology tooltip
5. Cards handle and display "insufficient data" states gracefully (no blank/broken UI)

**Dependencies:** TUIT-32 (Institution Profile Page Layout), TUIT-28 (Analytics Results Caching Layer)

**Blockers:** TUIT-36 (Responsive/Mobile Layout), TUIT-37 (CSV/Export Functionality)

---

### TUIT-34: [Frontend] Build Historical Trend Chart Component
**Epic/Module:** Frontend
**Description:** Build the primary historical tuition trend line chart (10–15 year view) as the core visualization on the institution profile page.

**Acceptance Criteria:**
1. Line chart renders historical tuition data with correctly labeled axes and years
2. Chart distinguishes sticker price and net price as separate lines (toggleable)
3. Hover/tooltip interaction shows exact value and source for any data point
4. Gaps in historical data (missing years) are visually represented, not interpolated silently
5. Chart library choice documented and performance-tested against a full 15-year dataset

**Dependencies:** TUIT-32 (Institution Profile Page Layout), TUIT-28 (Analytics Results Caching Layer)

**Blockers:** TUIT-36 (Responsive/Mobile Layout), TUIT-37 (CSV/Export Functionality)

---

### TUIT-35: [Frontend] Build Data Freshness & Source Attribution Indicator
**Epic/Module:** Frontend
**Description:** Build the UI component displaying "as of [date], source: [IPEDS/Scorecard/scraped]" for every data point, plus the required informational-estimate disclaimer — core to the product's trust positioning.

**Acceptance Criteria:**
1. Freshness indicator displayed prominently near headline metrics, not buried in a footer
2. Source attribution dynamically reflects actual source_type per underlying record (API vs. scrape vs. manual QA-approved)
3. Disclaimer text ("informational estimate, not official pricing — confirm with the institution") displayed persistently on profile pages
4. Component pulls last-updated timestamp from the audit trail data, not a static build-time value
5. Accessibility review confirms disclaimer text is not hidden from screen readers

**Dependencies:** TUIT-32 (Institution Profile Page Layout), TUIT-17 (Change-Detection & Diffing Engine)

**Blockers:** TUIT-36 (Responsive/Mobile Layout)

---

### TUIT-36: [Frontend] Implement Responsive/Mobile Layout
**Epic/Module:** Frontend
**Description:** Adapt the search, profile page, metrics cards, and chart components for mobile and tablet breakpoints, ensuring the core experience is fully usable on-device.

**Acceptance Criteria:**
1. All Phase 4 components tested and adjusted for breakpoints at 375px, 768px, and 1024px
2. Trend chart remains legible and interactive on small screens (touch-friendly tooltips)
3. Metrics cards reflow into a single-column stack below tablet breakpoint
4. Search/filter UI collapses into a mobile-friendly pattern (e.g., filter drawer) below tablet breakpoint
5. Manual QA pass completed on at least 2 real mobile devices (iOS and Android) in addition to browser emulation

**Dependencies:** TUIT-31 (Institution Search & Filter UI), TUIT-33 (Core Metrics Dashboard Cards), TUIT-34 (Historical Trend Chart Component), TUIT-35 (Data Freshness & Source Attribution Indicator)

**Blockers:** None (terminal node — final polish ticket for v1 launch scope)

---

### TUIT-37: [Frontend] Build CSV/Export Functionality
**Epic/Module:** Frontend
**Description:** Allow users to export an institution's historical tuition data and computed metrics as a CSV file for offline use.

**Acceptance Criteria:**
1. Export button implemented on institution profile page
2. CSV includes all historical years, sticker price, net price, and computed YoY/CAGR fields
3. Export includes a metadata header row noting data source and export timestamp
4. Export function tested for institutions with sparse/missing historical data (no broken CSV structure)
5. Export action logged for basic usage analytics (without storing PII)

**Dependencies:** TUIT-33 (Core Metrics Dashboard Cards), TUIT-34 (Historical Trend Chart Component)

**Blockers:** None (terminal node)

---

## Summary

**Total tickets:** 37
**Phase 1 (Infrastructure):** 9 tickets — foundational, must complete before ingestion begins
**Phase 2 (Ingestion):** 11 tickets — the highest-risk, highest-effort phase given scraping heterogeneity
**Phase 3 (Analytics):** 8 tickets — depends heavily on clean normalized data from Phase 2
**Phase 4 (Frontend):** 9 tickets — design system (TUIT-29) can start in parallel with Phase 1/2; all other frontend tickets gate on the Analytics API (TUIT-27/28)

**Critical path:** TUIT-1 → TUIT-2 → TUIT-3 → TUIT-4 → TUIT-9 → TUIT-13 → TUIT-14 → TUIT-15 → TUIT-16 → TUIT-21 → TUIT-27 → TUIT-28 → TUIT-32 → TUIT-33/34 → TUIT-36
