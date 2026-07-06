import next from "@tuitiontruth/config/eslint/next";

export default [
  ...next,
  {
    // API route handlers, server-only modules, and tooling scripts are the
    // sanctioned places to reach the database; the ban applies only to the
    // client layer.
    files: ["src/app/api/**/*.ts", "src/server/**/*.ts", "scripts/**/*.ts"],
    rules: {
      "no-restricted-imports": "off",
    },
  },
];
