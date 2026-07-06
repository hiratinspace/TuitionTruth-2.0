import type { Config } from "tailwindcss";

/**
 * Tailwind maps utility classes onto the design tokens defined in
 * @tuitiontruth/ui (tokens.css). Components use semantic class names
 * (`bg-paper`, `text-ink`, `font-display`) — never raw hex.
 */
export default {
  content: ["./src/**/*.{ts,tsx}", "../../packages/ui/src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "var(--color-ink)",
        paper: "var(--color-paper)",
        muted: "var(--color-muted)",
        border: "var(--color-border)",
        primary: "var(--color-primary)",
        "on-primary": "var(--color-on-primary)",
        rising: "var(--color-rising)",
        falling: "var(--color-falling)",
        destructive: "var(--color-destructive)",
      },
      fontFamily: {
        display: "var(--font-display)",
        body: "var(--font-body)",
        data: "var(--font-data)",
      },
      maxWidth: {
        content: "var(--content-max)",
      },
      transitionTimingFunction: {
        standard: "var(--easing-standard)",
      },
    },
  },
  plugins: [],
} satisfies Config;
