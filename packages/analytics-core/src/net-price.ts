import { insufficient, ok, type Metric } from "./metric";

/**
 * The gap between sticker price and net price — the aid a typical student
 * actually receives. `discountRate` is aid as a fraction of sticker. Kept as a
 * distinct computation because the net-price headline ("$18,279 after avg.
 * aid") is the product's above-the-fold number (TUIT-23).
 */
export interface NetPriceResult {
  readonly sticker: number;
  readonly net: number;
  readonly aid: number;
  readonly discountRate: number;
}

/**
 * Compute the aid gap and discount rate. Sticker must be positive to express a
 * ratio; net must be non-negative. A net figure above sticker (negative aid) is
 * permitted and surfaced honestly — some institutions' reported net price
 * includes living costs the sticker omits, and hiding that would be its own lie.
 */
export function netPriceGap(sticker: number, net: number): Metric<NetPriceResult> {
  if (sticker <= 0) {
    return insufficient("sticker price must be positive to compute a discount");
  }
  if (net < 0) {
    return insufficient("net price cannot be negative");
  }
  const aid = sticker - net;
  return ok({ sticker, net, aid, discountRate: aid / sticker });
}
