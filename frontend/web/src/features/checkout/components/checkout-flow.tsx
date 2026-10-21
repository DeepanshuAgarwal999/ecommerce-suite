'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { CheckCircle2, LogIn, MapPin, Plus, ShoppingBag } from 'lucide-react';
import { EmptyState } from '@/components/common/empty-state';
import { QuantityStepper } from '@/components/common/quantity-stepper';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { AddressCard } from '@/features/address/components/address-card';
import { AddressDialog } from '@/features/address/components/address-dialog';
import { AddressForm } from '@/features/address/components/address-form';
import { useAddresses } from '@/features/address/hooks/use-addresses';
import { addressTitle, formatAddress, type Address } from '@/features/address/types';
import { useIsRestoringSession, useIsSignedIn } from '@/features/auth/hooks/use-session';
import { useOpenLogin } from '@/features/auth/hooks/use-require-auth';
import { useCartLines } from '@/features/cart/hooks/use-cart';
import { useCartStore } from '@/features/cart/store/cart-store';
import { MockGatewayDialog } from '@/features/payments/adapters/mock';
import { PaymentStep } from '@/features/payments/components/payment-step';
import { useOrderQuote, usePayNow } from '@/features/payments/hooks/use-pay-now';
import type { OrderQuote } from '@/features/payments/types';
import { isApiError } from '@/lib/api';
import { computeCartTotals } from '@/features/cart/totals';
import type { CartLine } from '@/features/cart/types';
import { useHydrated } from '@/lib/hooks/use-hydrated';
import { cn } from '@/lib/utils';
import { formatPrice } from '@/lib/utils/format';
import { useCheckoutStore } from '../store/checkout-store';

type Step = 'address' | 'summary' | 'payment';

/**
 * Checkout, Flipkart-style: three collapsible steps on the left, price details on the
 * right. Step 1 is the address book itself - pick a saved address, add one (with
 * live location) or, for a first-time buyer, the add form opens straight away.
 * Works for both entry points: "Buy now" (one product, cart untouched) and the cart.
 */
