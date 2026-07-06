import { describe, expect, it } from "vitest";
import {
  MAX_ACADEMIC_YEAR,
  MIN_ACADEMIC_YEAR,
  ValidationError,
  validateFee,
  validateNetPrice,
  validateTuitionRate,
} from "./validation";

const validTuition = {
  institutionId: 1,
  academicYear: 2024,
  residencyStatus: "in_state",
  tuitionAmount: 12345.67,
  sourceType: "api",
} as const;

describe("tuition-rate validation (TUIT-9)", () => {
  it("accepts a well-formed record and defaults currency to USD", () => {
    const result = validateTuitionRate(validTuition);
    expect(result.currency).toBe("USD");
    expect(result.tuitionAmount).toBe(12345.67);
  });

  // The 10+ malformed-input scenarios required by TUIT-9 AC #5.
  const malformed: [string, unknown][] = [
    ["negative tuition", { ...validTuition, tuitionAmount: -100 }],
    ["zero tuition", { ...validTuition, tuitionAmount: 0 }],
    ["NaN tuition", { ...validTuition, tuitionAmount: Number.NaN }],
    ["Infinity tuition", { ...validTuition, tuitionAmount: Number.POSITIVE_INFINITY }],
    ["year below range", { ...validTuition, academicYear: MIN_ACADEMIC_YEAR - 1 }],
    ["year above range", { ...validTuition, academicYear: MAX_ACADEMIC_YEAR + 1 }],
    ["non-integer year", { ...validTuition, academicYear: 2024.5 }],
    ["invalid residency", { ...validTuition, residencyStatus: "resident" }],
    ["invalid source type", { ...validTuition, sourceType: "guess" }],
    ["confidence above 1", { ...validTuition, confidenceScore: 1.5 }],
    ["confidence below 0", { ...validTuition, confidenceScore: -0.1 }],
    ["malformed source url", { ...validTuition, sourceUrl: "not-a-url" }],
    ["non-integer institutionId", { ...validTuition, institutionId: 1.5 }],
    ["missing required field", { academicYear: 2024, tuitionAmount: 100 }],
    ["bad effective date", { ...validTuition, effectiveDate: "03/01/2024" }],
  ];

  it.each(malformed)("rejects: %s", (_label, input) => {
    expect(() => validateTuitionRate(input)).toThrow(ValidationError);
  });
});

describe("fee validation", () => {
  it("accepts zero fees (a $0 mandatory fee is legitimate)", () => {
    expect(() =>
      validateFee({ institutionId: 1, academicYear: 2024, feeType: "mandatory_fee", amount: 0 }),
    ).not.toThrow();
  });

  it("rejects negative fees and unknown fee types", () => {
    expect(() =>
      validateFee({ institutionId: 1, academicYear: 2024, feeType: "mandatory_fee", amount: -1 }),
    ).toThrow(ValidationError);
    expect(() =>
      validateFee({ institutionId: 1, academicYear: 2024, feeType: "parking", amount: 10 }),
    ).toThrow(ValidationError);
  });
});

describe("net-price validation", () => {
  it("accepts a record with no aid figures (aggregate, all optional)", () => {
    expect(() => validateNetPrice({ institutionId: 1, academicYear: 2024 })).not.toThrow();
  });

  it("rejects negative aid amounts", () => {
    expect(() =>
      validateNetPrice({ institutionId: 1, academicYear: 2024, averageAidAmount: -5 }),
    ).toThrow(ValidationError);
  });
});
