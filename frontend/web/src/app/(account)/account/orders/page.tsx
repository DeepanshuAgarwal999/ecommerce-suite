import type { Metadata } from 'next';
import Link from 'next/link';
import { Package } from 'lucide-react';
import { EmptyState } from '@/components/common/empty-state';
import { Button } from '@/components/ui/button';

export const metadata: Metadata = { title: 'Orders' };

/** Placeholder until the order service list endpoint is wired via features/orders. */
export default function OrdersPage() {
  return (
    <div className="flex flex-col gap-5">
      <h1 className="text-2xl font-extrabold md:text-[32px]">Orders</h1>
      <EmptyState
        icon={Package}
        title="No orders yet"
        description="Your orders and their delivery status will show up here."
        action={
          <Button asChild>
            <Link href="/">Start shopping</Link>
          </Button>
        }
      />
    </div>
  );
}
