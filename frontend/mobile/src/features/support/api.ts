import { fetch as streamingFetch } from 'expo/fetch';
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from '@/components/ui/toast';
import { useIsSignedIn } from '@/features/auth/session';
import { API_URL } from '@/config/env';
import { api, errorMessage } from '@/lib/api';
import { getAccessToken } from '@/lib/api/auth-bridge';
import { refreshSession } from '@/lib/api/client';
import { clientHeaders } from '@/lib/device';
import type { Paginated } from '@/types';

export type TicketCategory = 'ORDER' | 'DELIVERY' | 'PAYMENT_REFUND' | 'RETURN_EXCHANGE' | 'PRODUCT' | 'ACCOUNT' | 'OTHER';
export type TicketPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
export type TicketStatus = 'OPEN' | 'IN_PROGRESS' | 'WAITING_ON_CUSTOMER' | 'RESOLVED' | 'CLOSED';

export interface TicketDraft {
  category: TicketCategory;
  priority: TicketPriority;
  subject: string;
  description: string;
  orderNumber?: string;
  summary: string;
}

/** Server-sent events from POST /support/chat (gateway SupportController). */
export type ChatEvent =
  | { type: 'conversation'; conversationId: string }
  | { type: 'status'; label: string }
  | { type: 'delta'; text: string }
  | { type: 'ticket_draft'; draft: TicketDraft }
  | { type: 'done'; conversationId: string; offerTicket: boolean }
  | { type: 'error'; message: string; offerTicket: boolean };

export interface ConversationView {
  id: string;
  title: string;
  status: 'ACTIVE' | 'RESOLVED' | 'ESCALATED' | 'CLOSED';
  ticketId: string | null;
  ticketDraft: TicketDraft | null;
  helpful: boolean | null;
  messages: {
    id: string;
    role: 'USER' | 'ASSISTANT';
    content: string;
    meta: { ticketDraft?: TicketDraft; ticket?: { id: string; ticketNumber: string }; offerTicket?: boolean } | null;
    createdAt: string;
  }[];
}

export interface TicketSummary {
  id: string;
  ticketNumber: string;
  subject: string;
  category: TicketCategory;
  status: TicketStatus;
  orderNumber: string | null;
  createdAt: string;
  lastActivityAt: string;
}

export interface TicketThread {
  id: string;
  ticketNumber: string;
  subject: string;
  category: TicketCategory;
  status: TicketStatus;
  orderNumber: string | null;
  createdAt: string;
  resolvedAt: string | null;
  agentName: string | null;
  messages: { id: string; author: 'CUSTOMER' | 'AGENT' | 'SYSTEM'; authorName: string | null; body: string; createdAt: string }[];
}

export interface CreatedTicket {
  id: string;
  ticketNumber: string;
  status: TicketStatus;
}

export const TICKET_STATUS_META: Record<TicketStatus, { label: string; tone: 'primary' | 'warning' | 'success' | 'mutedForeground' }> = {
  OPEN: { label: 'Open', tone: 'warning' },
  IN_PROGRESS: { label: 'In progress', tone: 'primary' },
  WAITING_ON_CUSTOMER: { label: 'Awaiting your reply', tone: 'primary' },
  RESOLVED: { label: 'Resolved', tone: 'success' },
  CLOSED: { label: 'Closed', tone: 'mutedForeground' },
};

export const CATEGORY_LABELS: Record<TicketCategory, string> = {
  ORDER: 'Order issue',
  DELIVERY: 'Delivery',
  PAYMENT_REFUND: 'Payment or refund',
  RETURN_EXCHANGE: 'Return or exchange',
  PRODUCT: 'Product question',
  ACCOUNT: 'Account',
  OTHER: 'Something else',
};

