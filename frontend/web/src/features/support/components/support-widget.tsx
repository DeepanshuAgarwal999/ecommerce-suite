'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowUp,
  BadgeCheck,
  Bot,
  Inbox,
  LifeBuoy,
  MessageCircle,
  Package,
  Pencil,
  RotateCcw,
  SquarePen,
  ThumbsDown,
  ThumbsUp,
  Truck,
  UserRound,
  Wallet,
  X,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useIsSignedIn } from '@/features/auth/hooks/use-session';
import { useUiStore } from '@/store/ui-store';
import { CATEGORY_LABELS, supportApi, supportKeys, type CreatedTicket, type TicketDraft } from '../api';
import { useSupportChat, type ChatMessage } from '../use-support-chat';

const SUGGESTIONS = [
  { label: 'Where is my order?', icon: Truck },
  { label: 'I want to return an item', icon: RotateCcw },
  { label: 'Payment deducted but order failed', icon: Wallet },
  { label: 'Cancel my order', icon: Package },
  { label: 'Talk to a human', icon: UserRound },
];

const HIDDEN_ON = ['/checkout'];

/**
 * Site-wide support: a floating launcher and the Nestora Assistant panel
 * (bottom-right card on desktop, full screen on phones). The assistant answers
 * from the shopper's live orders and, when it can't resolve something, drafts a
 * ticket the shopper confirms. Signed-out shoppers are asked to log in first,
 * because every answer depends on their own orders.
 */
export function SupportWidget() {
  const pathname = usePathname();
  const isSignedIn = useIsSignedIn();
  const open = useUiStore((state) => state.isSupportOpen);
  const prefill = useUiStore((state) => state.supportPrefill);
  const openSupport = useUiStore((state) => state.openSupport);
  const closeSupport = useUiStore((state) => state.closeSupport);
  const openLogin = useUiStore((state) => state.openLogin);

  // Esc closes the panel.
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => event.key === 'Escape' && closeSupport();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, closeSupport]);

  if (HIDDEN_ON.some((route) => pathname.startsWith(route))) return null;

  return (
    <>
      {!open ? (
        <button
          type="button"
          onClick={() => (isSignedIn ? openSupport() : openLogin())}
          aria-label="Chat with Nestora support"
          className="bg-primary text-primary-foreground animate-in fade-in zoom-in-75 fixed right-4 bottom-[calc(var(--bottom-nav-height)+4.5rem)] z-40 flex size-14 items-center justify-center rounded-full shadow-xl transition-transform duration-200 hover:scale-105 active:scale-95 md:right-6 md:bottom-6"
        >
          <span className="bg-primary/40 absolute inset-0 animate-ping rounded-full [animation-iteration-count:2]" aria-hidden />
          <MessageCircle className="relative size-6" aria-hidden />
        </button>
      ) : null}
      {open && isSignedIn ? <SupportPanel prefill={prefill} onClose={closeSupport} /> : null}
    </>
  );
}

