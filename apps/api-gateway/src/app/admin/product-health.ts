/**
 * "Is this product worth listing?" - a transparent scorecard, not a black box.
 *
 * Three sub-scores (0-100), each explained in plain words:
 *   demand      - how much attention it gets vs. products in its category
 *   conversion  - how often that attention turns into orders vs. its category
 *   quality     - returns and ratings (what happens after the sale)
 * Overall = 35% demand + 40% conversion + 25% quality. A product without enough
 * traffic to judge gets "too early" instead of a misleading score.
 *
 * Benchmarks come from the product's own category (products with >= 20 views); when a
 * category is too thin, platform-typical e-commerce rates are used and the reasons say so.
 */

export type HealthVerdict = 'star' | 'healthy' | 'needs_attention' | 'quality_risk' | 'underperforming' | 'too_early';

export interface HealthInput {
  ageDays: number;
  views90: number;
  carts90: number;
  orders90: number;
  units90: number;
  returnedUnits90: number;
  cancelledUnits90: number;
  viewsLast30: number;
  viewsPrev30: number;
  allTimeViews: number;
  ratingAverage: number;
  ratingCount: number;
  stockAvailable: number | null;
  benchmark: { avgViews: number | null; viewToCartRate: number | null; viewToOrderRate: number | null; productsCompared: number } | null;
}

export interface HealthReport {
  verdict: HealthVerdict;
  score: number | null;
  scores: { demand: number | null; conversion: number | null; quality: number | null };
  metrics: {
    viewToCartRate: number | null;
    viewToOrderRate: number | null;
    returnRate: number | null;
    cancelRate: number | null;
    viewsTrendPct: number | null;
    dailyUnits: number;
    daysOfStock: number | null;
  };
  benchmarkUsed: 'category' | 'platform';
  reasons: string[];
  actions: string[];
}

/** Typical Indian home & living e-commerce rates, used when the category is too thin. */
const PLATFORM = { viewToCart: 0.08, viewToOrder: 0.02 };
const MIN_VIEWS_TO_JUDGE = 30;

const clamp = (value: number) => Math.max(0, Math.min(100, Math.round(value)));
const pct = (value: number) => `${(value * 100).toFixed(1)}%`;

