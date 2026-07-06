import { pgEnum } from "drizzle-orm/pg-core";

/**
 * Canonical enumerations. Code uses underscored, self-documenting values; the
 * mapping to IPEDS classification codes (CONTROL, ICLEVEL) lives in
 * docs/data-dictionary.md so ingestion stays consistent (TUIT-8 AC #3).
 */

/** IPEDS CONTROL: public vs. private (nonprofit + for-profit collapsed). */
export const sectorEnum = pgEnum("sector", ["public", "private"]);

/** IPEDS ICLEVEL: 4-year vs. 2-year (and below-2-year folded into two_year). */
export const institutionTypeEnum = pgEnum("institution_type", ["two_year", "four_year"]);

/** Residency basis for a tuition figure. */
export const residencyStatusEnum = pgEnum("residency_status", ["in_state", "out_of_state"]);

/** Cost components tracked separately from base tuition (TUIT-5 taxonomy). */
export const feeTypeEnum = pgEnum("fee_type", ["mandatory_fee", "room", "board", "books", "other"]);

/** Provenance of an ingested value. */
export const sourceTypeEnum = pgEnum("source_type", ["api", "scrape", "manual"]);
