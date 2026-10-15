import type { ExcelColumn, ExcelSheet } from '@/lib/export/to-excel';
import type { DashboardOverview, OrderTrendPoint, StatusCount } from './api/dashboard-api';

interface SummaryRow {
  metric: string;
  value: number;
}

const summaryColumns: ExcelColumn<SummaryRow>[] = [
  { header: 'Metric', accessor: (r) => r.metric, width: 30 },
  { header: 'Value', accessor: (r) => r.value, width: 12 },
];

const statusColumns: ExcelColumn<StatusCount>[] = [
  { header: 'Status', accessor: (r) => r.status, width: 20 },
  { header: 'Count', accessor: (r) => r.count, width: 10 },
];

const trendColumns: ExcelColumn<OrderTrendPoint>[] = [
  { header: 'Date', accessor: (r) => r.date, width: 14 },
  { header: 'Orders', accessor: (r) => r.orders, width: 10 },
];

/** Snapshot of the dashboard as it was last fetched — no extra network calls. */
export function buildDashboardExport(
  overview: DashboardOverview,
  trend: OrderTrendPoint[],
): { sheets: ExcelSheet<unknown>[] } {
  const summary: SummaryRow[] = [
    { metric: 'Total vendors', value: overview.vendors.total },
    { metric: 'Total products', value: overview.products.total },
    { metric: 'Total orders', value: overview.orders.total },
    { metric: 'SKUs at or below reorder level', value: overview.lowStockCount },
  ];

  const sheets: ExcelSheet<unknown>[] = [
    { name: 'Summary', rows: summary, columns: summaryColumns } as ExcelSheet<unknown>,
    { name: 'Vendors by status', rows: overview.vendors.byStatus, columns: statusColumns } as ExcelSheet<unknown>,
    { name: 'Products by status', rows: overview.products.byStatus, columns: statusColumns } as ExcelSheet<unknown>,
    { name: 'Orders by status', rows: overview.orders.byStatus, columns: statusColumns } as ExcelSheet<unknown>,
    { name: 'Order trend', rows: trend, columns: trendColumns } as ExcelSheet<unknown>,
  ];

  return { sheets };
}