export function assessProductHealth(input: HealthInput): HealthReport {
  const effectiveDays = Math.max(1, Math.min(90, input.ageDays));
  const viewToCart = input.views90 > 0 ? input.carts90 / input.views90 : null;
  const viewToOrder = input.views90 > 0 ? input.orders90 / input.views90 : null;
  const returnRate = input.units90 >= 5 ? input.returnedUnits90 / input.units90 : null;
  const cancelBase = input.units90 + input.cancelledUnits90;
  const cancelRate = cancelBase >= 5 ? input.cancelledUnits90 / cancelBase : null;
  const viewsTrendPct =
    input.viewsPrev30 >= 10 ? ((input.viewsLast30 - input.viewsPrev30) / input.viewsPrev30) * 100 : null;
  const dailyUnits = input.units90 / effectiveDays;
  const daysOfStock = input.stockAvailable === null ? null : dailyUnits > 0 ? input.stockAvailable / dailyUnits : null;

  const useCategory = Boolean(input.benchmark && input.benchmark.productsCompared >= 3 && input.benchmark.viewToOrderRate);
  const benchOrder = useCategory ? (input.benchmark?.viewToOrderRate as number) : PLATFORM.viewToOrder;
  const benchCart = useCategory && input.benchmark?.viewToCartRate ? input.benchmark.viewToCartRate : PLATFORM.viewToCart;

  const reasons: string[] = [];
  const actions: string[] = [];
  const metrics = { viewToCartRate: viewToCart, viewToOrderRate: viewToOrder, returnRate, cancelRate, viewsTrendPct, dailyUnits, daysOfStock };

  // --- Not enough evidence yet -----------------------------------------------------
  if (input.views90 < MIN_VIEWS_TO_JUDGE && input.orders90 < 3) {
    reasons.push(
      `Only ${input.views90} view${input.views90 === 1 ? '' : 's'} and ${input.orders90} order${input.orders90 === 1 ? '' : 's'} in the last 90 days - needs about ${MIN_VIEWS_TO_JUDGE} views before a verdict is meaningful.`,
    );
    actions.push('Give it visibility first: add it to a home page section or occasion theme, and check its title and search keywords.');
    if (input.ageDays < 14) reasons.push(`Listed ${Math.max(0, Math.round(input.ageDays))} day(s) ago.`);
    return { verdict: 'too_early', score: null, scores: { demand: null, conversion: null, quality: null }, metrics, benchmarkUsed: useCategory ? 'category' : 'platform', reasons, actions };
  }

  // --- Demand ------------------------------------------------------------------------
  const avgViews = useCategory && input.benchmark?.avgViews ? input.benchmark.avgViews : null;
  const demand = avgViews
    ? clamp((input.allTimeViews / avgViews) * 50)
    : clamp((input.views90 / effectiveDays) * 10); // ~10 views/day = an average product
  if (avgViews) {
    reasons.push(
      `Gets ${(input.allTimeViews / avgViews).toFixed(1)}x the views of an average product in its category.`,
    );
  }

  // --- Conversion --------------------------------------------------------------------
  const conversion = viewToOrder === null ? 0 : clamp((viewToOrder / benchOrder) * 50);
  if (viewToOrder !== null) {
    reasons.push(
      `${pct(viewToOrder)} of views become orders (${useCategory ? 'category' : 'typical'} average ${pct(benchOrder)}); ${viewToCart !== null ? `${pct(viewToCart)} of views add to cart (average ${pct(benchCart)}).` : ''}`,
    );
  }

  // --- Quality -----------------------------------------------------------------------
  let quality = 100;
  if (returnRate !== null) {
    quality -= returnRate * 250; // 10% returns -> -25
    if (returnRate >= 0.1) reasons.push(`${pct(returnRate)} of units sold were returned.`);
  }
  if (input.ratingCount >= 3) {
    if (input.ratingAverage < 4) quality -= (4 - input.ratingAverage) * 25;
    reasons.push(`Rated ${input.ratingAverage.toFixed(1)}★ by ${input.ratingCount} buyers.`);
  }
  if (cancelRate !== null && cancelRate >= 0.15) {
    quality -= cancelRate * 100;
    reasons.push(`${pct(cancelRate)} of ordered units were cancelled.`);
  }
  quality = clamp(quality);

  if (viewsTrendPct !== null) {
    reasons.push(`Views are ${viewsTrendPct >= 0 ? 'up' : 'down'} ${Math.abs(viewsTrendPct).toFixed(0)}% vs. the previous 30 days.`);
  }

  const score = clamp(demand * 0.35 + conversion * 0.4 + quality * 0.25);

  // --- Verdict + what to do --------------------------------------------------------------
  let verdict: HealthVerdict;
  if (quality < 50) {
    verdict = 'quality_risk';
    actions.push('Read recent returns and reviews - fix the listing (photos, size/material details) or the product itself before promoting it.');
  } else if (score >= 75) {
    verdict = 'star';
    actions.push('Keep it well stocked and feature it in home page sections and occasion campaigns.');
  } else if (demand >= 50 && conversion < 35) {
    verdict = 'needs_attention';
    actions.push('Plenty of interest but few buyers: compare price with similar products, improve photos and description, and check delivery promise and COD availability.');
  } else if (demand < 35 && conversion >= 50) {
    verdict = 'needs_attention';
    actions.push('Converts well when seen but few shoppers find it: improve title and search keywords, and give it home page placement.');
  } else if (demand < 35 && conversion < 35) {
    verdict = 'underperforming';
    actions.push('Low interest and low conversion: consider re-pricing, a refreshed listing, or replacing it with a better-performing alternative.');
  } else {
    verdict = 'healthy';
    actions.push('Performing in line with its category - test a small price or image change to push it higher.');
  }

  if (daysOfStock !== null && daysOfStock < 14 && verdict !== 'underperforming') {
    actions.push(`Only ~${Math.max(0, Math.floor(daysOfStock))} days of stock left at the current sales rate - reorder soon.`);
  } else if (input.stockAvailable === 0) {
    actions.push('Out of stock - every view right now is a lost sale.');
  }

  return {
    verdict,
    score,
    scores: { demand, conversion, quality },
    metrics,
    benchmarkUsed: useCategory ? 'category' : 'platform',
    reasons,
    actions,
  };
}