function SupportPanel({ prefill, onClose }: { prefill: string; onClose: () => void }) {
  const chat = useSupportChat(true);
  const status = useQuery({ queryKey: supportKeys.status(), queryFn: supportApi.status, staleTime: 5 * 60_000 });
  const offline = status.data?.assistantAvailable === false;
  const [text, setText] = useState(prefill);
  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [chat.messages, chat.pendingDraft, chat.ticket]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const submit = (value = text) => {
    if (!value.trim() || chat.busy) return;
    setText('');
    void chat.send(value);
  };

  const raiseTicket = () => {
    if (offline || !chat.conversationId) {
      window.location.href = '/account/support/new';
      return;
    }
    submit('Yes, please raise a ticket with your support team for this.');
  };

  const last = [...chat.messages].reverse().find((message) => message.role === 'assistant');
  const showFeedback = chat.feedback === null && !chat.busy && !chat.pendingDraft && !chat.ticket && last && !last.error && !last.ticket && chat.messages.length >= 2;

  return (
    <section
      role="dialog"
      aria-label="Nestora support chat"
      className="bg-background animate-in fade-in slide-in-from-bottom-6 fixed inset-0 z-50 flex flex-col duration-300 md:inset-auto md:right-6 md:bottom-6 md:h-[min(680px,calc(100dvh-3rem))] md:w-[400px] md:overflow-hidden md:rounded-2xl md:border md:shadow-2xl"
    >
      <header className="from-brand-dark to-primary flex items-center gap-3 bg-linear-to-br px-4 pt-[max(env(safe-area-inset-top),0.75rem)] pb-3 text-white">
        <span className="relative flex size-10 items-center justify-center rounded-full bg-white">
          <Bot className="text-primary size-5" aria-hidden />
          <span className={cn('border-primary absolute -right-0.5 -bottom-0.5 size-3 rounded-full border-2', offline ? 'bg-zinc-400' : 'bg-emerald-400')} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-heading text-base leading-tight font-bold">Nestora Assistant</p>
          <p className="text-xs text-white/80">{offline ? 'Support team replies within a day' : 'Typically replies instantly'}</p>
        </div>
        <Link href="/account/support" onClick={onClose} className="rounded-full p-2 hover:bg-white/15" aria-label="My tickets">
          <Inbox className="size-5" />
        </Link>
        <button type="button" onClick={chat.startOver} className="rounded-full p-2 hover:bg-white/15" aria-label="New conversation">
          <SquarePen className="size-5" />
        </button>
        <button type="button" onClick={onClose} className="rounded-full p-2 hover:bg-white/15" aria-label="Close chat">
          <X className="size-5" />
        </button>
      </header>

      <div className="flex-1 space-y-4 overflow-y-auto px-4 py-4" aria-live="polite">
        {!chat.restored ? (
          <div className="text-muted-foreground flex justify-center py-10 text-sm">Loading…</div>
        ) : chat.messages.length === 0 ? (
          <div className="animate-in fade-in flex flex-col items-center gap-2 pt-6 text-center duration-500">
            <span className="bg-secondary mb-2 flex size-16 items-center justify-center rounded-full">
              <Bot className="text-primary size-8" aria-hidden />
            </span>
            <h2 className="font-heading text-xl font-bold">Hi! How can we help?</h2>
            <p className="text-muted-foreground max-w-xs text-sm">
              {offline
                ? 'Our assistant is offline right now - raise a ticket and our support team will get back to you.'
                : 'Ask about orders, deliveries, returns, refunds or your account. I can check your orders and loop in our team.'}
            </p>
            <div className="mt-3 flex flex-wrap justify-center gap-2">
              {SUGGESTIONS.map(({ label, icon: Icon }, index) => (
                <button
                  key={label}
                  type="button"
                  onClick={() => (offline ? raiseTicket() : submit(label))}
                  style={{ animationDelay: `${120 + index * 60}ms` }}
                  className="bg-card hover:border-primary/50 animate-in fade-in slide-in-from-bottom-2 fill-mode-backwards flex items-center gap-1.5 rounded-full border px-3 py-2 text-xs font-semibold transition-colors active:scale-95"
                >
                  <Icon className="text-primary size-3.5" aria-hidden />
                  {label}
                </button>
              ))}
            </div>
          </div>
        ) : (
          chat.messages.map((message) => <Bubble key={message.id} message={message} onRaiseTicket={raiseTicket} onClose={onClose} />)
        )}

        {chat.pendingDraft || chat.ticket ? <DraftCard draft={chat.pendingDraft} created={chat.ticket} onConfirm={chat.confirmDraft} onClose={onClose} /> : null}

        {showFeedback ? (
          <div className="animate-in fade-in text-muted-foreground flex items-center justify-center gap-2 text-xs delay-300">
            Did this solve your problem?
            <button type="button" onClick={() => chat.rate(true)} className="rounded-full border p-1.5 hover:bg-emerald-50" aria-label="Yes, helpful">
              <ThumbsUp className="size-3.5 text-emerald-600" />
            </button>
            <button
              type="button"
              onClick={() => {
                chat.rate(false);
                raiseTicket();
              }}
              className="hover:bg-destructive/10 rounded-full border p-1.5"
              aria-label="No, I still need help"
            >
              <ThumbsDown className="text-destructive size-3.5" />
            </button>
          </div>
        ) : chat.feedback === true ? (
          <p className="text-center text-xs text-emerald-600">Glad we could help!</p>
        ) : null}
        <div ref={endRef} />
      </div>

      <footer className="bg-card border-t px-3 pt-3 pb-[max(env(safe-area-inset-bottom),0.75rem)]">
        {offline ? (
          <Button className="h-11 w-full" onClick={raiseTicket}>
            Raise a ticket
          </Button>
        ) : (
          <form
            className="flex items-end gap-2"
            onSubmit={(event) => {
              event.preventDefault();
              submit();
            }}
          >
            <Textarea
              ref={inputRef}
              value={text}
              onChange={(event) => setText(event.target.value.slice(0, 2000))}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && !event.shiftKey) {
                  event.preventDefault();
                  submit();
                }
              }}
              placeholder="Type your question…"
              rows={1}
              className="bg-muted max-h-32 min-h-11 resize-none rounded-3xl border-0 px-4 py-2.5"
              aria-label="Message"
            />
            <button
              type="submit"
              disabled={!text.trim() || chat.busy}
              aria-label="Send"
              className="bg-primary text-primary-foreground disabled:bg-input flex size-11 shrink-0 items-center justify-center rounded-full transition-transform active:scale-90 disabled:scale-90"
            >
              <ArrowUp className="size-5" strokeWidth={2.6} />
            </button>
          </form>
        )}
      </footer>
    </section>
  );
}

