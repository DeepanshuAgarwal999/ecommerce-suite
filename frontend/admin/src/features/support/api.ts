'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api, endpoints, isApiError, queryKeys } from '@/lib/api';
import type { Paginated } from '@/types/pagination';

export type TicketStatus = 'OPEN' | 'IN_PROGRESS' | 'WAITING_ON_CUSTOMER' | 'RESOLVED' | 'CLOSED';
export type TicketPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
export type TicketCategory = 'ORDER' | 'DELIVERY' | 'PAYMENT_REFUND' | 'RETURN_EXCHANGE' | 'PRODUCT' | 'ACCOUNT' | 'OTHER';

export interface Ticket {
  id: string;
  ticketNumber: string;
  userId: string;
  userMobile: string | null;
  conversationId: string | null;
  category: TicketCategory;
  priority: TicketPriority;
  status: TicketStatus;
  subject: string;
  description: string;
  orderNumber: string | null;
  orderId: string | null;
  aiSummary: string | null;
  source: 'ASSISTANT' | 'FORM';
  assigneeId: string | null;
  assigneeName: string | null;
  slaDueAt: string;
  firstResponseAt: string | null;
  resolvedAt: string | null;
  lastActivityAt: string;
  createdAt: string;
}

export interface TicketDetail extends Ticket {
  messages: { id: string; author: 'CUSTOMER' | 'AGENT' | 'SYSTEM'; authorName: string | null; body: string; internal: boolean; createdAt: string }[];
  events: { id: string; type: string; actorId: string | null; data: Record<string, unknown> | null; createdAt: string }[];
  transcript: { id: string; role: 'USER' | 'ASSISTANT'; content: string; createdAt: string }[];
  customerHistory: { id: string; ticketNumber: string; subject: string; status: TicketStatus; createdAt: string }[];
}

export interface SupportSummary {
  byStatus: Partial<Record<TicketStatus, number>>;
  activeByPriority: Partial<Record<TicketPriority, number>>;
  assignedToMe: number;
  unassigned: number;
  slaBreached: number;
  resolvedToday: number;
  avgFirstResponseMinutes: number | null;
}

export interface TicketQuery {
  status?: TicketStatus | 'ACTIVE';
  priority?: TicketPriority;
  category?: TicketCategory;
  assignee?: string;
  q?: string;
  breached?: boolean;
  page?: number;
  limit?: number;
}

export const CATEGORY_LABELS: Record<TicketCategory, string> = {
  ORDER: 'Order',
  DELIVERY: 'Delivery',
  PAYMENT_REFUND: 'Payment / refund',
  RETURN_EXCHANGE: 'Return / exchange',
  PRODUCT: 'Product',
  ACCOUNT: 'Account',
  OTHER: 'Other',
};

const supportApi = {
  summary: () => api.get<SupportSummary>(endpoints.admin.supportSummary),
  list: (query: TicketQuery) => api.get<Paginated<Ticket>>(endpoints.admin.supportTickets, { searchParams: { ...query } }),
  get: (id: string) => api.get<TicketDetail>(endpoints.admin.supportTicket(id)),
  claimNext: () => api.post<{ ticket: Ticket | null }>(endpoints.admin.supportClaimNext, {}),
  reply: (id: string, body: string, internal: boolean) => api.post(endpoints.admin.supportTicketMessages(id), { body, internal }),
  update: (id: string, changes: Partial<{ status: TicketStatus; priority: TicketPriority; category: TicketCategory; assigneeId: string | null }>) =>
    api.patch<Ticket>(endpoints.admin.supportTicket(id), changes),
};

const errorText = (error: unknown, fallback: string) => (isApiError(error) ? error.message : fallback);

/** Queue views refresh every 30 s so new tickets and SLA clocks stay current on a wall screen. */
export function useSupportSummary() {
  return useQuery({ queryKey: queryKeys.support.summary(), queryFn: supportApi.summary, refetchInterval: 30_000 });
}

export function useTickets(query: TicketQuery) {
  return useQuery({
    queryKey: queryKeys.support.list({ ...query }),
    queryFn: () => supportApi.list(query),
    placeholderData: (previous) => previous,
    refetchInterval: 30_000,
  });
}

export function useTicket(id: string) {
  return useQuery({ queryKey: queryKeys.support.detail(id), queryFn: () => supportApi.get(id), refetchInterval: 20_000 });
}

export function useClaimNext() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: supportApi.claimNext,
    onSuccess: () => void client.invalidateQueries({ queryKey: queryKeys.support.all }),
    onError: (error) => toast.error(errorText(error, 'Could not claim a ticket.')),
  });
}

export function useReplyTicket(id: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ body, internal }: { body: string; internal: boolean }) => supportApi.reply(id, body, internal),
    onSuccess: (_result, { internal }) => {
      toast.success(internal ? 'Note added' : 'Reply sent - the customer has been notified');
      void client.invalidateQueries({ queryKey: queryKeys.support.all });
    },
    onError: (error) => toast.error(errorText(error, 'Could not send the reply.')),
  });
}

export function useUpdateTicket(id: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (changes: Parameters<typeof supportApi.update>[1]) => supportApi.update(id, changes),
    onSuccess: () => void client.invalidateQueries({ queryKey: queryKeys.support.all }),
    onError: (error) => toast.error(errorText(error, 'Could not update the ticket.')),
  });
}

/** SLA state for the first response: met, breached, or time left. */
export function slaState(ticket: Pick<Ticket, 'slaDueAt' | 'firstResponseAt' | 'status'>, now = Date.now()) {
  if (ticket.firstResponseAt) {
    return { kind: new Date(ticket.firstResponseAt) <= new Date(ticket.slaDueAt) ? ('met' as const) : ('late' as const), minutes: 0 };
  }
  if (ticket.status === 'RESOLVED' || ticket.status === 'CLOSED') return { kind: 'met' as const, minutes: 0 };
  const minutes = Math.round((new Date(ticket.slaDueAt).getTime() - now) / 60_000);
  return minutes < 0 ? { kind: 'breached' as const, minutes: -minutes } : { kind: 'due' as const, minutes };
}

export function formatMinutes(minutes: number): string {
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 48) return `${hours}h ${minutes % 60}m`;
  return `${Math.floor(hours / 24)}d`;
}
