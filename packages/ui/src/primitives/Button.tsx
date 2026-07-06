import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "./cn";

export type ButtonVariant = "primary" | "secondary" | "ghost";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  readonly children: ReactNode;
  readonly variant?: ButtonVariant;
}

const VARIANTS: Record<ButtonVariant, string> = {
  primary: "bg-primary text-on-primary hover:bg-primary/90",
  secondary: "border border-border bg-paper text-ink hover:border-ink/25",
  ghost: "text-ink/70 hover:bg-muted hover:text-ink",
};

/**
 * The one button. Always renders a visible focus ring (keyboard a11y is a
 * launch gate, not a nicety) and shares the app-wide micro-motion timing.
 */
export function Button({ children, variant = "primary", className, type, ...rest }: ButtonProps) {
  return (
    <button
      type={type ?? "button"}
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-[var(--radius)] px-4 py-2 font-body text-sm font-medium",
        "transition-colors duration-[var(--duration-micro)] ease-standard",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-paper",
        "disabled:cursor-not-allowed disabled:opacity-50",
        VARIANTS[variant],
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  );
}
