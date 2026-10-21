import { assessProductHealth, type HealthInput } from './product-health';

/** An average product in a category with a healthy benchmark. */
const base: HealthInput = {
  ageDays: 120,
  views90: 900,
  carts90: 72,
  orders90: 18,
  units90: 20,
  returnedUnits90: 0,
  cancelledUnits90: 0,
  viewsLast30: 300,
  viewsPrev30: 300,
  allTimeViews: 1000,
  ratingAverage: 4.3,
  ratingCount: 12,
  stockAvailable: 200,
  benchmark: { avgViews: 1000, viewToCartRate: 0.08, viewToOrderRate: 0.02, productsCompared: 12 },
};

describe('assessProductHealth', () => {
  it('refuses to judge without enough evidence', () => {
    const report = assessProductHealth({ ...base, views90: 12, orders90: 1, ageDays: 5 });
    expect(report.verdict).toBe('too_early');
    expect(report.score).toBeNull();
  });

  it('calls an in-line product healthy', () => {
    const report = assessProductHealth(base);
    expect(report.verdict).toBe('healthy');
    expect(report.benchmarkUsed).toBe('category');
    expect(report.metrics.viewToOrderRate).toBeCloseTo(0.02);
  });

  it('flags a star: twice the views and conversion of its category', () => {
    const report = assessProductHealth({ ...base, allTimeViews: 2000, views90: 1800, orders90: 72, units90: 75 });
    expect(report.verdict).toBe('star');
    expect(report.score).toBeGreaterThanOrEqual(75);
  });

  it('flags interest without buyers (price/listing problem)', () => {
    const report = assessProductHealth({ ...base, allTimeViews: 1500, views90: 1350, orders90: 3, units90: 3 });
    expect(report.verdict).toBe('needs_attention');
    expect(report.actions.join(' ')).toMatch(/price/i);
  });

  it('flags low demand and low conversion as underperforming', () => {
    const report = assessProductHealth({ ...base, allTimeViews: 200, views90: 180, orders90: 0, units90: 0 });
    expect(report.verdict).toBe('underperforming');
  });

  it('puts returns and bad ratings ahead of sales', () => {
    const report = assessProductHealth({ ...base, units90: 40, orders90: 36, returnedUnits90: 12, ratingAverage: 2.8 });
    expect(report.verdict).toBe('quality_risk');
    expect(report.metrics.returnRate).toBeCloseTo(0.3);
  });

  it('warns when stock will run out within two weeks', () => {
    const report = assessProductHealth({ ...base, stockAvailable: 2 }); // 20 units / 90 days -> ~9 days of cover
    expect(report.metrics.daysOfStock).toBeLessThan(14);
    expect(report.actions.join(' ')).toMatch(/reorder/i);
  });

  it('falls back to platform rates when the category is too thin', () => {
    const report = assessProductHealth({ ...base, benchmark: { avgViews: null, viewToCartRate: null, viewToOrderRate: null, productsCompared: 1 } });
    expect(report.benchmarkUsed).toBe('platform');
  });
});
