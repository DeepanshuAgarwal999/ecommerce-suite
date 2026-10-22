'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { streamChat, supportApi, supportKeys, type ChatEvent, type CreatedTicket, type TicketDraft } from './api';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  status?: string;
  ticket?: { id: string; ticketNumber: string };
  offerTicket?: boolean;
  streaming?: boolean;
  error?: boolean;
}

const LAST_KEY = 'support.last-conversation';
const RESUME_WITHIN_MS = 24 * 3_600_000;
let localId = 0;
const nextId = () => `local-${++localId}`;

function readLast(): { id: string; at: number } | null {
  try {
    const raw = localStorage.getItem(LAST_KEY);
    if (!raw) return null;
    const saved = JSON.parse(raw) as { id: string; at: number };
    return Date.now() - saved.at < RESUME_WITHIN_MS ? saved : null;
  } catch {
    return null;
  }
}

/**
 * Support chat state - the web twin of the app's useSupportChat. Streamed deltas
 * are coalesced per animation frame so long answers don't re-render per token.
 * `enabled` defers the history fetch until the panel is first opened.
 */
export function useSupportChat(enabled: boolean) {
  const client = useQueryClient();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [pendingDraft, setPendingDraft] = useState<TicketDraft | null>(null);
  const [ticket, setTicket] = useState<CreatedTicket | null>(null);
  const [feedback, setFeedback] = useState<boolean | null>(null);
  const [restored, setRestored] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const bufferRef = useRef('');
  const frameRef = useRef<number | null>(null);

  useEffect(() => {
    if (!enabled || restored) return;
    let cancelled = false;
    const saved = readLast();
    const done = () => !cancelled && setRestored(true);
    if (!saved) {
      queueMicrotask(done);
      return;
    }
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
      .catch(() => localStorage.removeItem(LAST_KEY))
      .finally(done);
    return () => {
      cancelled = true;
    };
  }, [enabled, restored]);

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
            try {
              localStorage.setItem(LAST_KEY, JSON.stringify({ id: event.conversationId, at: Date.now() }));
            } catch {
              // storage blocked - the chat still works, it just won't resume
            }
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
            break;
        }
      };

      try {
        await streamChat({ conversationId: conversationId ?? undefined, message }, onEvent, controller.signal);
      } catch {
        if (!controller.signal.aborted) onEvent({ type: 'error', message: 'Couldn’t reach support. Check your connection and try again.', offerTicket: false });
      } finally {
        flush();
        patchStreaming((current) => ({ ...current, streaming: false, status: undefined }));
        setBusy(false);
      }
    },
    [busy, conversationId, flush, patchStreaming],
  );

  const confirmDraft = useCallback(
    async (edits: { subject?: string; description?: string }) => {
      if (!conversationId) return;
      const created = await supportApi.confirmDraft(conversationId, edits);
      setTicket(created);
      setPendingDraft(null);
      setMessages((current) => [
        ...current,
        { id: nextId(), role: 'assistant', text: `Ticket ${created.ticketNumber} raised. Our team will reply in the ticket and notify you.`, ticket: { id: created.id, ticketNumber: created.ticketNumber } },
      ]);
      void client.invalidateQueries({ queryKey: supportKeys.tickets() });
    },
    [conversationId, client],
  );

  const rate = useCallback(
    (helpful: boolean) => {
      if (!conversationId) return;
      setFeedback(helpful);
      void supportApi.feedback(conversationId, helpful).catch(() => undefined);
    },
    [conversationId],
  );

  const startOver = useCallback(() => {
    abortRef.current?.abort();
    try {
      localStorage.removeItem(LAST_KEY);
    } catch {
      // ignore
    }
    setConversationId(null);
    setMessages([]);
    setPendingDraft(null);
    setTicket(null);
    setFeedback(null);
  }, []);

  return { messages, conversationId, busy, restored, pendingDraft, ticket, feedback, send, confirmDraft, rate, startOver };
}
