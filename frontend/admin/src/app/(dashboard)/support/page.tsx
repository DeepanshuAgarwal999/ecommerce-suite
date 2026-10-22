'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { ColumnDef } from '@tanstack/react-table';
import { AlarmClock, CheckCheck, Inbox, Sparkles, Timer, UserCheck } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from 'cn';
import { DataTable } from '@/components/common/data-table';
import { ListToolbar } from '@/components/common/list-toolbar';
import { StatusBadge } from '@/components/common/status-badge';
import { PageHeader } from '@/components/layout/page-header';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { KpiCard } from '@/features/dashboard/components/kpi-card';
import {
  CATEGORY_LABELS,
  formatMinutes,
  slaState,
  useClaimNext,
  useSupportSummary,
  useTickets,
  type Ticket,
  type TicketPriority,
  type TicketQuery,
} from '@/features/support/api';
import { useDebouncedValue } from '@/lib/hooks/use-debounced-value';
import { formatRelative } from '@/lib/format';

type View = 'active' | 'mine' | 'unassigned' | 'breached' | 'resolved' | 'all';

const VIEWS: { value: View; label: string; query: TicketQuery }[] = [
  { value: 'active', label: 'Active', query: { status: 'ACTIVE' } },
  { value: 'mine', label: 'My tickets', query: { status: 'ACTIVE', assignee: 'me' } },
  { value: 'unassigned', label: 'Unassigned', query: { status: 'OPEN', assignee: 'unassigned' } },
  { value: 'breached', label: 'SLA breached', query: { breached: true } },
  { value: 'resolved', label: 'Resolved', query: { status: 'RESOLVED' } },
  { value: 'all', label: 'All', query: {} },
];

function SlaCell({ ticket }: { ticket: Ticket }) {
  const sla = slaState(ticket);
  if (sla.kind === 'met') return <span className="text-xs text-status-success">Responded</span>;
  if (sla.kind === 'late') return <span className="text-xs text-status-warning">Responded late</span>;
  if (sla.kind === 'breached') {
    return <span className="inline-flex items-center gap-1 text-xs font-semibold text-destructive"><AlarmClock className="size-3.5" aria-hidden />{formatMinutes(sla.minutes)} over</span>;
  }
  return <span className={cn('text-xs tabular-nums', sla.minutes < 60 ? 'font-semibold text-status-warning' : 'text-muted-foreground')}>{formatMinutes(sla.minutes)} left</span>;
}

const columns: ColumnDef<Ticket>[] = [
  {
    accessorKey: 'ticketNumber',
    header: 'Ticket',
    cell: ({ row }) => (
      <div className="min-w-0 max-w-[340px]">
        <p className="flex items-center gap-1.5 font-mono text-xs text-muted-foreground">
          {row.original.ticketNumber}
          {row.original.source === 'ASSISTANT' ? <Sparkles className="size-3 text-primary" aria-label="Escalated by the AI assistant" /> : null}
        </p>
        <p className="truncate font-medium">{row.original.subject}</p>
      </div>
    ),
  },
  { accessorKey: 'priority', header: 'Priority', cell: ({ row }) => <StatusBadge status={row.original.priority} /> },
  { accessorKey: 'status', header: 'Status', cell: ({ row }) => <StatusBadge status={row.original.status} /> },
  { accessorKey: 'category', header: 'Category', cell: ({ row }) => <span className="text-sm">{CATEGORY_LABELS[row.original.category]}</span> },
  { id: 'sla', header: 'First response', cell: ({ row }) => <SlaCell ticket={row.original} /> },
  {
    accessorKey: 'assigneeName',
    header: 'Assignee',
    cell: ({ row }) => <span className={cn('text-sm', !row.original.assigneeName && 'text-muted-foreground italic')}>{row.original.assigneeName ?? 'Unassigned'}</span>,
  },
  { accessorKey: 'userMobile', header: 'Customer', cell: ({ row }) => <span className="text-sm text-muted-foreground">{row.original.userMobile ?? '—'}</span> },
  { accessorKey: 'lastActivityAt', header: 'Updated', cell: ({ row }) => <span className="text-sm text-muted-foreground">{formatRelative(row.original.lastActivityAt)}</span> },
];