export const supportApi = {
  status: () => api.get<{ assistantAvailable: boolean }>('/support/status'),
  conversation: (id: string) => api.get<ConversationView>(`/support/conversations/${id}`),
  confirmDraft: (id: string, edits: { subject?: string; description?: string }) =>
    api.post<CreatedTicket>(`/support/conversations/${id}/ticket`, edits),
  feedback: (id: string, helpful: boolean) => api.post(`/support/conversations/${id}/feedback`, { helpful }),
  tickets: (page: number) => api.get<Paginated<TicketSummary>>('/support/tickets', { searchParams: { page, limit: 20 } }),
  ticket: (id: string) => api.get<TicketThread>(`/support/tickets/${id}`),
  createTicket: (input: { category: TicketCategory; subject: string; description: string; orderNumber?: string }) =>
    api.post<CreatedTicket>('/support/tickets', input),
  reply: (id: string, body: string) => api.post(`/support/tickets/${id}/messages`, { body }),
};

/**
 * Streams one assistant turn. `expo/fetch` is used because React Native's
 * built-in fetch can't read a response body incrementally. One silent retry
 * through a token refresh on 401, like the regular client.
 */
export async function streamChat(
  input: { conversationId?: string; message: string },
  onEvent: (event: ChatEvent) => void,
  signal: AbortSignal,
  retried = false,
): Promise<void> {
  const token = getAccessToken();
  const response = await streamingFetch(`${API_URL}/support/chat`, {
    method: 'POST',
    signal,
    headers: {
      Accept: 'text/event-stream',
      'Content-Type': 'application/json',
      ...clientHeaders,
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(input),
  });

  if (response.status === 401 && !retried && (await refreshSession())) {
    return streamChat(input, onEvent, signal, true);
  }
  if (!response.ok || !response.body) {
    let message = response.status === 429 ? 'You’re sending messages quickly - give it a moment.' : 'Couldn’t reach support. Check your connection and try again.';
    try {
      const payload = (await response.json()) as { error?: { message?: string } };
      if (response.status !== 429 && payload?.error?.message) message = payload.error.message;
    } catch {
      // not JSON
    }
    onEvent({ type: 'error', message, offerTicket: response.status !== 429 });
    return;
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    // SSE frames are separated by a blank line; keep any partial frame for the next chunk.
    let boundary = buffer.indexOf('\n\n');
    while (boundary !== -1) {
      const frame = buffer.slice(0, boundary);
      buffer = buffer.slice(boundary + 2);
      const data = frame
        .split('\n')
        .filter((line) => line.startsWith('data:'))
        .map((line) => line.slice(5).trimStart())
        .join('\n');
      if (data) {
        try {
          onEvent(JSON.parse(data) as ChatEvent);
        } catch {
          // A malformed frame is skipped rather than ending the stream.
        }
      }
      boundary = buffer.indexOf('\n\n');
    }
  }
}

export const supportKeys = {
  all: ['support'] as const,
  status: () => [...supportKeys.all, 'status'] as const,
  tickets: () => [...supportKeys.all, 'tickets'] as const,
  ticket: (id: string) => [...supportKeys.all, 'ticket', id] as const,
};

export function useAssistantStatus() {
  const signedIn = useIsSignedIn();
  return useQuery({ queryKey: supportKeys.status(), queryFn: supportApi.status, enabled: signedIn, staleTime: 5 * 60_000 });
}

export function useMyTickets() {
  const signedIn = useIsSignedIn();
  return useInfiniteQuery({
    queryKey: supportKeys.tickets(),
    queryFn: ({ pageParam }) => supportApi.tickets(pageParam),
    initialPageParam: 1,
    getNextPageParam: (last) => (last.meta.hasNext ? last.meta.page + 1 : undefined),
    enabled: signedIn,
  });
}

/** Polls every 30 s while the screen is open so agent replies appear without a refresh. */
export function useTicket(id: string) {
  return useQuery({ queryKey: supportKeys.ticket(id), queryFn: () => supportApi.ticket(id), enabled: Boolean(id), refetchInterval: 30_000 });
}

export function useTicketReply(id: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (body: string) => supportApi.reply(id, body),
    onSuccess: () => void client.invalidateQueries({ queryKey: supportKeys.all }),
    onError: (error) => toast.error(errorMessage(error, 'Your reply didn’t send. Please try again.')),
  });
}

export function useCreateTicket() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: supportApi.createTicket,
    onSuccess: () => void client.invalidateQueries({ queryKey: supportKeys.tickets() }),
    onError: (error) => toast.error(errorMessage(error, 'Could not raise the ticket.')),
  });
}
