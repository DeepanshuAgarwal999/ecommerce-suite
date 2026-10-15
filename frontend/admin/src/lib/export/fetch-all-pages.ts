import type { Paginated } from '@/types/pagination';

const MAX_EXPORT_ROWS = 5000;
const PAGE_SIZE = 100;

export interface FetchAllResult<T> {
  rows: T[];
  /** True when MAX_EXPORT_ROWS was hit before every matching row was collected. */
  truncated: boolean;
}

/**
 * Pages through an admin list endpoint to collect every row matching the
 * current filters, for an export. Capped at MAX_EXPORT_ROWS: a staff console
 * export is meant to open in Excel, not replace a data warehouse, and an
 * unbounded loop against a filter that matches everything would hammer the
 * gateway for no good reason.
 */
export async function fetchAllPages<T>(
  fetchPage: (page: number, limit: number) => Promise<Paginated<T>>,
): Promise<FetchAllResult<T>> {
  const rows: T[] = [];
  let page = 1;

  while (rows.length < MAX_EXPORT_ROWS) {
    const result = await fetchPage(page, PAGE_SIZE);
    rows.push(...result.items);

    if (!result.meta.hasNext) {
      return { rows, truncated: false };
    }
    page += 1;
  }

  return { rows: rows.slice(0, MAX_EXPORT_ROWS), truncated: true };
}
