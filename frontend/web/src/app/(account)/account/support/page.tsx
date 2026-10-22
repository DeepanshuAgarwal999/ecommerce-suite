import type { Metadata } from 'next';
import Link from 'next/link';
import { TicketList } from '@/features/support/components/support-pages';

export const metadata: Metadata = { title: 'Support' };

export default function SupportPage() {
  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold md:text-[32px]">Help & support</h1>
          <p className="text-muted-foreground mt-1 text-sm">Your conversations with our support team.</p>
        </div>
        <Link href="/account/support/new" className="text-primary text-sm font-semibold">
          Raise a ticket
        </Link>
      </div>
      <TicketList />
    </div>
  );
}
