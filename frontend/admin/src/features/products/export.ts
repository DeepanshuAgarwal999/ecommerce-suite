import { fetchAllPages } from '@/lib/export/fetch-all-pages';
import type { ExcelColumn, ExcelSheet } from '@/lib/export/to-excel';
import { productsApi } from './api/products-api';
import type { AdminProductListItem, ProductListQuery } from './types';

const columns: ExcelColumn<AdminProductListItem>[] = [
  { header: 'Title', accessor: (p) => p.title, width: 36 },
  { header: 'Status', accessor: (p) => p.status, width: 14 },
  { header: 'Vendor', accessor: (p) => p.vendorName, width: 24 },
  { header: 'Listed by', accessor: (p) => p.source, width: 14 },
  { header: 'Variants', accessor: (p) => p.variants.length, width: 10 },
  { header: 'Min price (INR)', accessor: (p) => p.minPrice / 100, width: 14 },
  { header: 'Max price (INR)', accessor: (p) => p.maxPrice / 100, width: 14 },
  { header: 'Rating', accessor: (p) => (p.ratingCount > 0 ? p.ratingAverage : ''), width: 10 },
  { header: 'Rating count', accessor: (p) => p.ratingCount, width: 13 },
  { header: 'Sold', accessor: (p) => p.soldCount, width: 10 },
  { header: 'Rejection reason', accessor: (p) => p.rejectionReason ?? '', width: 30 },
  { header: 'Published', accessor: (p) => (p.publishedAt ? new Date(p.publishedAt) : ''), width: 14 },
  { header: 'Created', accessor: (p) => new Date(p.createdAt), width: 14 },
];

/** Every product matching the current filters, as one Excel sheet. */
export async function buildProductsExport(filters: Omit<ProductListQuery, 'page' | 'limit'>) {
  const { rows, truncated } = await fetchAllPages((page, limit) =>
    productsApi.list({ ...filters, page, limit }),
  );
  const sheets: ExcelSheet<unknown>[] = [{ name: 'Products', rows, columns } as ExcelSheet<unknown>];
  return { sheets, truncated };
}
