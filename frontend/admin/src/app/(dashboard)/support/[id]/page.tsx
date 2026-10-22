'use client';

import { use, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Bot, CheckCircle2, ChevronDown, Headphones, Lock, Send, Sparkles, UserRound } from 'lucide-react';
import { cn } from 'cn';
import { StatusBadge } from '@/components/common/status-badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { useAuthStore } from '@/features/auth/store/auth-store';
import {
  CATEGORY_LABELS,
  formatMinutes,
  slaState,
  useReplyTicket,
  useTicket,
  useUpdateTicket,
  type TicketCategory,
  type TicketDetail,
  type TicketPriority,
  type TicketStatus,
} from '@/features/support/api';
import { formatDateTime, formatRelative } from '@/lib/format';

const STATUSES: TicketStatus[] = ['OPEN', 'IN_PROGRESS', 'WAITING_ON_CUSTOMER', 'RESOLVED', 'CLOSED'];
const PRIORITIES: TicketPriority[] = ['URGENT', 'HIGH', 'MEDIUM', 'LOW'];

/** One-click starters; agents edit before sending. */
const CANNED = [
  { label: 'Investigating', body: 'Thanks for your patience - I’m looking into this now and will update you here shortly.' },
  { label: 'Refund initiated', body: 'I’ve initiated your refund. It will reach your original payment method within 5-7 business days.' },
  { label: 'Need details', body: 'To help faster, could you share a photo of the item and the packaging?' },
  { label: 'Resolved?', body: 'This should now be sorted. If anything still isn’t right, just reply here and we’ll pick it straight back up.' },
];

const label = (value: string) => value.charAt(0) + value.slice(1).toLowerCase().replace(/_/g, ' ');

export default function TicketWorkspacePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { data: ticket, isLoading } = useTicket(id);

  if (isLoading || !ticket) {
    return (
      <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
        <Skeleton className="h-[520px] rounded-xl" />
        <Skeleton className="h-[520px] rounded-xl" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Link href="/support" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" aria-hidden /> Back to queue
      </Link>
      <div className="grid items-start gap-4 lg:grid-cols-[1fr_360px]">
        <Thread ticket={ticket} />
        <aside className="space-y-4">
          <Controls ticket={ticket} />
          {ticket.aiSummary ? <AiBrief summary={ticket.aiSummary} /> : null}
          <Customer ticket={ticket} />
          {ticket.transcript.length > 0 ? <Transcript transcript={ticket.transcript} /> : null}
          <Activity ticket={ticket} />
        </aside>
      </div>
    </div>
  );
}

