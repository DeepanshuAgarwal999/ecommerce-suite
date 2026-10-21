'use client';

import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { AlertCircle, Banknote, Lock, RotateCcw, ShieldCheck, Smartphone } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Spinner } from '@/components/ui/spinner';
import { cn } from '@/lib/utils';
import { formatPrice } from '@/lib/utils/format';
import { getPaymentAdapter } from '../adapters/registry';
import { paymentsApi } from '../api/payments-api';
import type { PayPhase } from '../hooks/use-pay-now';
import type { OrderQuote, PaymentChoice } from '../types';

interface PaymentStepProps {
  choice: PaymentChoice;
  onChoiceChange: (choice: PaymentChoice) => void;
  quote: OrderQuote | undefined;
  quoteLoading: boolean;
  quoteError: string | null;
  phase: PayPhase;
  onPay: () => void;
  onPreload: (provider: string) => void;
}

const STEP_LABEL = { placing: 'Placing your order…', opening: 'Opening secure payment…', confirming: 'Confirming payment…' };

/**
 * Step 3 of checkout: choose how to pay, see the exact server-quoted amount, one
 * button. Gateway-agnostic - the online option's label and preloading come from
 * whichever adapter the backend says is active.
 */
export function PaymentStep({
  choice,
  onChoiceChange,
  quote,
  quoteLoading,
  quoteError,
  phase,
  onPay,
  onPreload,
}: PaymentStepProps) {
  const config = useQuery({ queryKey: ['payments', 'config'], queryFn: paymentsApi.config, staleTime: 5 * 60_000 });
  const provider = config.data?.provider;
  const adapterLabel = (() => {
    try {
      return provider ? getPaymentAdapter(provider).label : null;
    } catch {
      return null;
    }
  })();

  // Load the gateway's script while the shopper is deciding, so "Pay" opens instantly.
  useEffect(() => {
    if (provider) onPreload(provider);
  }, [provider, onPreload]);

  const busy = phase.kind === 'working';
  const total = quote?.totals.grandTotal;

  const options: { value: PaymentChoice; title: string; subtitle: string; icon: typeof Smartphone }[] = [
    {
      value: 'ONLINE',
      title: 'Pay online',
      subtitle: 'UPI, credit / debit cards, netbanking, wallets',
      icon: Smartphone,
    },
    {
      value: 'COD',
      title: 'Cash on delivery',
      subtitle: quote && choice === 'COD' && quote.totals.codFee > 0
        ? `Includes a ${formatPrice(quote.totals.codFee)} cash-handling fee`
        : 'Pay in cash or UPI when it arrives (small fee applies)',
      icon: Banknote,
    },
  ];

  return (
    <div className="flex flex-col gap-4">
      <div role="radiogroup" aria-label="Payment method" className="flex flex-col gap-2.5">
        {options.map((option) => {
          const selected = choice === option.value;
          return (
            <button
              key={option.value}
              type="button"
              role="radio"
              aria-checked={selected}
              disabled={busy}
              onClick={() => onChoiceChange(option.value)}
              className={cn(
                'flex items-center gap-3 rounded-xl border p-4 text-left transition-colors disabled:opacity-60',
                selected ? 'border-primary ring-primary/20 bg-primary/5 ring-2' : 'hover:border-primary/40',
              )}
            >
              <span
                aria-hidden
                className={cn(
                  'grid size-5 shrink-0 place-items-center rounded-full border-2',
                  selected ? 'border-primary' : 'border-input',
                )}
              >
                {selected && <span className="bg-primary size-2.5 rounded-full" />}
              </span>
              <option.icon className="text-primary size-5 shrink-0" aria-hidden />
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-bold">{option.title}</span>
                <span className="text-muted-foreground block text-xs">{option.subtitle}</span>
              </span>
            </button>
          );
        })}
      </div>

      {(phase.kind === 'declined' || phase.kind === 'error' || phase.kind === 'dismissed') && (
        <div
          role="alert"
          className={cn(
            'flex items-start gap-3 rounded-xl p-3.5 text-sm',
            phase.kind === 'dismissed' ? 'bg-secondary' : 'bg-destructive/10 text-destructive',
          )}
        >
          <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
          <div>
            <p className="font-semibold">
              {phase.kind === 'dismissed'
                ? 'Payment not completed'
                : phase.kind === 'declined'
                  ? 'Payment didn’t go through'
                  : 'We couldn’t place your order'}
            </p>
            <p className={cn('mt-0.5', phase.kind === 'dismissed' && 'text-muted-foreground')}>
              {phase.kind === 'dismissed'
                ? 'You closed the payment window. Your order is saved - pay now to confirm it.'
                : phase.message}
              {phase.kind === 'declined' && ' No money was taken for the failed attempt. You can try again or use another method.'}
            </p>
          </div>
        </div>
      )}

      {quoteError && (
        <p role="alert" className="text-destructive flex items-center gap-2 text-sm">
          <AlertCircle className="size-4 shrink-0" aria-hidden /> {quoteError}
        </p>
      )}

      <Button
        type="button"
        size="lg"
        className="h-13 text-base font-extrabold"
        disabled={busy || quoteLoading || !quote || Boolean(quoteError)}
        onClick={onPay}
      >
        {busy ? (
          <>
            <Spinner className="size-4" /> {STEP_LABEL[phase.step]}
          </>
        ) : quoteLoading || total === undefined ? (
          <Skeleton className="h-5 w-32 bg-white/30" />
        ) : (
          <>
            {phase.kind === 'declined' || phase.kind === 'dismissed' ? <RotateCcw className="size-4" /> : <Lock className="size-4" />}
            {choice === 'COD' ? `Place order · ${formatPrice(total)}` : `${phase.kind === 'idle' || phase.kind === 'error' ? 'Pay' : 'Retry payment'} ${formatPrice(total)}`}
          </>
        )}
      </Button>

      <p className="text-muted-foreground flex items-center justify-center gap-1.5 text-xs">
        <ShieldCheck className="size-3.5" aria-hidden />
        {choice === 'ONLINE' ? (adapterLabel ?? 'Secure payment') : 'Pay when your order arrives'}
        {choice === 'ONLINE' && ' · we never see or store your card details'}
      </p>
    </div>
  );
}
