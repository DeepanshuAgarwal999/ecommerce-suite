import type { Metadata } from 'next';
import { TicketThreadView } from '@/features/support/components/support-pages';

export const metadata: Metadata = { title: 'Support ticket' };

export default async function TicketPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <div className="max-w-3xl">
      <TicketThreadView id={id} />
    </div>
  );
}
