# Data Dictionary

Canonical reference for the TuitionTruth data model. Ingestion sources map onto these definitions; keeping the mapping here is what keeps scrapers and API connectors consistent (TUIT-5 AC #5, TUIT-8 AC #3, TUIT-11 AC #2).

## Enumerations & IPEDS mappings

### `sector` — IPEDS `CONTROL`

| Canonical | IPEDS CONTROL | Notes                                                                          |
| --------- | ------------- | ------------------------------------------------------------------------------ |
| `public`  | `1`           | Public institution                                                             |
| `private` | `2`, `3`      | Private nonprofit (2) and private for-profit (3) collapsed to `private` for v1 |

### `institution_type` — IPEDS `ICLEVEL`

| Canonical   | IPEDS ICLEVEL | Notes                                                      |
| ----------- | ------------- | ---------------------------------------------------------- |
| `four_year` | `1`           | 4-year and above                                           |
| `two_year`  | `2`, `3`      | 2-year (2) and less-than-2-year (3) folded into `two_year` |

### `residency_status`

| Canonical      | Meaning                                 |
| -------------- | --------------------------------------- |
| `in_state`     | In-state / in-district resident tuition |
| `out_of_state` | Out-of-state / non-resident tuition     |

### `source_type` — provenance

| Value    | Meaning                                       |
| -------- | --------------------------------------------- |
| `api`    | College Scorecard / Urban Institute API       |
| `scrape` | Extracted from an institution bursar/aid page |
| `manual` | Human-entered or QA-approved correction       |

## Fee taxonomy — `fee_type` (TUIT-5)

Fees are stored separately from base tuition so total cost of attendance can be tracked independent of each institution's labeling. Only `mandatory_fee` contributes to the `total_mandatory_cost` view — room and board are living costs, not mandatory academic charges.

| `fee_type`      | Definition                                                                                           | Counts toward mandatory cost? |
| --------------- | ---------------------------------------------------------------------------------------------------- | ----------------------------- |
| `mandatory_fee` | Required non-tuition charges all enrolled students pay (activity, technology, health, facility fees) | **Yes**                       |
| `room`          | On-campus housing charge                                                                             | No                            |
| `board`         | Meal plan charge                                                                                     | No                            |
| `books`         | Estimated books & supplies                                                                           | No                            |
| `other`         | Any component that doesn't fit the above; annotate via `source_url`                                  | No                            |

**Fee reclassification risk:** institutions sometimes shift costs between "tuition" and "fees" to manage optics. Because the model tracks total mandatory cost (tuition + `mandatory_fee`), such shifts do not create artificial volatility in the headline trend.

## Academic year convention

`academic_year` stores the **start year** as an integer: `2024` denotes the 2024–25 academic year. Valid range enforced at both the application layer and the database: `1990 .. 2100` (CHECK), with the application layer additionally rejecting anything beyond `current_year + 2`.

## Money & precision

All monetary columns are `numeric(12, 2)` — exact decimal, never floating point. The application layer writes them as fixed-2 strings. Confidence scores are `numeric(3, 2)` constrained to `[0, 1]`.

## Audit trail & retention (TUIT-7)

`audit_log` records one row per changed field on `tuition_rates`, `fees_breakdown`, and `net_price_data`, written by the `audit_row_change()` trigger. `changed_by` is taken from the transaction-scoped setting `app.actor` (`SET LOCAL app.actor = 'scraper'`), defaulting to `system`.

- **Immutability:** enforced at the database by the `audit_log_immutable` trigger, which rejects any `UPDATE`/`DELETE` regardless of role. `UPDATE`/`DELETE`/`TRUNCATE` are additionally revoked from `PUBLIC`.
- **Retention:** minimum **7 years**, aligned with financial record-keeping norms. Archival (not deletion) is the disposal path; deletes are physically blocked.

## Production role model (operational note)

In production, the application connects as a **non-owner role** with `INSERT`/`SELECT` on the domain tables and `SELECT`/`INSERT` only on `audit_log`. The immutability trigger is the backstop that also protects against a compromised owner connection. Local docker uses the superuser `tuitiontruth` for convenience.
