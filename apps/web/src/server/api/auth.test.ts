import { describe, expect, it } from "vitest";
import { bearerToken, decideAuthorization, parseApiKeys } from "./auth";

describe("parseApiKeys", () => {
  it("splits, trims, and drops empties", () => {
    expect(parseApiKeys(" k1, k2 ,,k3 ")).toEqual(new Set(["k1", "k2", "k3"]));
  });

  it("yields an empty set for a blank string", () => {
    expect(parseApiKeys("")).toEqual(new Set());
  });
});

describe("bearerToken", () => {
  it("extracts a bearer token", () => {
    expect(bearerToken("Bearer secret-123")).toBe("secret-123");
  });

  it("returns null for a missing header", () => {
    expect(bearerToken(null)).toBeNull();
  });

  it("returns null for a non-bearer scheme", () => {
    expect(bearerToken("Basic abc")).toBeNull();
  });

  it("returns null for an empty token", () => {
    expect(bearerToken("Bearer   ")).toBeNull();
  });
});

describe("decideAuthorization", () => {
  const keys = new Set(["good-key"]);

  it("allows a matching key", () => {
    expect(
      decideAuthorization({ configuredKeys: keys, providedKey: "good-key", isProduction: true }),
    ).toBe(true);
  });

  it("denies a wrong key", () => {
    expect(
      decideAuthorization({ configuredKeys: keys, providedKey: "bad-key", isProduction: true }),
    ).toBe(false);
  });

  it("denies a missing key when keys are configured", () => {
    expect(
      decideAuthorization({ configuredKeys: keys, providedKey: null, isProduction: false }),
    ).toBe(false);
  });

  it("fails closed in production when no keys are configured", () => {
    expect(
      decideAuthorization({ configuredKeys: new Set(), providedKey: null, isProduction: true }),
    ).toBe(false);
  });

  it("allows in non-production when no keys are configured", () => {
    expect(
      decideAuthorization({ configuredKeys: new Set(), providedKey: null, isProduction: false }),
    ).toBe(true);
  });
});
