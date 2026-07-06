import { z } from "zod";

/**
 * Request-parameter schemas for /api/v1. The enum literals mirror the database
 * enums (packages/db/src/schema/enums.ts) exactly; a mismatch would surface as
 * a type error where these feed the repositories, keeping the two in lockstep.
 */
export const institutionIdSchema = z.coerce.number().int().positive();
export const residencySchema = z.enum(["in_state", "out_of_state"]);
export const sectorSchema = z.enum(["public", "private"]);
export const institutionTypeSchema = z.enum(["two_year", "four_year"]);
export const stateSchema = z
  .string()
  .regex(/^[A-Za-z]{2}$/, "state must be a two-letter code")
  .transform((state) => state.toUpperCase());

/** Parse an optional query value, returning null when absent, through a schema. */
export function optional<T>(
  schema: z.ZodType<T>,
  raw: string | null,
):
  { readonly ok: true; readonly value: T | null } | { readonly ok: false; readonly issue: string } {
  if (raw === null) {
    return { ok: true, value: null };
  }
  const result = schema.safeParse(raw);
  if (!result.success) {
    return { ok: false, issue: result.error.issues[0]?.message ?? "invalid value" };
  }
  return { ok: true, value: result.data };
}
