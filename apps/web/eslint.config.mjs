import next from "@tuitiontruth/config/eslint/next";

export default [
  ...next,
  {
    // API route handlers and server-only modules are the sanctioned place to
    // reach the database; the import ban applies only to the client layer.
    files: ["src/app/api/**/*.ts", "src/server/**/*.ts"],
    rules: {
      "no-restricted-imports": "off",
    },
  },
];
