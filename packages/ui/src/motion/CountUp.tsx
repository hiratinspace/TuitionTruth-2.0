"use client";

import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { countUpValue } from "./easing";

// Layout effect on the client (runs before paint, so the reset-to-0 is never
// visible), plain effect on the server (a no-op there) to avoid the SSR warning.
const useIsoLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;

export interface CountUpProps {
  /** The final value; also what SSR and no-JS render (never a flash of 0). */
  readonly value: number;
  /** Formatter applied every frame (e.g. currency). */
  readonly format: (value: number) => ReactNode;
  readonly durationMs?: number;
  readonly className?: string;
}

/**
 * Counts a metric up to its value once, on first paint — "arrival, not
 * decoration" (§3.3). SSR renders the final value, so there's no layout shift
 * and no-JS/SEO see the real number. Honors prefers-reduced-motion by rendering
 * the final value instantly.
 */
export function CountUp({ value, format, durationMs = 300, className }: CountUpProps) {
  const [display, setDisplay] = useState(value);
  const started = useRef(false);

  useIsoLayoutEffect(() => {
    if (started.current) {
      setDisplay(value);
      return;
    }
    started.current = true;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) {
      setDisplay(value);
      return;
    }

    setDisplay(0);
    let raf = 0;
    const start = performance.now();
    const tick = (now: number): void => {
      const elapsed = now - start;
      setDisplay(countUpValue(value, elapsed, durationMs));
      if (elapsed < durationMs) {
        raf = requestAnimationFrame(tick);
      }
    };
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
    };
    // Re-run when the target value changes (e.g. residency toggle).
  }, [value, durationMs]);

  return <span className={className}>{format(display)}</span>;
}
