import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";

/**
 * Validated database environment. Import failures here are intentional and
 * loud: a missing or malformed DATABASE_URL should stop the process at boot,
 * not surface as a mysterious connection error later (TUIT-1).
 */
export const env = createEnv({
  server: {
    DATABASE_URL: z.string().url(),
    DATABASE_POOL_MAX: z.coerce.number().int().positive().default(10),
  },
  runtimeEnv: process.env,
  emptyStringAsUndefined: true,
});
