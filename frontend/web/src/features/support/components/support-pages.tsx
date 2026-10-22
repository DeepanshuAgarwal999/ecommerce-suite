'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ChevronRight, Headphones, Info, LifeBuoy, MessageCircle, Send } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { isApiError } from '@/lib/api';
import { useUiStore } from '@/store/ui-store';
import { CATEGORY_LABELS, supportApi, supportKeys, TICKET_STATUS_LABEL, type TicketCategory, type TicketStatus } from '../api';

const STATUS_TONE: Record<TicketStatus, string> = {
  OPEN: 'bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300',
  IN_PROGRESS: 'bg-secondary text-primary',
  WAITING_ON_CUSTOMER: 'bg-secondary text-primary',
  RESOLVED: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300',
  CLOSED: 'bg-muted text-muted-foreground',
};

const dateTime = (iso: string) =>
  new Date(iso).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });

const message = (error: unknown, fallback: string) => (isApiError(error) ? error.message : fallback);

export function StatusBadge({ status }: { status: TicketStatus }) {
  return <span className={cn('rounded-full px-2.5 py-0.5 text-xs font-semibold', STATUS_TONE[status])}>{TICKET_STATUS_LABEL[status]}</span>;
}

export function TicketList() {
  const openSupport = useUiStore((state) => state.openSupport);
  const { data, isLoading } = useQuery({ queryKey: supportKeys.tickets(), queryFn: supportApi.tickets });

  return (
    <div className="flex flex-col gap-4">
      <div className="from-brand-dark to-primary flex flex-col gap-3 rounded-2xl bg-linear-to-br p-5 text-white sm:flex-row sm:items-center">
        <MessageCircle className="size-9 shrink-0" aria-hidden />
        <div className="flex-1">
          <p className="font-heading text-lg font-bold">Get instant answers</p>
          <p className="text-sm text-white/85">Our assistant checks your orders in seconds and loops in the team when needed.</p>
        </div>
        <Button variant="secondary" onClick={() => openSupport()}>
          Ask the assistant
        </Button>
      </div>

      {isLoading ? (
        Array.from({ length: 3 }, (_, index) => <Skeleton key={index} className="h-20 rounded-xl" />)
      ) : !data || data.items.length === 0 ? (
        <div className="text-muted-foreground flex flex-col items-center gap-2 rounded-2xl border border-dashed py-12 text-center text-sm">
          <LifeBuoy className="text-primary size-8" aria-hidden />
          No support tickets yet.
          <Link href="/account/support/new" className="text-primary font-semibold">
            Raise a ticket
          </Link>
        </div>
      ) : (
        <ul className="flex flex-col gap-2.5">
          {data.items.map((ticket) => (
            <li key={ticket.id}>
              <Link
                href={`/account/support/${ticket.id}`}
                className="bg-card hover:border-primary/40 flex items-center gap-3 rounded-xl border p-4 transition-colors"
              >
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-muted-foreground text-xs">
                      {ticket.ticketNumber} · {CATEGORY_LABELS[ticket.category]}
                    </span>
                    <StatusBadge status={ticket.status} />
                  </div>
                  <p className="truncate font-semibold">{ticket.subject}</p>
                  <p className="text-muted-foreground text-xs">Updated {dateTime(ticket.lastActivityAt)}</p>
                </div>
                <ChevronRight className="text-muted-foreground size-5" aria-hidden />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function TicketThreadView({ id }: { id: string }) {
  const client = useQueryClient();
  const [text, setText] = useState('');
  // Poll while open so an agent's reply appears without a refresh.
  const { data: ticket, isLoading } = useQuery({ queryKey: supportKeys.ticket(id), queryFn: () => supportApi.ticket(id), refetchInterval: 30_000 });
  const reply = useMutation({
    mutationFn: (body: string) => supportApi.reply(id, body),
    onSuccess: () => {
      setText('');
      void client.invalidateQueries({ queryKey: supportKeys.all });
    },
    onError: (error) => toast.error(message(error, 'Your reply didn’t send.')),
  });

  if (isLoading || !ticket) return <Skeleton className="h-64 rounded-2xl" />;
  const closed = ticket.status === 'CLOSED';

  return (
    <div className="flex flex-col gap-4">
      <div className="bg-card space-y-2 rounded-2xl border p-5">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-muted-foreground text-sm">{ticket.ticketNumber}</span>
          <StatusBadge status={ticket.status} />
        </div>
        <h1 className="text-xl font-extrabold md:text-2xl">{ticket.subject}</h1>
        <p className="text-muted-foreground text-sm">
          {CATEGORY_LABELS[ticket.category]} · Opened {dateTime(ticket.createdAt)}
          {ticket.orderNumber ? ` · Order ${ticket.orderNumber}` : ''}
          {ticket.agentName ? ` · Handled by ${ticket.agentName}` : ''}
        </p>
      </div>

      <ol className="flex flex-col gap-3">
        {ticket.messages.map((entry) =>
          entry.author === 'SYSTEM' ? (
            <li key={entry.id} className="text-muted-foreground flex items-center gap-2 px-2 text-xs">
              <Info className="size-3.5" aria-hidden />
              {entry.body}
            </li>
          ) : (
            <li key={entry.id} className={cn('flex items-end gap-2', entry.author === 'CUSTOMER' && 'justify-end')}>
              {entry.author === 'AGENT' ? (
                <span className="bg-secondary flex size-8 shrink-0 items-center justify-center rounded-full">
                  <Headphones className="text-primary size-4" aria-hidden />
                </span>
              ) : null}
              <div
                className={cn(
                  'max-w-[80%] space-y-1 rounded-2xl px-4 py-2.5 text-sm',
                  entry.author === 'CUSTOMER' ? 'bg-primary text-primary-foreground rounded-br-md' : 'bg-card rounded-bl-md border',
                )}
              >
                {entry.author === 'AGENT' ? <p className="text-primary text-xs font-semibold">{entry.authorName ?? 'Support'} · Nestora Support</p> : null}
                <p className="whitespace-pre-wrap">{entry.body}</p>
                <p className={cn('text-right text-[11px]', entry.author === 'CUSTOMER' ? 'text-primary-foreground/75' : 'text-muted-foreground')}>{dateTime(entry.createdAt)}</p>
              </div>
            </li>
          ),
        )}
      </ol>

      {closed ? (
        <p className="text-muted-foreground rounded-xl border border-dashed p-4 text-center text-sm">This ticket is closed. Start a new chat if you need more help.</p>
      ) : (
        <form
          className="bg-card flex items-end gap-2 rounded-2xl border p-2"
          onSubmit={(event) => {
            event.preventDefault();
            if (text.trim()) reply.mutate(text.trim());
          }}
        >
          <Textarea
            value={text}
            onChange={(event) => setText(event.target.value.slice(0, 4000))}
            placeholder={ticket.status === 'RESOLVED' ? 'Reply to reopen this ticket…' : 'Reply to support…'}
            className="min-h-11 resize-none border-0 shadow-none focus-visible:ring-0"
            aria-label="Reply"
          />
          <Button type="submit" size="icon" className="size-11 shrink-0 rounded-full" disabled={!text.trim() || reply.isPending} aria-label="Send reply">
            <Send className="size-4" />
          </Button>
        </form>
      )}
    </div>
  );
}

export function NewTicketForm({ orderNumber: initialOrder = '' }: { orderNumber?: string }) {
  const router = useRouter();
  const client = useQueryClient();
  const [category, setCategory] = useState<TicketCategory | null>(initialOrder ? 'ORDER' : null);
  const [subject, setSubject] = useState('');
  const [description, setDescription] = useState('');
  const [orderNumber, setOrderNumber] = useState(initialOrder);
  const create = useMutation({
    mutationFn: supportApi.createTicket,
    onSuccess: (ticket) => {
      toast.success(`Ticket ${ticket.ticketNumber} raised`);
      void client.invalidateQueries({ queryKey: supportKeys.tickets() });
      router.push(`/account/support/${ticket.id}`);
    },
    onError: (error) => toast.error(message(error, 'Could not raise the ticket.')),
  });
  const valid = category && subject.trim().length >= 5 && description.trim().length >= 10;

  return (
    <form
      className="bg-card flex flex-col gap-5 rounded-2xl border p-5"
      onSubmit={(event) => {
        event.preventDefault();
        if (valid && category) create.mutate({ category, subject: subject.trim(), description: description.trim(), orderNumber: orderNumber.trim() || undefined });
      }}
    >
      <fieldset className="space-y-2">
        <legend className="mb-2 text-sm font-bold">What’s it about?</legend>
        <div className="flex flex-wrap gap-2">
          {(Object.keys(CATEGORY_LABELS) as TicketCategory[]).map((value) => (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={category === value}
              onClick={() => setCategory(value)}
              className={cn(
                'rounded-full border-[1.5px] px-3 py-1.5 text-sm font-semibold transition-colors',
                category === value ? 'border-primary bg-secondary text-primary' : 'hover:border-primary/40',
              )}
            >
              {CATEGORY_LABELS[value]}
            </button>
          ))}
        </div>
      </fieldset>
      <label className="space-y-1.5 text-sm font-semibold">
        Order number <span className="text-muted-foreground font-normal">(optional)</span>
        <Input value={orderNumber} onChange={(event) => setOrderNumber(event.target.value.toUpperCase())} maxLength={24} placeholder="e.g. NS-4K7Q2M9X" />
      </label>
      <label className="space-y-1.5 text-sm font-semibold">
        Subject
        <Input value={subject} onChange={(event) => setSubject(event.target.value)} maxLength={200} placeholder="In a few words" />
      </label>
      <label className="space-y-1.5 text-sm font-semibold">
        Describe the problem
        <Textarea value={description} onChange={(event) => setDescription(event.target.value)} maxLength={4000} className="min-h-32" placeholder="What happened, and what would you like us to do?" />
      </label>
      <Button type="submit" className="h-11" disabled={!valid || create.isPending}>
        {create.isPending ? 'Raising…' : 'Raise ticket'}
      </Button>
    </form>
  );
}
