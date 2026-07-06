import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { env } from "./env";
import * as schema from "./schema";

/**
 * Long-lived query client for the application. Uses a connection pool sized by
 * DATABASE_POOL_MAX. Migration scripts create their own single-connection
 * clients instead of reusing this one.
 */
const queryClient = postgres(env.DATABASE_URL, { max: env.DATABASE_POOL_MAX });

export const db = drizzle(queryClient, { schema });

export type Database = typeof db;
