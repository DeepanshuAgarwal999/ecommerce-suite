import type { Metadata } from 'next';
import { OrderSuccess } from '@/features/payments/components/order-success';

export const metadata: Metadata = { title: 'Order placed', robots: { index: false } };

interface SuccessPageProps {
  searchParams: Promise<{ order?: string }>;
}

export default async function CheckoutSuccessPage({ searchParams }: SuccessPageProps) {
  const { order = '' } = await searchParams;
  return (
    <div className="container py-8 md:py-12">
      <OrderSuccess orderId={order} />
    </div>
  );
}