/**
 * The support queue. Agents either pick from the list or press "Claim next",
 * which atomically assigns the highest-priority, tightest-SLA open ticket - two
 * agents claiming at once always get different tickets.
 */
export default function SupportQueuePage() {
  const router = useRouter();
  const [view, setView] = useState<View>('active');
  const [priority, setPriority] = useState<TicketPriority | 'ALL'>('ALL');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const debouncedSearch = useDebouncedValue(search);

  const summary = useSupportSummary();
  const claim = useClaimNext();
  const query: TicketQuery = {
    ...VIEWS.find((entry) => entry.value === view)!.query,
    ...(priority !== 'ALL' ? { priority } : {}),
    q: debouncedSearch || undefined,
    page,
    limit: 25,
  };
  const tickets = useTickets(query);
  const stats = summary.data;

  return (
    <>
      <PageHeader
        title="Support"
        description="Tickets escalated by the AI assistant and raised by customers, in queue order: priority, then SLA."
        actions={
          <Button
            onClick={() =>
              claim.mutate(undefined, {
                onSuccess: ({ ticket }) => {
                  if (!ticket) {
                    toast.info('The queue is empty - nice work.');
                    return;
                  }
                  toast.success(`Assigned ${ticket.ticketNumber} to you`);
                  router.push(`/support/${ticket.id}`);
                },
              })
            }
            disabled={claim.isPending}
          >
            <UserCheck className="size-4" aria-hidden />
            {claim.isPending ? 'Claiming…' : 'Claim next ticket'}
          </Button>
        }
      />

      <div className="mb-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <KpiCard label="Unassigned in queue" value={stats?.unassigned ?? 0} icon={Inbox} isLoading={summary.isLoading} tone={(stats?.unassigned ?? 0) > 0 ? 'warning' : 'default'} />
        <KpiCard label="Assigned to me" value={stats?.assignedToMe ?? 0} icon={UserCheck} isLoading={summary.isLoading} />
        <KpiCard label="SLA breached" value={stats?.slaBreached ?? 0} icon={AlarmClock} isLoading={summary.isLoading} tone={(stats?.slaBreached ?? 0) > 0 ? 'destructive' : 'default'} />
        <KpiCard label="Resolved today" value={stats?.resolvedToday ?? 0} icon={CheckCheck} isLoading={summary.isLoading} />
        <KpiCard label="Avg first response (mins, 7d)" value={stats?.avgFirstResponseMinutes ?? 0} icon={Timer} isLoading={summary.isLoading} />
      </div>

      <Tabs
        value={view}
        onValueChange={(value) => {
          setView(value as View);
          setPage(1);
        }}
        className="mb-4"
      >
        <TabsList>
          {VIEWS.map((entry) => (
            <TabsTrigger key={entry.value} value={entry.value}>
              {entry.label}
              {entry.value === 'breached' && (stats?.slaBreached ?? 0) > 0 ? (
                <span className="ml-1.5 rounded-full bg-destructive px-1.5 text-[10px] font-semibold text-white">{stats!.slaBreached}</span>
              ) : null}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      <ListToolbar
        search={search}
        onSearchChange={(value) => {
          setSearch(value);
          setPage(1);
        }}
        placeholder="Search ticket, order number, mobile or subject…"
      >
        <Select
          value={priority}
          onValueChange={(value) => {
            setPriority(value as TicketPriority | 'ALL');
            setPage(1);
          }}
        >
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All priorities</SelectItem>
            {(['URGENT', 'HIGH', 'MEDIUM', 'LOW'] as TicketPriority[]).map((value) => (
              <SelectItem key={value} value={value}>
                {value.charAt(0) + value.slice(1).toLowerCase()}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </ListToolbar>

      <DataTable
        columns={columns}
        data={tickets.data?.items ?? []}
        meta={tickets.data?.meta}
        isLoading={tickets.isLoading}
        onPageChange={setPage}
        onRowClick={(ticket) => router.push(`/support/${ticket.id}`)}
        emptyLabel="No tickets in this view."
      />
    </>
  );
}
