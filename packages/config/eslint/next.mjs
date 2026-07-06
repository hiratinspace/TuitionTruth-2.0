// Flat ESLint config for the Next.js app. Extends the workspace base and adds
// Next.js core-web-vitals rules plus the architectural boundary that the client
// layer must never import the database package directly (§1.4).
import nextPlugin from "@next/eslint-plugin-next";
import globals from "globals";
import base from "./base.mjs";

/** @type {import("typescript-eslint").ConfigArray} */
export default [
  ...base,
  {
    plugins: {
      "@next/next": nextPlugin,
    },
    languageOptions: {
      globals: { ...globals.browser, ...globals.node },
    },
    rules: {
      ...nextPlugin.configs.recommended.rules,
      ...nextPlugin.configs["core-web-vitals"].rules,
      // Enforce the one-directional data flow: UI consumes the typed API
      // client, never the database or ORM directly.
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "@tuitiontruth/db",
              message:
                "The web client must not import @tuitiontruth/db directly. Data reaches the UI through the typed /api/v1 client (see docs/BUILD_PLAN.md §1.4).",
            },
          ],
          patterns: [
            {
              group: ["postgres", "drizzle-orm", "drizzle-orm/*"],
              message:
                "Do not use the database driver/ORM from the web app. Fetch through the analytics API instead.",
            },
          ],
        },
      ],
    },
  },
];
