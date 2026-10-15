import type { ExcelSheet } from '@/lib/export/to-excel';
import type { Insights } from './types';

const rupees = (paise: number | null | undefined) => (paise == null ? null : paise / 100);

/** One sheet per panel, straight from the data already on screen - no extra fetch. */
export function buildInsightsExport(insights: Insights): { sheets: ExcelSheet<unknown>[] } {
  const sheets: ExcelSheet<unknown>[] = [];
  const { engagement, sales, wishlist } = insights;

  if (engagement.ok) {
    sheets.push(
      {
        name: 'Daily traffic',
        rows: engagement.data.series,
        columns: [
          { header: 'Date', accessor: (row: (typeof engagement.data.series)[number]) => row.date, width: 12 },
          { header: 'Product views', accessor: (row: (typeof engagement.data.series)[number]) => row.views },
          { header: 'Searches', accessor: (row: (typeof engagement.data.series)[number]) => row.searches },
          { header: 'Zero-result searches', accessor: (row: (typeof engagement.data.series)[number]) => row.zeroSearches },
        ],
      } as ExcelSheet<unknown>,
      {
        name: 'Top searches',
        rows: engagement.data.topSearches,
        columns: [
          { header: 'Search term', accessor: (row: { term: string }) => row.term, width: 32 },
          { header: 'Searches', accessor: (row: { count: number }) => row.count },
        ],
      } as ExcelSheet<unknown>,
      {
        name: 'No-result searches',
        rows: engagement.data.zeroResultSearches,
        columns: [
          { header: 'Search term', accessor: (row: { term: string }) => row.term, width: 32 },
          { header: 'Searches', accessor: (row: { count: number }) => row.count },
        ],
      } as ExcelSheet<unknown>,
      {
        name: 'Most viewed',
        rows: engagement.data.topViewed,
        columns: [
          { header: 'Product', accessor: (row: (typeof engagement.data.topViewed)[number]) => row.title, width: 40 },
          { header: 'Views', accessor: (row: (typeof engagement.data.topViewed)[number]) => row.views },
          { header: 'Orders', accessor: (row: (typeof engagement.data.topViewed)[number]) => row.orders },
          {
            header: 'Orders per 100 views',
            accessor: (row: (typeof engagement.data.topViewed)[number]) =>
              row.conversion == null ? null : Number(row.conversion.toFixed(2)),
          },
          { header: 'Price (₹)', accessor: (row: (typeof engagement.data.topViewed)[number]) => rupees(row.price) },
        ],
      } as ExcelSheet<unknown>,
    );
  }

  if (sales.ok) {
    sheets.push({
      name: 'Best sellers',
      rows: sales.data.top,
      columns: [
        { header: 'Product', accessor: (row: (typeof sales.data.top)[number]) => row.title, width: 40 },
        { header: 'Units', accessor: (row: (typeof sales.data.top)[number]) => row.units },
        { header: 'Orders', accessor: (row: (typeof sales.data.top)[number]) => row.orders },
        { header: 'Revenue (₹)', accessor: (row: (typeof sales.data.top)[number]) => rupees(row.revenue) },
      ],
    } as ExcelSheet<unknown>);
  }

  if (wishlist.ok) {
    sheets.push({
      name: 'Most wishlisted',
      rows: wishlist.data.top,
      columns: [
        { header: 'Product', accessor: (row: (typeof wishlist.data.top)[number]) => row.title, width: 40 },
        { header: 'Saved by (shoppers)', accessor: (row: (typeof wishlist.data.top)[number]) => row.saves },
        { header: `Saved in last ${insights.days} days`, accessor: (row: (typeof wishlist.data.top)[number]) => row.recent },
      ],
    } as ExcelSheet<unknown>);
  }

  return { sheets };
}