function TypingDots() {
  return (
    <span className="flex gap-1 py-1.5" aria-label="Assistant is typing">
      {[0, 150, 300].map((delay) => (
        <span key={delay} className="bg-muted-foreground/70 size-1.5 animate-bounce rounded-full" style={{ animationDelay: `${delay}ms` }} />
      ))}
    </span>
  );
}

/** **bold** and "- " bullets - enough formatting for short support answers. */
function RichText({ text }: { text: string }) {
  return (
    <div className="space-y-1">
      {text.split('\n').map((line, index) => {
        if (!line.trim()) return null;
        const bullet = /^\s*[-•*]\s+/.test(line);
        const content = bullet ? line.replace(/^\s*[-•*]\s+/, '') : line;
        const parts = content.split(/(\*\*[^*]+\*\*)/g).filter(Boolean);
        return (
          <p key={index} className={cn(bullet && 'flex gap-1.5')}>
            {bullet ? <span aria-hidden>•</span> : null}
            <span>{parts.map((part, partIndex) => (part.startsWith('**') && part.endsWith('**') ? <strong key={partIndex}>{part.slice(2, -2)}</strong> : part))}</span>
          </p>
        );
      })}
    </div>
  );
}

function Bubble({ message, onRaiseTicket, onClose }: { message: ChatMessage; onRaiseTicket: () => void; onClose: () => void }) {
  if (message.role === 'user') {
    return (
      <div className="animate-in fade-in slide-in-from-bottom-1 flex justify-end duration-200">
        <p className="bg-primary text-primary-foreground max-w-[85%] rounded-2xl rounded-br-md px-3.5 py-2.5 text-sm whitespace-pre-wrap">{message.text}</p>
      </div>
    );
  }

  const waiting = message.streaming && !message.text;
  return (
    <div className="animate-in fade-in slide-in-from-bottom-1 flex items-end gap-2 duration-200">
      <span className="bg-secondary flex size-7 shrink-0 items-center justify-center rounded-full">
        <Bot className="text-primary size-4" aria-hidden />
      </span>
      <div className="flex min-w-0 flex-1 flex-col items-start gap-2">
        {waiting || message.text ? (
          <div className={cn('max-w-full rounded-2xl rounded-bl-md border px-3.5 py-2.5 text-sm', message.error ? 'bg-destructive/10 border-transparent' : 'bg-card')}>
            {waiting ? message.status && message.status !== 'Thinking…' ? <StatusLine label={message.status} /> : <TypingDots /> : <RichText text={message.text} />}
            {!waiting && message.streaming && message.status ? <StatusLine label={message.status} /> : null}
          </div>
        ) : null}
        {message.ticket ? (
          <Link
            href={`/account/support/${message.ticket.id}`}
            onClick={onClose}
            className="bg-secondary text-primary flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-semibold"
          >
            <LifeBuoy className="size-4" aria-hidden />
            View ticket {message.ticket.ticketNumber}
          </Link>
        ) : null}
        {message.offerTicket && !message.streaming && !message.ticket ? (
          <button type="button" onClick={onRaiseTicket} className="border-primary text-primary animate-in fade-in flex items-center gap-1.5 rounded-full border-[1.5px] px-3 py-1.5 text-xs font-semibold">
            <LifeBuoy className="size-3.5" aria-hidden />
            Talk to our support team
          </button>
        ) : null}
      </div>
    </div>
  );
}

