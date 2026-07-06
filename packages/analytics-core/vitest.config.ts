import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["src/**/*.test.ts"],
    coverage: {
      provider: "v8",
      include: ["src/**/*.ts"],
      exclude: ["src/**/*.test.ts", "src/index.ts"],
      thresholds: {
        // The pure analytics math is the product's credibility. Hold the bar.
        branches: 100,
        functions: 100,
        lines: 100,
        statements: 100,
      },
    },
  },
});
