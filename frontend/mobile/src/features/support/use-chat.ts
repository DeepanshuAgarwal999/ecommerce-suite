import { useCallback, useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { haptic } from '@/lib/haptics';
import { storage } from '@/lib/storage';
import { streamChat, supportApi, supportKeys, type ChatEvent, type CreatedTicket, type TicketDraft } from './api';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  /** Live tool status while the assistant works ("Checking your orders…"). */
  status?: string;
  draft?: TicketDraft;
  ticket?: { id: string; ticketNumber: string };
  offerTicket?: boolean;
  streaming?: boolean;
  error?: boolean;
}

const LAST_CONVERSATION_KEY = 'support.last-conversation';
/** A conversation older than this starts fresh when the chat opens. */
const RESUME_WITHIN_MS = 24 * 3_600_000;

let localId = 0;
const nextId = () => `local-${++localId}`;

/**
 * Chat state for the support assistant: optimistic user bubble, a streaming
 * assistant bubble fed by SSE deltas, tool status, the ticket draft card, and
 * resume of the last conversation. Deltas are coalesced to one state update per
 * frame so a fast token stream doesn't re-render the list on every token.
 */
export function useSupportChat() {
  const client = useQueryClient();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  // Only show the history spinner when there is a recent conversation to restore.
  const [loadingHistory, setLoadingHistory] = useState(() => readLast() !== null);
  const [pendingDraft, setPendingDraft] = useState<TicketDraft | null>(null);
  const [ticket, setTicket] = useState<CreatedTicket | null>(null);
  const [feedback, setFeedback] = useState<boolean | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const bufferRef = useRef('');
  const frameRef = useRef<number | null>(null);

  // Resume the last conversation if it's recent.
  useEffect(() => {
    let cancelled = false;
    const saved = readLast();
    if (!saved) return;
    supportApi
      .conversation(saved.id)
      .then((view) => {
        if (cancelled) return;
        setConversationId(view.id);
        setPendingDraft(view.ticketId ? null : view.ticketDraft);
        setFeedback(view.helpful);
        setMessages(
          view.messages.map((message) => ({
            id: message.id,
            role: message.role === 'USER' ? 'user' : 'assistant',
            text: message.content,
            ticket: message.meta?.ticket,
            offerTicket: message.meta?.offerTicket,
          })),
        );
      })
      .catch(() => storage.remove(LAST_CONVERSATION_KEY))
      .finally(() => !cancelled && setLoadingHistory(false));
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => () => abortRef.current?.abort(), []);

  const patchStreaming = useCallback((patch: (message: ChatMessage) => ChatMessage) => {
    setMessages((current) => {
      const index = current.findIndex((message) => message.streaming);
      if (index === -1) return current;
      const next = current.slice();
      next[index] = patch(current[index]!);
      return next;
    });
  }, []);

  const flush = useCallback(() => {
    frameRef.current = null;
    const text = bufferRef.current;
    if (!text) return;
    bufferRef.current = '';
    patchStreaming((message) => ({ ...message, text: message.text + text, status: undefined }));
  }, [patchStreaming]);

  const send = useCallback(
    async (text: string) => {
      const message = text.trim();
      if (!message || busy) return;
      haptic.light();
      setBusy(true);
      setFeedback(null);
      setMessages((current) => [
        ...current,
        { id: nextId(), role: 'user', text: message },
        { id: nextId(), role: 'assistant', text: '', streaming: true, status: 'Thinking…' },
      ]);

      const controller = new AbortController();
      abortRef.current = controller;

      const onEvent = (event: ChatEvent) => {
        switch (event.type) {
          case 'conversation':
            setConversationId(event.conversationId);
            storage.set(LAST_CONVERSATION_KEY, JSON.stringify({ id: event.conversationId, at: Date.now() }));
            break;
          case 'delta':
            bufferRef.current += event.text;
            frameRef.current ??= requestAnimationFrame(flush);
            break;
          case 'status':
            flush();
            patchStreaming((current) => ({ ...current, status: event.label }));
            break;
          case 'ticket_draft':
            setPendingDraft(event.draft);
            break;
          case 'done':
            flush();
            patchStreaming((current) => ({ ...current, streaming: false, status: undefined, offerTicket: event.offerTicket }));
            break;
          case 'error':
            flush();
            patchStreaming((current) => ({
              ...current,
              streaming: false,
              status: undefined,
              error: true,
              offerTicket: event.offerTicket,
              text: current.text ? `${current.text}\n\n${event.message}` : event.message,
            }));
            haptic.error();
            break;
        }
      };

      try {
        await streamChat({ conversationId: conversationId ?? undefined, message }, onEvent, controller.signal);
      } catch {
        if (!controller.signal.aborted) {
          onEvent({ type: 'error', message: 'Couldn’t reach support. Check your connection and try again.', offerTicket: false });
        }
      } finally {
        flush();
        // Whatever happened, no bubble stays in the "typing" state.
        patchStreaming((current) => ({ ...current, streaming: false, status: undefined }));
        setBusy(false);
      }
    },
    [busy, conversationId, flush, patchStreaming],
  );

  const confirmDraft = useCallback(
    async (edits: { subject?: string; description?: string }) => {
      if (!conversationId) return null;
      const created = await supportApi.confirmDraft(conversationId, edits);
      haptic.success();
      setTicket(created);
      setPendingDraft(null);
      setMessages((current) => [
        ...current,
        {
          id: nextId(),
          role: 'assistant',
          text: `Ticket ${created.ticketNumber} raised. Our support team will reply in the ticket and notify you.`,
          ticket: { id: created.id, ticketNumber: created.ticketNumber },
        },
      ]);
      void client.invalidateQueries({ queryKey: supportKeys.tickets() });
      return created;
    },
    [conversationId, client],
  );

  const rate = useCallback(
    (helpful: boolean) => {
      if (!conversationId) return;
      haptic.selection();
      setFeedback(helpful);
      void supportApi.feedback(conversationId, helpful).catch(() => undefined);
    },
    [conversationId],
  );

  const startOver = useCallback(() => {
    abortRef.current?.abort();
    storage.remove(LAST_CONVERSATION_KEY);
    setConversationId(null);
    setMessages([]);
    setPendingDraft(null);
    setTicket(null);
    setFeedback(null);
  }, []);

  return { messages, conversationId, busy, loadingHistory, pendingDraft, ticket, feedback, send, confirmDraft, rate, startOver };
}

function readLast(): { id: string; at: number } | null {
  try {
    const raw = storage.getString(LAST_CONVERSATION_KEY);
    if (!raw) return null;
    const saved = JSON.parse(raw) as { id: string; at: number };
    return Date.now() - saved.at < RESUME_WITHIN_MS ? saved : null;
  } catch {
    return null;
  }
}
