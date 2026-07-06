import { env } from "../../env";

/**
 * Pure authorization decision, isolated from the environment and request so it
 * is exhaustively unit-testable. Rules:
 *  - Keys configured → require an exact match (constant set membership).
 *  - No keys configured + production → deny (fail closed; never ship an open
 *    write endpoint by omission).
 *  - No keys configured + non-production → allow (local/dev convenience).
 */
export function decideAuthorization(input: {
  readonly configuredKeys: ReadonlySet<string>;
  readonly providedKey: string | null;
  readonly isProduction: boolean;
}): boolean {
  if (input.configuredKeys.size === 0) {
    return !input.isProduction;
  }
  return input.providedKey !== null && input.configuredKeys.has(input.providedKey);
}

/** Parse the comma-separated key list into a trimmed, non-empty set. */
export function parseApiKeys(raw: string): Set<string> {
  return new Set(
    raw
      .split(",")
      .map((key) => key.trim())
      .filter((key) => key.length > 0),
  );
}

/** Extract a bearer token from an Authorization header, or null. */
export function bearerToken(header: string | null): string | null {
  if (header === null) {
    return null;
  }
  const prefix = "Bearer ";
  if (!header.startsWith(prefix)) {
    return null;
  }
  const token = header.slice(prefix.length).trim();
  return token.length > 0 ? token : null;
}

/** Wire the pure decision to the live request and environment. */
export function isAuthorized(request: Request): boolean {
  return decideAuthorization({
    configuredKeys: parseApiKeys(env.ANALYTICS_API_KEYS),
    providedKey: bearerToken(request.headers.get("authorization")),
    isProduction: env.NODE_ENV === "production",
  });
}
