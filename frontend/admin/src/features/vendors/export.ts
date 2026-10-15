import { fetchAllPages } from '@/lib/export/fetch-all-pages';
import type { ExcelColumn, ExcelSheet } from '@/lib/export/to-excel';
import { vendorsApi } from './api/vendors-api';
import type { VendorListQuery, VendorWithUser } from './types';

const columns: ExcelColumn<VendorWithUser>[] = [
  { header: 'Vendor code', accessor: (v) => v.vendorCode, width: 14 },
  { header: 'Business name', accessor: (v) => v.businessName, width: 28 },
  { header: 'Legal name', accessor: (v) => v.legalName ?? '', width: 24 },
  { header: 'Status', accessor: (v) => v.status, width: 12 },
  { header: 'Mobile', accessor: (v) => v.user?.mobile ?? '', width: 14 },
  { header: 'Support email', accessor: (v) => v.supportEmail ?? '', width: 26 },
  { header: 'Support phone', accessor: (v) => v.supportPhone ?? '', width: 16 },
  { header: 'GSTIN', accessor: (v) => v.gstin ?? '', width: 18 },
  { header: 'PAN', accessor: (v) => v.pan ?? '', width: 12 },
  { header: 'Commission %', accessor: (v) => v.commissionBps / 100, width: 13 },
  { header: 'Rating', accessor: (v) => (v.ratingCount > 0 ? v.ratingAverage : ''), width: 10 },
  { header: 'Rating count', accessor: (v) => v.ratingCount, width: 13 },
  { header: 'Rejection reason', accessor: (v) => v.rejectionReason ?? '', width: 30 },
  { header: 'Applied', accessor: (v) => new Date(v.createdAt), width: 14 },
];

/** Every vendor matching the current filters, as one Excel sheet. */
export async function buildVendorsExport(filters: Omit<VendorListQuery, 'page' | 'limit'>) {
  const { rows, truncated } = await fetchAllPages((page, limit) =>
    vendorsApi.list({ ...filters, page, limit }),
  );
  const sheets: ExcelSheet<unknown>[] = [{ name: 'Vendors', rows, columns } as ExcelSheet<unknown>];
  return { sheets, truncated };
}
