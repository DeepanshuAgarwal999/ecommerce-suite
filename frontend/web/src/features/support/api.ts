import { env } from '@/config/env';
import { api } from '@/lib/api';
import { getAccessToken } from '@/lib/api/auth-bridge';
import { refreshSession } from '@/lib/api/client';
import { getVisitorId } from '@/lib/visitor';
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

/** Server-sent events from POST /support/chat (api-gateway SupportController). */
export type ChatEvent =
  | { type: 'conversation'; conversationId: string }
  | { type: 'status'; label: string }
  | { type: 'delta'; text: string }
  | { type: 'ticket_draft'; draft: TicketDraft }
  | { type: 'done'; conversationId: string; offerTicket: boolean }
  | { type: 'error'; message: string; offerTicket: boolean };

export interface ConversationView {
  id: string;
  ticketId: string | null;
  ticketDraft: TicketDraft | null;
  helpful: boolean | null;
  messages: {
    id: string;
    role: 'USER' | 'ASSISTANT';
    content: string;
    meta: { ticket?: { id: string; ticketNumber: string }; offerTicket?: boolean } | null;
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

export interface TicketThread extends Omit<TicketSummary, 'lastActivityAt'> {
  resolvedAt: string | null;
  agentName: string | null;
  messages: { id: string; author: 'CUSTOMER' | 'AGENT' | 'SYSTEM'; authorName: string | null; body: string; createdAt: string }[];
}

export interface CreatedTicket {
  id: string;
  ticketNumber: string;
  status: TicketStatus;
}

export const TICKET_STATUS_LABEL: Record<TicketStatus, string> = {
  OPEN: 'Open',
  IN_PROGRESS: 'In progress',
  WAITING_ON_CUSTOMER: 'Awaiting your reply',
  RESOLVED: 'Resolved',
  CLOSED: 'Closed',
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

export const supportKeys = {
  all: ['support'] as const,
  status: () => [...supportKeys.all, 'status'] as const,
  tickets: () => [...supportKeys.all, 'tickets'] as const,
  ticket: (id: string) => [...supportKeys.all, 'ticket', id] as const,
};

export const supportApi = {
  status: () => api.get<{ assistantAvailable: boolean }>('/support/status'),
  conversation: (id: string) => api.get<ConversationView>(`/support/conversations/${id}`),
  confirmDraft: (id: string, edits: { subject?: string; description?: string }) =>
    api.post<CreatedTicket>(`/support/conversations/${id}/ticket`, edits),
  feedback: (id: string, helpful: boolean) => api.post(`/support/conversations/${id}/feedback`, { helpful }),
  tickets: () => api.get<Paginated<TicketSummary>>('/support/tickets', { searchParams: { limit: 50 } }),
  ticket: (id: string) => api.get<TicketThread>(`/support/tickets/${id}`),
  createTicket: (input: { category: TicketCategory; subject: string; description: string; orderNumber?: string }) =>
    api.post<CreatedTicket>('/support/tickets', input),
  reply: (id: string, body: string) => api.post(`/support/tickets/${id}/messages`, { body }),
};

/**
 * One assistant turn over SSE. Plain fetch + ReadableStream rather than
 * EventSource, because EventSource can't POST a body or send the bearer token.
 */
export async function streamChat(
  input: { conversationId?: string; message: string },
  onEvent: (event: ChatEvent) => void,
  signal: AbortSignal,
  retried = false,
): Promise<void> {
  const token = getAccessToken();
  const visitorId = getVisitorId();
  const response = await fetch(`${env.NEXT_PUBLIC_API_URL.replace(/\/+$/, '')}/support/chat`, {
    method: 'POST',
    signal,
    credentials: 'include',
    headers: {
      Accept: 'text/event-stream',
      'Content-Type': 'application/json',
      'x-client': 'WEB',
      'x-platform': 'web',
      ...(visitorId ? { 'x-visitor-id': visitorId } : {}),
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
          // skip a malformed frame
        }
      }
      boundary = buffer.indexOf('\n\n');
    }
  }
}
