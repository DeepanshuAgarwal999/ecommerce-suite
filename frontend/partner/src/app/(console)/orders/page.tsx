import type { Metadata } from 'next';
import { PageHeader } from '@/components/common/page-header';
import { OrderTable } from '@/features/orders/components/order-table';

export const metadata: Metadata = { title: 'Orders' };

export default function OrdersPage() {
  return (
    <>
      <PageHeader title="Orders" description="Every order containing one of your products." />
      <OrderTable />
    </>
  );
}