export function CheckoutFlow() {
  const hydrated = useHydrated();
  const isSignedIn = useIsSignedIn();
  const isRestoring = useIsRestoringSession();
  const openLogin = useOpenLogin();

  const mode = useCheckoutStore((state) => state.mode);
  const buyNowLine = useCheckoutStore((state) => state.buyNowLine);
  const setBuyNowQuantity = useCheckoutStore((state) => state.setBuyNowQuantity);
  const addressId = useCheckoutStore((state) => state.addressId);
  const selectAddress = useCheckoutStore((state) => state.selectAddress);
  const paymentChoice = useCheckoutStore((state) => state.paymentChoice);
  const setPaymentChoice = useCheckoutStore((state) => state.setPaymentChoice);
  const completeCheckout = useCheckoutStore((state) => state.complete);
  const clearCart = useCartStore((state) => state.clear);
  const cartLines = useCartLines();
  const { data: addresses, isPending: addressesLoading } = useAddresses();
  const router = useRouter();

  const [step, setStep] = useState<Step>('address');
  const [addingAddress, setAddingAddress] = useState(false);
  const [editingAddress, setEditingAddress] = useState<Address | null>(null);

  const lines: CartLine[] = useMemo(
    () => (mode === 'buy-now' ? (buyNowLine ? [buyNowLine] : []) : cartLines),
    [mode, buyNowLine, cartLines],
  );
  const totals = useMemo(() => computeCartTotals(lines), [lines]);
  const items = useMemo(
    () => lines.map((line) => ({ productId: line.productId, variantId: line.variantId, quantity: line.quantity })),
    [lines],
  );

  // Pre-select: the remembered choice if it still exists, else the default address.
  const selected = addresses?.find((address) => address.id === addressId) ?? null;

  // The exact amount the server will charge (delivery, tax, COD fee) - shown on the
  // Pay button and in price details, so what the shopper sees is what they pay.
  const quote = useOrderQuote(step === 'address' ? [] : items, paymentChoice, selected?.pincode);
  const quoteError = quote.error ? (isApiError(quote.error) ? quote.error.message : 'Couldn’t price your order.') : null;

  const onPaid = useCallback(
    ({ orderId }: { orderId: string; orderNumber: string }) => {
      if (mode === 'cart') clearCart();
      completeCheckout();
      router.replace(`/checkout/success?order=${orderId}`);
    },
    [mode, clearCart, completeCheckout, router],
  );
  const payment = usePayNow({ items, addressId: selected?.id ?? null, pincode: selected?.pincode, onPaid });
  useEffect(() => {
    if (!addresses?.length || selected) return;
    const fallback = addresses.find((address) => address.isDefault) ?? addresses[0];
    selectAddress(fallback.id);
  }, [addresses, selected, selectAddress]);

  if (!hydrated || isRestoring) return <CheckoutSkeleton />;

  if (!isSignedIn) {
    return (
      <EmptyState
        icon={LogIn}
        title="Sign in to check out"
        description="We’ll save your address so next time it’s one tap."
        action={<Button onClick={openLogin}>Sign in with mobile</Button>}
      />
    );
  }

  if (lines.length === 0) {
    return (
      <EmptyState
        icon={ShoppingBag}
        title="Nothing to check out"
        description="Your cart is empty. Add something you love, then come back."
        action={
          <Button asChild variant="outline">
            <Link href="/">Continue shopping</Link>
          </Button>
        }
      />
    );
  }

  const noAddresses = !addressesLoading && (addresses?.length ?? 0) === 0;

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_340px] lg:items-start">
      <div className="flex flex-col gap-3">
        {/* --- 1. Delivery address ------------------------------------------------ */}
        <StepCard
          number={1}
          title="Delivery address"
          active={step === 'address'}
          done={step !== 'address' && Boolean(selected)}
          summary={
            selected && (
              <p className="text-sm">
                <span className="font-bold">{selected.fullName}</span>{' '}
                <span className="text-muted-foreground">({addressTitle(selected)})</span>
                <span className="text-muted-foreground block truncate">{formatAddress(selected)}</span>
              </p>
            )
          }
          onChange={() => setStep('address')}
        >
          {addressesLoading ? (
            <div className="flex flex-col gap-3">
              <Skeleton className="h-28 w-full rounded-xl" />
              <Skeleton className="h-28 w-full rounded-xl" />
            </div>
          ) : noAddresses ? (
            <div>
              <p className="text-muted-foreground mb-4 flex items-center gap-2 text-sm">
                <MapPin className="text-primary size-4" aria-hidden />
                Where should we deliver? Add your first address - it becomes your default.
              </p>
              <AddressForm
                hideDefaultToggle
                submitLabel="Save and deliver here"
                onSaved={(saved) => {
                  selectAddress(saved.id);
                  setStep('summary');
                }}
              />
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              <div role="radiogroup" aria-label="Saved addresses" className="flex flex-col gap-3">
                {(addresses ?? []).map((address) => (
                  <AddressCard
                    key={address.id}
                    address={address}
                    selectable
                    selected={address.id === selected?.id}
                    onSelect={() => selectAddress(address.id)}
                    onEdit={() => setEditingAddress(address)}
                  />
                ))}
              </div>
              <Button
                type="button"
                variant="outline"
                className="text-primary h-11 justify-start gap-2 border-dashed"
                onClick={() => setAddingAddress(true)}
              >
                <Plus className="size-4" /> Add a new address
              </Button>
              <Button
                type="button"
                size="lg"
                className="h-12 self-start px-8 text-[15px] font-extrabold"
                disabled={!selected}
                onClick={() => setStep('summary')}
              >
                Deliver here
              </Button>
            </div>
          )}
        </StepCard>

        {/* --- 2. Order summary ---------------------------------------------------- */}
        <StepCard
          number={2}
          title="Order summary"
          active={step === 'summary'}
          done={step === 'payment'}
          locked={step === 'address'}
          summary={<p className="text-muted-foreground text-sm">{totals.itemCount} item(s)</p>}
          onChange={() => setStep('summary')}
        >
          <ul className="flex flex-col divide-y">
            {lines.map((line) => (
              <li key={line.productId} className="flex gap-3 py-3 first:pt-0">
                <Link href={`/p/${line.slug}`} className="bg-secondary relative size-20 shrink-0 overflow-hidden rounded-lg border">
                  {line.imageUrl && <Image src={line.imageUrl} alt={line.name} fill sizes="80px" className="object-cover" />}
                </Link>
                <div className="min-w-0 flex-1">
                  <p className="line-clamp-2 text-sm font-semibold">{line.name}</p>
                  {line.variantLabel && <p className="text-muted-foreground text-xs">{line.variantLabel}</p>}
                  <p className="mt-1 flex items-baseline gap-2 text-sm">
                    <span className="font-bold">{formatPrice(line.pricePaise)}</span>
                    {line.mrpPaise > line.pricePaise && (
                      <span className="text-muted-foreground text-xs line-through">{formatPrice(line.mrpPaise)}</span>
                    )}
                  </p>
                </div>
                <div className="shrink-0 self-center">
                  {mode === 'buy-now' ? (
                    <QuantityStepper
                      quantity={line.quantity}
                      max={line.maxPerOrder}
                      onIncrement={() => setBuyNowQuantity(line.quantity + 1)}
                      onDecrement={() => setBuyNowQuantity(line.quantity - 1)}
                    />
                  ) : (
                    <span className="text-muted-foreground text-sm">Qty {line.quantity}</span>
                  )}
                </div>
              </li>
            ))}
          </ul>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            {mode === 'cart' && (
              <Button asChild variant="outline">
                <Link href="/cart">Edit cart</Link>
              </Button>
            )}
            <Button size="lg" className="h-12 px-8 text-[15px] font-extrabold" onClick={() => setStep('payment')}>
              Continue
            </Button>
          </div>
        </StepCard>

        {/* --- 3. Payment ------------------------------------------------------------- */}
        <StepCard number={3} title="Payment" active={step === 'payment'} locked={step !== 'payment'}>
          <PaymentStep
            choice={paymentChoice}
            onChoiceChange={setPaymentChoice}
            quote={quote.data}
            quoteLoading={quote.isPending}
            quoteError={quoteError}
            phase={payment.phase}
            onPay={() => void payment.pay(paymentChoice)}
            onPreload={payment.preload}
          />
        </StepCard>
      </div>

      <PriceDetails totals={totals} quote={step === 'address' ? undefined : quote.data} />
      <MockGatewayDialog />

      <AddressDialog
        open={addingAddress}
        onOpenChange={setAddingAddress}
        submitLabel="Save and use this address"
        onSaved={(saved) => selectAddress(saved.id)}
      />
      <AddressDialog
        open={Boolean(editingAddress)}
        onOpenChange={(open) => !open && setEditingAddress(null)}
        address={editingAddress}
      />
    </div>
  );
}

