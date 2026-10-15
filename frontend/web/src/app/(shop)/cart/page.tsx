import type { Metadata } from 'next';
import { CartView } from '@/features/cart/components/cart-view';

export const metadata: Metadata = { title: 'Cart' };

export default function CartPage() {
  return (
    <div className="container py-6 md:py-8">
      <h1 className="mb-5 text-2xl font-extrabold md:text-[32px]">Your cart</h1>
      <CartView />
    </div>
  );
}
