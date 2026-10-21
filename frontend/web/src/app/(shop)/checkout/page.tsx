import type { Metadata } from 'next';
import { CheckoutFlow } from '@/features/checkout/components/checkout-flow';

export const metadata: Metadata = { title: 'Checkout', robots: { index: false } };

export default function CheckoutPage() {
  return (
    <div className="container py-6 md:py-8">
      <h1 className="mb-5 text-2xl font-extrabold md:text-[32px]">Checkout</h1>
      <CheckoutFlow />
    </div>
  );
}
