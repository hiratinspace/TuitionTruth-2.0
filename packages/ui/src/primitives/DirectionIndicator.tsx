import { directionOf, formatPercent, type Direction } from "../format";
import { cn } from "./cn";

export interface DirectionIndicatorProps {
  /** Decimal rate; drives both the glyph and the sign. */
  readonly rate: number;
  readonly className?: string;
  /** Hide the numeric label, keeping only arrow + accessible text (compact use). */
  readonly hideValue?: boolean;
}

const GLYPH: Record<Direction, string> = { rising: "▲", falling: "▼", flat: "—" };
const COLOR: Record<Direction, string> = {
  rising: "text-rising",
  falling: "text-falling",
  flat: "text-ink/60",
};
const WORD: Record<Direction, string> = { rising: "up", falling: "down", flat: "flat" };

/**
 * Renders a rate as arrow + signed percent in the directional color. Crucially,
 * color is *never* the only signal: the arrow glyph and an SR-only word ("up"/
 * "down"/"flat") carry the meaning too, satisfying the colorblind-safe mandate
 * (§3.1).
 */
export function DirectionIndicator({
  rate,
  className,
  hideValue = false,
}: DirectionIndicatorProps) {
  const direction = directionOf(rate);
  return (
    <span className={cn("inline-flex items-center gap-1 font-data", COLOR[direction], className)}>
      <span aria-hidden="true">{GLYPH[direction]}</span>
      <span className="sr-only">{WORD[direction]}</span>
      {!hideValue && <span className="tabular-nums">{formatPercent(rate)}</span>}
    </span>
  );
}