function StepCard({
  number,
  title,
  active,
  done,
  locked,
  summary,
  onChange,
  children,
}: {
  number: number;
  title: string;
  active: boolean;
  done?: boolean;
  locked?: boolean;
  summary?: ReactNode;
  onChange?: () => void;
  children: ReactNode;
}) {
  return (
    <section
      aria-label={title}
      className={cn('bg-card overflow-hidden rounded-2xl border', active && 'border-primary/40 shadow-sm')}
    >
      <header
        className={cn('flex items-center gap-3 px-4 py-3.5 md:px-5', active ? 'bg-primary text-primary-foreground' : '')}
      >
        <span
          className={cn(
            'grid size-6 shrink-0 place-items-center rounded-full text-xs font-bold',
            active ? 'bg-primary-foreground text-primary' : done ? 'bg-success text-success-foreground' : 'bg-muted text-muted-foreground',
          )}
        >
          {done && !active ? <CheckCircle2 className="size-4" aria-hidden /> : number}
        </span>
        <div className="min-w-0 flex-1">
          <h2 className={cn('text-sm font-bold tracking-wide uppercase', locked && !active && 'text-muted-foreground')}>
            {title}
          </h2>
          {!active && done && summary}
        </div>
        {!active && done && onChange && (
          <Button type="button" variant="outline" size="sm" onClick={onChange}>
            Change
          </Button>
        )}
      </header>
      {active && <div className="p-4 md:p-5">{children}</div>}
    </section>
  );
}

