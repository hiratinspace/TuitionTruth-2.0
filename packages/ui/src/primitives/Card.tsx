import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "./cn";

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  readonly children: ReactNode;
  /** Lift + border-deepen on hover (150ms). Off for static/content cards. */
  readonly interactive?: boolean;
}

/**
 * The base surface — warm paper, hairline border, soft shadow. `interactive`
 * adds the shared hover motion (translateY(-1px) + border deepen, §3.3); it
 * collapses under prefers-reduced-motion via the global motion tokens.
 */
export function Card({ className, children, interactive = false, ...rest }: CardProps) {
  return (
    <div
      className={cn(
        "rounded-[var(--radius)] border border-border bg-paper p-6 shadow-sm",
        interactive &&
          "transition-[transform,border-color] duration-[var(--duration-micro)] ease-standard hover:-translate-y-px hover:border-ink/25",
        className,
      )}
      {...rest}
    >
      {children}
    </div>
  );
}
