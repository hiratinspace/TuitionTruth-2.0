import { defineConfig } from "vitest/config";

/**
 * Tests cover the pure presentation logic — money/percent formatters and the
 * chart geometry (scales, gap detection). Component rendering is verified in
 * Storybook + axe (TUIT-29); these unit tests need no DOM.
 */
export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
