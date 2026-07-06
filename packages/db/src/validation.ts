import { z } from "zod";

/**
 * Application-layer validation (TUIT-9). These schemas are the first gate:
 * implausible values (negative tuition, out-of-range years, malformed URLs) are
 * rejected here with context-rich logging, before they ever reach the database
 * CHECK constraints. The two layers are deliberately redundant — defense in
 * depth for a financial-decision-support product.
 */

export const MIN_ACADEMIC_YEAR = 1990;
/** Current year + 2, computed at module load. Announced-but-future rates are allowed a small window. */
export const MAX_ACADEMIC_YEAR = new Date().getUTCFullYear() + 2;

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

const academicYear = z
  .number()
  .int()
  .min(MIN_ACADEMIC_YEAR, { message: `academic_year must be >= ${String(MIN_ACADEMIC_YEAR)}` })
  .max(MAX_ACADEMIC_YEAR, { message: `academic_year must be <= ${String(MAX_ACADEMIC_YEAR)}` });

const money = z.number().finite().positive();
const nonNegativeMoney = z.number().finite().nonnegative();
const isoDate = z.string().regex(ISO_DATE, { message: "expected ISO date YYYY-MM-DD" });
const url = z.string().url();

export const tuitionRateInputSchema = z.object({
  institutionId: z.number().int().positive(),
  academicYear,
  residencyStatus: z.enum(["in_state", "out_of_state"]),
  tuitionAmount: money,
  currency: z.string().length(3).default("USD"),
  effectiveDate: isoDate.optional(),
  sourceType: z.enum(["api", "scrape", "manual"]),
  sourceUrl: url.optional(),
  confidenceScore: z.number().min(0).max(1).optional(),
});
export type TuitionRateInput = z.infer<typeof tuitionRateInputSchema>;

export const feeInputSchema = z.object({
  institutionId: z.number().int().positive(),
  academicYear,
  feeType: z.enum(["mandatory_fee", "room", "board", "books", "other"]),
  amount: nonNegativeMoney,
  effectiveDate: isoDate.optional(),
  sourceUrl: url.optional(),
});
export type FeeInput = z.infer<typeof feeInputSchema>;

export const netPriceInputSchema = z.object({
  institutionId: z.number().int().positive(),
  academicYear,
  incomeBracket: z.string().min(1).optional(),
  averageAidAmount: nonNegativeMoney.optional(),
  netPriceAmount: nonNegativeMoney.optional(),
  dataSource: z.string().min(1).optional(),
  effectiveDate: isoDate.optional(),
});
export type NetPriceInput = z.infer<typeof netPriceInputSchema>;

/** Raised when an ingestion payload fails validation. Carries structured issues. */
export class ValidationError extends Error {
  constructor(
    public readonly entity: string,
    public readonly issues: z.ZodIssue[],
  ) {
    super(`Validation failed for ${entity}: ${issues.map((i) => i.message).join("; ")}`);
    this.name = "ValidationError";
  }
}

function parseOrThrow<S extends z.ZodTypeAny>(
  entity: string,
  schema: S,
  input: unknown,
): z.infer<S> {
  const result = schema.safeParse(input);
  if (!result.success) {
    // Log enough to debug (entity + issue paths) without echoing the payload to
    // any user-facing surface (TUIT-9 AC #4).
    console.error(`[validation] rejected ${entity}`, {
      issues: result.error.issues.map((i) => ({ path: i.path.join("."), message: i.message })),
    });
    throw new ValidationError(entity, result.error.issues);
  }
  // safeParse on a generic ZodTypeAny widens `data` to `any`; narrow it back to
  // the schema's inferred output type.
  return result.data as z.infer<S>;
}

export const validateTuitionRate = (input: unknown): TuitionRateInput =>
  parseOrThrow("tuition_rate", tuitionRateInputSchema, input);

export const validateFee = (input: unknown): FeeInput =>
  parseOrThrow("fee_breakdown", feeInputSchema, input);

export const validateNetPrice = (input: unknown): NetPriceInput =>
  parseOrThrow("net_price", netPriceInputSchema, input);
