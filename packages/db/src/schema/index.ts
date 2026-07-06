/**
 * Canonical data model. Data flows one direction into these tables — the ETL
 * pipeline writes through the diff → QA gate; the analytics API reads. The
 * audit trigger, immutability guard, and `total_mandatory_cost` view that
 * accompany these tables live in the SQL migration (they are not expressible in
 * the Drizzle schema DSL).
 */
export * from "./health";
export * from "./enums";
export * from "./institutions";
export * from "./tuition-rates";
export * from "./fees-breakdown";
export * from "./net-price-data";
export * from "./audit-log";
export * from "./pending-changes";
export * from "./analytics-snapshots";
export * from "./segment-snapshots";