function PriceDetails({
  totals,
  quote,
}: {
  totals: ReturnType<typeof computeCartTotals>;
  /** Server-priced totals once known (after step 1); until then the cart estimate. */
  quote?: OrderQuote;
}) {
  const mrp = totals.subtotalPaise + totals.savingsPaise;
  const rows: { label: string; value: string; tone?: 'success' }[] = quote
    ? [
        { label: `Price (${totals.itemCount} item${totals.itemCount === 1 ? '' : 's'})`, value: formatPrice(mrp) },
        ...(totals.savingsPaise > 0 ? [{ label: 'Discount', value: `− ${formatPrice(totals.savingsPaise)}`, tone: 'success' as const }] : []),
        ...(quote.totals.discountTotal > 0
          ? [{ label: 'Coupon', value: `− ${formatPrice(quote.totals.discountTotal)}`, tone: 'success' as const }]
          : []),
        { label: 'Delivery', value: quote.totals.shippingTotal === 0 ? 'Free' : formatPrice(quote.totals.shippingTotal) },
        ...(quote.totals.taxTotal > 0 ? [{ label: 'GST', value: formatPrice(quote.totals.taxTotal) }] : []),
        ...(quote.totals.codFee > 0 ? [{ label: 'Cash on delivery fee', value: formatPrice(quote.totals.codFee) }] : []),
      ]
    : [
        { label: `Price (${totals.itemCount} item${totals.itemCount === 1 ? '' : 's'})`, value: formatPrice(mrp) },
        ...(totals.savingsPaise > 0 ? [{ label: 'Discount', value: `− ${formatPrice(totals.savingsPaise)}`, tone: 'success' as const }] : []),
        { label: 'Delivery', value: totals.deliveryFeePaise === 0 ? 'Free' : formatPrice(totals.deliveryFeePaise) },
      ];
  const total = quote ? quote.totals.grandTotal : totals.totalPaise;

  return (
    <aside className="bg-card flex flex-col gap-3 rounded-2xl border p-5 lg:sticky lg:top-[calc(var(--header-height)+1rem)]">
      <h2 className="text-muted-foreground text-sm font-bold tracking-wide uppercase">Price details</h2>
      <Separator />
      <dl className="flex flex-col gap-2.5 text-sm">
        {rows.map((row) => (
          <div key={row.label} className={cn('flex justify-between', row.tone === 'success' && 'text-success')}>
            <dt>{row.label}</dt>
            <dd className="tabular-nums">{row.value}</dd>
          </div>
        ))}
        <Separator />
        <div className="flex justify-between text-base font-extrabold">
          <dt>{quote ? 'Total amount' : 'Estimated total'}</dt>
          <dd className="tabular-nums">{formatPrice(total)}</dd>
        </div>
      </dl>
      {totals.savingsPaise > 0 && (
        <p className="text-success text-sm font-semibold">You save {formatPrice(totals.savingsPaise)} on this order</p>
      )}
      {!quote && <p className="text-muted-foreground text-xs">Final amount incl. taxes is shown once you choose an address.</p>}
    </aside>
  );
}

function CheckoutSkeleton() {
  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
      <div className="flex flex-col gap-3">
        <Skeleton className="h-56 w-full rounded-2xl" />
        <Skeleton className="h-14 w-full rounded-2xl" />
        <Skeleton className="h-14 w-full rounded-2xl" />
      </div>
      <Skeleton className="h-60 w-full rounded-2xl" />
    </div>
  );
}
