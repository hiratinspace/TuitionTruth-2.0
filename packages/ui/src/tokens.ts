/**
 * Typed accessors for the design tokens. The CSS variables in `tokens.css` are
 * the runtime source of truth; this module gives TypeScript code a checked way
 * to reference token *names* (e.g. for inline styles or chart theming) without
 * hardcoding hex values.
 */

export const colorTokens = {
  ink: "var(--color-ink)",
  paper: "var(--color-paper)",
  muted: "var(--color-muted)",
  border: "var(--color-border)",
  primary: "var(--color-primary)",
  onPrimary: "var(--color-on-primary)",
  rising: "var(--color-rising)",
  falling: "var(--color-falling)",
  destructive: "var(--color-destructive)",
  ring: "var(--color-ring)",
} as const;

export const fontTokens = {
  display: "var(--font-display)",
  body: "var(--font-body)",
  data: "var(--font-data)",
} as const;

export const motionTokens = {
  durationMicro: "var(--duration-micro)",
  durationTransition: "var(--duration-transition)",
  easingStandard: "var(--easing-standard)",
} as const;

/** Type scale in pixels (§3.1). The 56 slot is reserved for the headline number. */
export const typeScale = [13, 14, 16, 18, 22, 28, 40, 56] as const;

export type ColorToken = keyof typeof colorTokens;
export type FontToken = keyof typeof fontTokens;
