# ADR 0001 — Indexing & Query Performance Strategy (TUIT-8)

**Status:** Accepted (Phase 1)

## Context

Dashboard and analytics queries must stay well under 100ms so the UI feels instant. We validated the index strategy against a seeded dataset before ingestion begins.

## Dataset

- 6,000 institutions
- 12,015 tuition rate rows (both residencies for every institution + a 15-year history for institution #1)

## Indexes in place

| Index                                            | Table           | Columns                                         | Serves                |
| ------------------------------------------------ | --------------- | ----------------------------------------------- | --------------------- |
| `tuition_rates_inst_year_residency_key` (unique) | `tuition_rates` | institution_id, academic_year, residency_status | dedup + point lookups |
| `tuition_rates_inst_year_idx`                    | `tuition_rates` | institution_id, academic_year                   | trend queries         |
| `institutions_ipeds_unit_id_key` (unique)        | `institutions`  | ipeds_unit_id                                   | source dedup, lookups |
| `institutions_segment_idx`                       | `institutions`  | sector, institution_type, state                 | segmentation          |
| `institutions_state_idx`                         | `institutions`  | state                                           | state filters         |
| `audit_log_table_record_idx`                     | `audit_log`     | table_name, record_id                           | single-record history |

## Measured `EXPLAIN (ANALYZE)` execution times

| #   | Query                                                    | Execution time | Target            |
| --- | -------------------------------------------------------- | -------------- | ----------------- |
| 1   | Single-institution in-state trend (ordered history)      | **0.085 ms**   | < 100 ms          |
| 2   | Institution current-year, both residencies               | **0.083 ms**   | < 100 ms          |
| 3   | Segment aggregate — avg tuition, public 4-year, in-state | **2.301 ms**   | < 100 ms          |
| 4   | Institution lookup by IPEDS unit id                      | **0.069 ms**   | < 100 ms          |
| 5   | Full audit history for one record                        | **0.020 ms**   | < 200 ms (TUIT-7) |

All five clear their targets by 40×–5000×. Query 1's plan confirms an **Index Scan** on `tuition_rates_inst_year_residency_key` — no sequential scans on the hot paths.

## Maintenance notes

- Postgres `autovacuum` defaults are sufficient at this scale; revisit `autovacuum_vacuum_scale_factor` on `tuition_rates` once it exceeds ~10M rows.
- Enable `log_min_duration_statement = 100ms` in staging/production to catch regressions as data volume grows.
- Re-run `ANALYZE` after each bulk ingestion so the planner has fresh statistics.