function Thread({ ticket }: { ticket: TicketDetail }) {
  const reply = useReplyTicket(ticket.id);
  const [body, setBody] = useState('');
  const [internal, setInternal] = useState(false);
  const sla = slaState(ticket);

  return (
    <Card className="overflow-hidden">
      <CardHeader className="border-b">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-mono text-xs text-muted-foreground">{ticket.ticketNumber}</span>
          <StatusBadge status={ticket.status} />
          <StatusBadge status={ticket.priority} />
          {ticket.source === 'ASSISTANT' ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
              <Sparkles className="size-3" aria-hidden /> AI escalation
            </span>
          ) : null}
          <span
            className={cn(
              'ml-auto text-xs',
              sla.kind === 'breached' ? 'font-semibold text-destructive' : sla.kind === 'due' && sla.minutes < 60 ? 'text-status-warning' : 'text-muted-foreground',
            )}
          >
            {sla.kind === 'breached' ? `First response ${formatMinutes(sla.minutes)} overdue` : sla.kind === 'due' ? `First response due in ${formatMinutes(sla.minutes)}` : 'First response sent'}
          </span>
        </div>
        <CardTitle className="text-lg">{ticket.subject}</CardTitle>
        <p className="text-xs text-muted-foreground">
          {CATEGORY_LABELS[ticket.category]} · Opened {formatDateTime(ticket.createdAt)}
        </p>
      </CardHeader>

      <CardContent className="max-h-[560px] space-y-4 overflow-y-auto py-5">
        {ticket.messages.map((message) => {
          if (message.author === 'SYSTEM') {
            return (
              <p key={message.id} className="text-center text-xs text-muted-foreground">
                {message.body} · {formatRelative(message.createdAt)}
              </p>
            );
          }
          const agent = message.author === 'AGENT';
          return (
            <div key={message.id} className={cn('flex gap-2.5', agent && 'flex-row-reverse')}>
              <span className={cn('flex size-8 shrink-0 items-center justify-center rounded-full', agent ? 'bg-primary/10 text-primary' : 'bg-muted')}>
                {agent ? <Headphones className="size-4" aria-hidden /> : <UserRound className="size-4" aria-hidden />}
              </span>
              <div
                className={cn(
                  'max-w-[78%] space-y-1 rounded-2xl px-4 py-2.5 text-sm',
                  message.internal ? 'border border-dashed border-status-warning bg-status-warning/10' : agent ? 'bg-primary text-primary-foreground' : 'bg-muted',
                )}
              >
                <p className={cn('text-xs font-medium', agent && !message.internal ? 'text-primary-foreground/80' : 'text-muted-foreground')}>
                  {message.internal ? <Lock className="mr-1 inline size-3" aria-hidden /> : null}
                  {agent ? `${message.authorName ?? 'Agent'}${message.internal ? ' · internal note' : ''}` : 'Customer'} · {formatRelative(message.createdAt)}
                </p>
                <p className="whitespace-pre-wrap">{message.body}</p>
              </div>
            </div>
          );
        })}
      </CardContent>

      <div className={cn('space-y-3 border-t p-4', internal && 'bg-status-warning/5')}>
        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex rounded-lg border p-0.5 text-sm">
            <button type="button" onClick={() => setInternal(false)} className={cn('rounded-md px-3 py-1', !internal && 'bg-primary text-primary-foreground')}>
              Reply
            </button>
            <button type="button" onClick={() => setInternal(true)} className={cn('rounded-md px-3 py-1', internal && 'bg-status-warning text-white')}>
              Internal note
            </button>
          </div>
          {!internal
            ? CANNED.map((entry) => (
                <button key={entry.label} type="button" onClick={() => setBody(entry.body)} className="rounded-full border px-2.5 py-1 text-xs hover:border-primary/50">
                  {entry.label}
                </button>
              ))
            : null}
        </div>
        <Textarea
          value={body}
          onChange={(event) => setBody(event.target.value.slice(0, 4000))}
          placeholder={internal ? 'Only agents see this note' : 'Write to the customer - they’ll get a push notification'}
          className="min-h-28"
        />
        <div className="flex justify-end">
          <Button
            disabled={!body.trim() || reply.isPending}
            variant={internal ? 'secondary' : 'default'}
            onClick={() => reply.mutate({ body: body.trim(), internal }, { onSuccess: () => setBody('') })}
          >
            <Send className="size-4" aria-hidden />
            {internal ? 'Add note' : 'Send reply'}
          </Button>
        </div>
      </div>
    </Card>
  );
}

function Controls({ ticket }: { ticket: TicketDetail }) {
  const update = useUpdateTicket(ticket.id);
  const me = useAuthStore((state) => state.user);
  const mine = me && ticket.assigneeId === me.id;

  return (
    <Card>
      <CardContent className="space-y-3 py-1">
        <div className="flex items-center justify-between gap-2 text-sm">
          <span className="text-muted-foreground">Assignee</span>
          <span className="font-medium">{ticket.assigneeName ?? 'Unassigned'}</span>
        </div>
        <div className="flex gap-2">
          {!mine && me ? (
            <Button size="sm" className="flex-1" onClick={() => update.mutate({ assigneeId: me.id })} disabled={update.isPending}>
              Assign to me
            </Button>
          ) : null}
          {ticket.assigneeId ? (
            <Button size="sm" variant="outline" className="flex-1" onClick={() => update.mutate({ assigneeId: null })} disabled={update.isPending}>
              Release to queue
            </Button>
          ) : null}
        </div>
        <Field label="Status">
          <Select value={ticket.status} onValueChange={(value) => update.mutate({ status: value as TicketStatus })}>
            <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
            <SelectContent>
              {STATUSES.map((value) => <SelectItem key={value} value={value}>{label(value)}</SelectItem>)}
            </SelectContent>
          </Select>
        </Field>
        <Field label="Priority">
          <Select value={ticket.priority} onValueChange={(value) => update.mutate({ priority: value as TicketPriority })}>
            <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
            <SelectContent>
              {PRIORITIES.map((value) => <SelectItem key={value} value={value}>{label(value)}</SelectItem>)}
            </SelectContent>
          </Select>
        </Field>
        <Field label="Category">
          <Select value={ticket.category} onValueChange={(value) => update.mutate({ category: value as TicketCategory })}>
            <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
            <SelectContent>
              {(Object.keys(CATEGORY_LABELS) as TicketCategory[]).map((value) => <SelectItem key={value} value={value}>{CATEGORY_LABELS[value]}</SelectItem>)}
            </SelectContent>
          </Select>
        </Field>
        {ticket.status !== 'RESOLVED' && ticket.status !== 'CLOSED' ? (
          <Button variant="outline" className="w-full border-status-success text-status-success" onClick={() => update.mutate({ status: 'RESOLVED' })} disabled={update.isPending}>
            <CheckCircle2 className="size-4" aria-hidden /> Mark resolved
          </Button>
        ) : null}
      </CardContent>
    </Card>
  );
}

