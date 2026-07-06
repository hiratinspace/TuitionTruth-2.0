/**
 * @tuitiontruth/db — the single source of truth for the data model.
 *
 * Server-side consumers (the /api/v1 layer; the Python pipeline reads the same
 * tables) import from here. The web *client* must never import this package —
 * that boundary is enforced by ESLint (see packages/config/eslint).
 */
export { db, type Database } from "./client";

// Grouped namespace (`schema.tuitionRates`) and flat re-exports (`tuitionRates`).
export * as schema from "./schema";
export * from "./schema";

// Validated ingestion inputs and the repository layer.
export * from "./validation";
export * from "./repositories";