function StatusLine({ label }: { label: string }) {
  return <p className="text-primary flex animate-pulse items-center gap-1.5 text-xs font-medium">✦ {label}</p>;
}

function DraftCard({
  draft,
  created,
  onConfirm,
  onClose,
}: {
  draft: TicketDraft | null;
  created: CreatedTicket | null;
  onConfirm: (edits: { subject?: string; description?: string }) => Promise<void>;
  onClose: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [subject, setSubject] = useState(draft?.subject ?? '');
  const [description, setDescription] = useState(draft?.description ?? '');
  const [submitting, setSubmitting] = useState(false);
  const [failed, setFailed] = useState(false);

  if (created) {
    return (
      <div className="animate-in zoom-in-95 fade-in ml-9 flex items-center gap-3 rounded-2xl border-[1.5px] border-emerald-500 bg-card p-3.5 duration-300">
        <BadgeCheck className="size-7 shrink-0 text-emerald-600" aria-hidden />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold">Ticket {created.ticketNumber} raised</p>
          <p className="text-muted-foreground text-xs">We’ll reply in the ticket and notify you.</p>
        </div>
        <Button asChild size="sm" variant="secondary">
          <Link href={`/account/support/${created.id}`} onClick={onClose}>
            Open
          </Link>
        </Button>
      </div>
    );
  }
  if (!draft) return null;

  return (
    <div className="border-primary bg-card animate-in fade-in slide-in-from-bottom-3 ml-9 space-y-3 rounded-2xl border-[1.5px] p-3.5 duration-300">
      <div className="flex items-center gap-2.5">
        <span className="bg-secondary flex size-8 items-center justify-center rounded-full">
          <LifeBuoy className="text-primary size-4" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-primary text-[11px] font-bold tracking-wide">TICKET FOR OUR SUPPORT TEAM</p>
          <p className="text-muted-foreground text-xs">
            {CATEGORY_LABELS[draft.category]}
            {draft.orderNumber ? ` · Order ${draft.orderNumber}` : ''}
          </p>
        </div>
        {!editing ? (
          <button type="button" onClick={() => setEditing(true)} aria-label="Edit ticket" className="text-muted-foreground hover:text-foreground p-1">
            <Pencil className="size-4" />
          </button>
        ) : null}
      </div>
      {editing ? (
        <div className="space-y-2">
          <input
            value={subject}
            onChange={(event) => setSubject(event.target.value.slice(0, 200))}
            className="border-input w-full rounded-lg border px-2.5 py-2 text-sm font-semibold"
            aria-label="Ticket subject"
          />
          <Textarea value={description} onChange={(event) => setDescription(event.target.value.slice(0, 4000))} className="min-h-24 text-sm" aria-label="Ticket description" />
        </div>
      ) : (
        <div className="space-y-1">
          <p className="text-sm font-semibold">{subject}</p>
          <p className="text-muted-foreground line-clamp-5 text-xs">{description}</p>
        </div>
      )}
      {failed ? <p className="text-destructive text-xs">Couldn’t raise the ticket. Please try again.</p> : null}
      <Button
        className="w-full"
        disabled={submitting || subject.trim().length < 5 || description.trim().length < 10}
        onClick={async () => {
          setSubmitting(true);
          setFailed(false);
          try {
            await onConfirm({
              subject: subject !== draft.subject ? subject.trim() : undefined,
              description: description !== draft.description ? description.trim() : undefined,
            });
          } catch {
            setFailed(true);
          } finally {
            setSubmitting(false);
          }
        }}
      >
        {submitting ? 'Raising…' : 'Raise ticket'}
      </Button>
    </div>
  );
}