function Field({ label: text, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <p className="text-xs text-muted-foreground">{text}</p>
      {children}
    </div>
  );
}

function AiBrief({ summary }: { summary: string }) {
  return (
    <Card className="border-primary/30 bg-primary/5">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm">
          <Sparkles className="size-4 text-primary" aria-hidden /> AI brief
        </CardTitle>
      </CardHeader>
      <CardContent className="text-sm whitespace-pre-wrap">{summary}</CardContent>
    </Card>
  );
}

function Customer({ ticket }: { ticket: TicketDetail }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">Customer</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 text-sm">
        <p className="font-medium">{ticket.userMobile ?? 'Unknown'}</p>
        {ticket.orderNumber ? (
          <p>
            Order{' '}
            {ticket.orderId ? (
              <Link href={`/orders/${ticket.orderId}`} className="font-mono text-primary hover:underline">
                {ticket.orderNumber}
              </Link>
            ) : (
              <span className="font-mono">{ticket.orderNumber}</span>
            )}
          </p>
        ) : null}
        {ticket.customerHistory.length > 0 ? (
          <div className="space-y-1 pt-1">
            <p className="text-xs text-muted-foreground">Previous tickets</p>
            {ticket.customerHistory.map((entry) => (
              <Link key={entry.id} href={`/support/${entry.id}`} className="flex items-center justify-between gap-2 rounded-md px-1 py-0.5 hover:bg-muted">
                <span className="truncate">{entry.subject}</span>
                <StatusBadge status={entry.status} />
              </Link>
            ))}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">First ticket from this customer.</p>
        )}
      </CardContent>
    </Card>
  );
}

function Transcript({ transcript }: { transcript: TicketDetail['transcript'] }) {
  const [open, setOpen] = useState(false);
  return (
    <Card>
      <button type="button" onClick={() => setOpen((value) => !value)} className="flex w-full items-center justify-between px-6 py-3 text-left text-sm font-semibold">
        <span className="flex items-center gap-2">
          <Bot className="size-4 text-primary" aria-hidden /> Assistant chat ({transcript.length})
        </span>
        <ChevronDown className={cn('size-4 transition-transform', open && 'rotate-180')} aria-hidden />
      </button>
      {open ? (
        <CardContent className="max-h-80 space-y-2 overflow-y-auto text-xs">
          {transcript.map((entry) => (
            <div key={entry.id} className={cn('rounded-lg px-3 py-2', entry.role === 'USER' ? 'bg-muted' : 'bg-primary/5')}>
              <p className="mb-0.5 font-semibold">{entry.role === 'USER' ? 'Customer' : 'Assistant'}</p>
              <p className="whitespace-pre-wrap">{entry.content}</p>
            </div>
          ))}
        </CardContent>
      ) : null}
    </Card>
  );
}

function Activity({ ticket }: { ticket: TicketDetail }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">Activity</CardTitle>
      </CardHeader>
      <CardContent>
        <ol className="space-y-2 text-xs">
          {ticket.events.map((event) => (
            <li key={event.id} className="flex justify-between gap-3">
              <span>
                {label(event.type)}
                {event.data && 'to' in event.data && event.data['to'] ? ` → ${label(String(event.data['to']))}` : ''}
              </span>
              <span className="shrink-0 text-muted-foreground">{formatRelative(event.createdAt)}</span>
            </li>
          ))}
        </ol>
      </CardContent>
    </Card>
  );
}
