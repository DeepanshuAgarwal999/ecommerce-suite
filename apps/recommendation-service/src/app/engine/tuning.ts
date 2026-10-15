import { InteractionKind } from '@ecom-db/recommendation';

/**
 * Every knob the models use, in one place. Values follow common e-commerce practice;
 * tune against your own click-through/conversion data once there is some.
 */

/** Implicit-feedback strength: buying says far more than looking. */
export const INTERACTION_WEIGHT: Record<InteractionKind, number> = {
  VIEW: 1,
  WISHLIST: 3,
  CART: 4,
  PURCHASE: 8,
};

/** Interest half-life: a category viewed 14 days ago counts half as much as today. */
export const AFFINITY_HALF_LIFE_DAYS = 14;
/** Popularity half-life - "trending" should move faster than personal taste. */
export const POPULARITY_HALF_LIFE_DAYS = 7;

/** Views closer together than this are one browsing session (co-view window). */
export const SESSION_WINDOW_SECONDS = 30 * 60;
/** Products remembered per session for co-view pairing. */
export const SESSION_DEPTH = 15;
/** Carts within this window are paired ("added X, then also added Y"). */
export const CO_CART_WINDOW_DAYS = 7;
/** A later purchase within this window still pairs with an earlier one - the AC
 *  bought on Monday, the AC cover and stand the following week. */
export const SEQUENTIAL_PURCHASE_WINDOW_DAYS = 30;
/** Same-order pairs are the strongest evidence; sequential ones count for less. */
export const SAME_ORDER_PAIR_WEIGHT = 1;
export const SEQUENTIAL_PAIR_WEIGHT = 0.5;
/** Carting together is weaker evidence of "bought together" than buying together. */
export const CO_CART_IN_BOUGHT_TOGETHER = 0.4;

/** Neighbours kept per product per list. */
export const NEIGHBORS_PER_PRODUCT = 20;
/** Pairs seen fewer times than this are noise, not signal. */
export const MIN_PAIR_SUPPORT = 1;

/** Interaction history retention. Older rows no longer move any score. */
export const INTERACTION_RETENTION_DAYS = 180;

export const DAY_SECONDS = 24 * 60 * 60;

/** e^(-ln2 * age / halfLife): 1 now, 0.5 after one half-life. */
export function decay(ageSeconds: number, halfLifeDays: number): number {
  return Math.exp((-Math.LN2 * Math.max(0, ageSeconds)) / (halfLifeDays * DAY_SECONDS));
}
