import { fetchAllPages } from '../src/lib/export/fetch-all-pages';
import type { Paginated } from '../src/types/pagination';

function page(items: number[], pageNum: number, limit: number, total: number): Paginated<number> {
  const totalPages = Math.ceil(total / limit);
  return {
    items,
    meta: {
      page: pageNum,
      limit,
      total,
      totalPages,
      hasNext: pageNum < totalPages,
      hasPrevious: pageNum > 1,
    },
  };
}

describe('fetchAllPages', () => {
  it('collects every row across pages and stops at the last one', async () => {
    const all = Array.from({ length: 25 }, (_, i) => i);
    const fetchPage = jest.fn(async (pageNum: number, limit: number) => {
      const start = (pageNum - 1) * limit;
      return page(all.slice(start, start + limit), pageNum, limit, all.length);
    });

    const result = await fetchAllPages(fetchPage);

    expect(result.rows).toEqual(all);
    expect(result.truncated).toBe(false);
  });

  it('returns an empty, non-truncated result for no matches', async () => {
    const fetchPage = jest.fn(async (pageNum: number, limit: number) => page([], pageNum, limit, 0));

    const result = await fetchAllPages(fetchPage);

    expect(result.rows).toEqual([]);
    expect(result.truncated).toBe(false);
  });

  it('caps at the row limit and reports truncation instead of looping forever', async () => {
    // An endpoint that always claims there is another page, as if it matched
    // far more rows than the export is willing to collect.
    const fetchPage = jest.fn(async (pageNum: number, limit: number) => ({
      items: Array.from({ length: limit }, () => 1),
      meta: {
        page: pageNum,
        limit,
        total: Number.MAX_SAFE_INTEGER,
        totalPages: Number.MAX_SAFE_INTEGER,
        hasNext: true,
        hasPrevious: pageNum > 1,
      },
    }));

    const result = await fetchAllPages(fetchPage);

    expect(result.truncated).toBe(true);
    expect(result.rows.length).toBe(5000);
  });
});
