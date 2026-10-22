import type { Metadata } from 'next';
import { NewTicketForm } from '@/features/support/components/support-pages';

export const metadata: Metadata = { title: 'Raise a ticket' };

export default async function NewTicketPage({ searchParams }: { searchParams: Promise<{ order?: string }> }) {
  const { order } = await searchParams;
  return (
    <div className="flex max-w-2xl flex-col gap-5">
      <div>
        <h1 className="text-2xl font-extrabold md:text-[32px]">Raise a ticket</h1>
        <p className="text-muted-foreground mt-1 text-sm">Our support team replies within a day.</p>
      </div>
      <NewTicketForm orderNumber={order} />
    </div>
  );
}
