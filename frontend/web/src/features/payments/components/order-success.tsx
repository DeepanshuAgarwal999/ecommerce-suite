'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { CheckCircle2, Clock, MapPin, PackageCheck } from 'lucide-react';
import { EmptyState } from '@/components/common/empty-state';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { useIsSignedIn } from '@/features/auth/hooks/use-session';
import { formatPrice } from '@/lib/utils/format';
import { paymentsApi } from '../api/payments-api';

interface OrderDetail {
  id: string;
  orderNumber: string;
  status: string;
  paymentMethod: string;
  grandTotal: number;
  codFee: number;
  shippingAddress: { fullName?: string; line1?: string; line2?: string; city?: string; state?: string; pincode?: string } | null;
  items: { id: string; title: string; imageUrl: string | null; quantity: number; lineTotal: number }[];
}

/**
 * "Order placed" confirmation. Polls briefly while the order is still settling
 * (stock reservation + payment confirmation arrive asynchronously over Kafka), then
 * shows the confirmed state.
 */
export function OrderSuccess({ orderId }: { orderId: string }) {
  const isSignedIn = useIsSignedIn();
  const { data, isPending, isError } = useQuery({
    queryKey: ['orders', 'detail', orderId],
    queryFn: () => paymentsApi.getOrder(orderId) as Promise<unknown> as Promise<OrderDetail>,
    enabled: isSignedIn && Boolean(orderId),
    refetchInterval: (query) => (query.state.data?.status === 'PENDING_PAYMENT' ? 2000 : false),
  });

  if (isPending) {
    return (
      <div className="mx-auto flex max-w-2xl flex-col gap-4">
        <Skeleton className="h-40 w-full rounded-2xl" />
        <Skeleton className="h-56 w-full rounded-2xl" />
      </div>
    );
  }
  if (isError || !data) {
    return (
      <EmptyState
        icon={PackageCheck}
        title="We couldn’t load this order"
        description="If you were charged, your order is safe - check My orders in a moment."
        action={
          <Button asChild variant="outline">
            <Link href="/account/orders">My orders</Link>
          </Button>
        }
      />
    );
  }

  const confirmed = data.status !== 'PENDING_PAYMENT';
  const address = data.shippingAddress;

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-4">
      <section className="bg-card flex flex-col items-center gap-2 rounded-2xl border p-6 text-center md:p-8">
        {confirmed ? (
          <CheckCircle2 className="text-success animate-in zoom-in-50 size-14 duration-500" aria-hidden />
        ) : (
          <Clock className="text-promo size-14" aria-hidden />
        )}
        <h1 className="text-2xl font-extrabold md:text-3xl">{confirmed ? 'Order placed!' : 'Confirming your payment…'}</h1>
        <p className="text-muted-foreground text-sm">
          Order <span className="text-foreground font-semibold">{data.orderNumber}</span>
          {' · '}
          {data.paymentMethod === 'COD' ? `Pay ${formatPrice(data.grandTotal)} on delivery` : `Paid ${formatPrice(data.grandTotal)}`}
        </p>
        {!confirmed && (
          <p className="text-muted-foreground max-w-sm text-xs">
            This usually takes a few seconds. You can leave this page - we’ll confirm it automatically.
          </p>
        )}
      </section>

      <section className="bg-card rounded-2xl border p-5">
        <h2 className="mb-3 text-sm font-bold tracking-wide uppercase">Items</h2>
        <ul className="flex flex-col gap-3">
          {data.items.map((item) => (
            <li key={item.id} className="flex items-center gap-3">
              <span className="bg-secondary relative size-14 shrink-0 overflow-hidden rounded-lg border">
                {item.imageUrl && <Image src={item.imageUrl} alt="" fill sizes="56px" className="object-cover" />}
              </span>
              <span className="min-w-0 flex-1 text-sm">
                <span className="line-clamp-2 font-medium">{item.title}</span>
                <span className="text-muted-foreground">Qty {item.quantity}</span>
              </span>
              <span className="text-sm font-semibold tabular-nums">{formatPrice(item.lineTotal)}</span>
            </li>
          ))}
        </ul>
        {address && (
          <>
            <Separator className="my-4" />
            <p className="flex items-start gap-2 text-sm">
              <MapPin className="text-primary mt-0.5 size-4 shrink-0" aria-hidden />
              <span>
                <span className="font-semibold">{address.fullName}</span>
                <span className="text-muted-foreground block">
                  {[address.line1, address.line2, address.city, `${address.state ?? ''} - ${address.pincode ?? ''}`]
                    .filter(Boolean)
                    .join(', ')}
                </span>
              </span>
            </p>
          </>
        )}
      </section>

      <div className="flex flex-wrap justify-center gap-3">
        <Button asChild size="lg">
          <Link href="/">Continue shopping</Link>
        </Button>
        <Button asChild size="lg" variant="outline">
          <Link href="/account/orders">View my orders</Link>
        </Button>
      </div>
    </div>
  );
}
