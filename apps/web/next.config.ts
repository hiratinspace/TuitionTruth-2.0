import type { NextConfig } from "next";
// Load the shared monorepo-root .env BEFORE env validation runs.
import "./load-env";
// Validate environment at build time — fail fast on misconfiguration.
import "./src/env";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Internal workspace packages are shipped as TypeScript source and compiled
  // by Next rather than pre-built, so they must be transpiled here.
  transpilePackages: ["@tuitiontruth/ui", "@tuitiontruth/analytics-core", "@tuitiontruth/db"],
  // Stable as of Next 15.5 (moved out of `experimental`): typed <Link href> and
  // router.push targets, catching broken internal routes at build time.
  typedRoutes: true,
  eslint: {
    // Linting is a dedicated workspace step (`pnpm lint`) that runs the full
    // flat config with the Next.js plugin. Don't re-run a partial lint here.
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;
