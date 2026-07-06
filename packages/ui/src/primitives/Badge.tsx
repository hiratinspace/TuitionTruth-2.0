import type { ReactNode } from "react";
import { cn } from "./cn";

export type BadgeTone = "neutral" | "primary" | "rising" | "falling" | "destructive";

export interface BadgeProps {
  readonly children: ReactNode;
  readonly tone?: BadgeTone;
  readonly className?: string;
}

const TONES: Record<BadgeTone, string> = {
  neutral: "bg-muted text-ink/70",
  primary: "border border-primary/30 text-primary",
  rising: "text-rising",
  falling: "text-falling",
  destructive: "border border-destructive/40 text-destructive",
};

/**
 * A small status pill. Tones map to semantic tokens only — never a raw hex —
 * and directional tones (`rising`/`falling`) are meant to accompany an arrow or
 * text, since color never carries meaning alone (§3.1).
 */
export function Badge({ children, tone = "neutral", className }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 font-data text-xs",
        TONES[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}
