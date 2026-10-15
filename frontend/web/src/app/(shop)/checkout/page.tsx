import type { Metadata } from 'next';
import Link from 'next/link';
import { CreditCard } from 'lucide-react';
import { EmptyState } from '@/components/common/empty-state';
import { Button } from '@/components/ui/button';

export const metadata: Metadata = { title: 'Checkout' };

/** Placeholder until the checkout service (address, quote, payment) is wired. */
export default function CheckoutPage() {
  return (
    <div className="container py-6 md:py-8">
      <h1 className="mb-5 text-2xl font-extrabold md:text-[32px]">Checkout</h1>
      <EmptyState
        icon={CreditCard}
        title="Checkout is on its way"
        description="Address, delivery slot and payment land here once the checkout service is connected."
        action={
          <Button asChild variant="outline">
            <Link href="/cart">Back to cart</Link>
          </Button>
        }
      />
    </div>
  );
}
