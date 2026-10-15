import { fetchAllPages } from '@/lib/export/fetch-all-pages';
import type { ExcelColumn, ExcelSheet } from '@/lib/export/to-excel';
import { ordersApi } from './api/orders-api';
import type { OrderListItem, OrderListQuery } from './types';

const orderColumns: ExcelColumn<OrderListItem>[] = [
  { header: 'Order number', accessor: (o) => o.orderNumber, width: 18 },
  { header: 'Status', accessor: (o) => o.status, width: 16 },
  { header: 'Customer mobile', accessor: (o) => o.userMobile, width: 16 },
  { header: 'Fulfilment', accessor: (o) => o.fulfilmentType, width: 14 },
  { header: 'Source', accessor: (o) => o.source, width: 10 },
  { header: 'Payment method', accessor: (o) => o.paymentMethod, width: 15 },
  { header: 'Items', accessor: (o) => o.items.length, width: 8 },
  { header: 'Grand total (INR)', accessor: (o) => o.grandTotal / 100, width: 16 },
  { header: 'Placed', accessor: (o) => new Date(o.createdAt), width: 14 },
];

interface OrderItemRow {
  orderNumber: string;
  status: string;
  sku: string;
  title: string;
  quantity: number;
}

const itemColumns: ExcelColumn<OrderItemRow>[] = [
  { header: 'Order number', accessor: (r) => r.orderNumber, width: 18 },
  { header: 'Order status', accessor: (r) => r.status, width: 16 },
  { header: 'SKU', accessor: (r) => r.sku, width: 16 },
  { header: 'Product', accessor: (r) => r.title, width: 36 },
  { header: 'Quantity', accessor: (r) => r.quantity, width: 10 },
];

/** Orders matching the current filters, one sheet per order and one per line item. */
export async function buildOrdersExport(filters: Omit<OrderListQuery, 'page' | 'limit'>) {
  const { rows, truncated } = await fetchAllPages((page, limit) =>
    ordersApi.list({ ...filters, page, limit }),
  );

  const itemRows: OrderItemRow[] = rows.flatMap((order) =>
    order.items.map((item) => ({
      orderNumber: order.orderNumber,
      status: order.status,
      sku: item.sku,
      title: item.title,
      quantity: item.quantity,
    })),
  );

  const sheets: ExcelSheet<unknown>[] = [
    { name: 'Orders', rows, columns: orderColumns } as ExcelSheet<unknown>,
    { name: 'Order items', rows: itemRows, columns: itemColumns } as ExcelSheet<unknown>,
  ];
  return { sheets, truncated };
}
