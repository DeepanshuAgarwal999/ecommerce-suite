'use client';

import { useParams, useRouter } from 'next/navigation';
import { useState } from 'react';
import { ArrowLeft, MapPin } from 'lucide-react';
import { StatusBadge } from '@/components/common/status-badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { useCancelOrder, useOrder } from '@/features/orders/hooks/use-orders';
import { CUSTOMER_CANCELLABLE } from '@/features/orders/constants';
import { formatDateTime, formatMoney } from '@/lib/format';

export default function OrderDetailPage() {
  const { orderId } = useParams<{ orderId: string }>();
  const router = useRouter();
  const { data: order, isLoading } = useOrder(orderId);
  const [cancelling, setCancelling] = useState(false);

  if (isLoading) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!order) return <p className="text-sm text-muted-foreground">Order not found.</p>;

  const canCancel = CUSTOMER_CANCELLABLE.includes(order.status);

  return (
    <>
      <Button variant="ghost" size="sm" className="-ml-2 mb-4" onClick={() => router.push('/orders')}>
        <ArrowLeft className="size-4" aria-hidden />
        Back to orders
      </Button>

      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="font-mono text-xl font-semibold">{order.orderNumber}</h2>
            <StatusBadge status={order.status} />
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            {order.userMobile} · Placed {formatDateTime(order.createdAt)} · via {order.source}
          </p>
        </div>

        {canCancel && (
          <Button variant="destructive" onClick={() => setCancelling(true)}>
            Cancel order
          </Button>
        )}
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Items</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col divide-y divide-border">
            {order.items.map((item) => (
              <div key={item.id} className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="flex size-11 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-muted">
                    {item.imageUrl && (
                      <img src={item.imageUrl} alt="" className="size-full object-cover" loading="lazy" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{item.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {item.vendorName} · {item.sku} · Qty {item.quantity}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm font-medium tabular-nums">{formatMoney(item.lineTotal)}</p>
                  <StatusBadge status={item.status} className="mt-1" />
                </div>
              </div>
            ))}

            <Separator />

            <div className="flex flex-col gap-1.5 pt-3 text-sm">
              <SummaryRow label="Items" value={formatMoney(order.itemTotal)} />
              {order.discountTotal > 0 && (
                <SummaryRow label="Discount" value={`−${formatMoney(order.discountTotal)}`} />
              )}
              {order.shippingTotal > 0 && <SummaryRow label="Shipping" value={formatMoney(order.shippingTotal)} />}
              <SummaryRow label="Tax" value={formatMoney(order.taxTotal)} />
              {order.codFee > 0 && <SummaryRow label="COD fee" value={formatMoney(order.codFee)} />}
              <SummaryRow label="Total" value={formatMoney(order.grandTotal)} bold />
            </div>
          </CardContent>
        </Card>

        <div className="flex flex-col gap-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MapPin className="size-4" aria-hidden />
                Delivery address
              </CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              <p className="font-medium text-foreground">{order.shippingAddress.fullName}</p>
              <p>{order.shippingAddress.phone}</p>
              <p>
                {order.shippingAddress.line1}
                {order.shippingAddress.line2 && `, ${order.shippingAddress.line2}`}
              </p>
              <p>
                {order.shippingAddress.city}, {order.shippingAddress.state} {order.shippingAddress.pincode}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Timeline</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              {order.statusHistory.map((entry) => (
                <div key={entry.id} className="flex items-start gap-2.5 text-sm">
                  <div className="mt-1.5 size-1.5 shrink-0 rounded-full bg-primary" />
                  <div>
                    <p className="font-medium">{entry.toStatus.replace(/_/g, ' ')}</p>
                    <p className="text-xs text-muted-foreground">{formatDateTime(entry.createdAt)}</p>
                    {entry.reason && <p className="mt-0.5 text-xs text-muted-foreground">{entry.reason}</p>}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>

      {cancelling && (
        <CancelOrderDialog
          orderId={order.id}
          orderNumber={order.orderNumber}
          onClose={() => setCancelling(false)}
        />
      )}
    </>
  );
}

function SummaryRow({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div className={`flex items-center justify-between ${bold ? 'font-semibold' : 'text-muted-foreground'}`}>
      <span>{label}</span>
      <span className="tabular-nums">{value}</span>
    </div>
  );
}

function CancelOrderDialog({
  orderId,
  orderNumber,
  onClose,
}: {
  orderId: string;
  orderNumber: string;
  onClose: () => void;
}) {
  const [reason, setReason] = useState('');
  const cancel = useCancelOrder(orderId);

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Cancel {orderNumber}</DialogTitle>
          <DialogDescription>
            Releases any held stock and triggers an automatic refund if the order was already paid.
          </DialogDescription>
        </DialogHeader>
        <Textarea
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          placeholder="Reason for cancellation"
          rows={3}
          autoFocus
        />
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>
            Keep order
          </Button>
          <Button
            type="button"
            variant="destructive"
            disabled={reason.trim().length === 0 || cancel.isPending}
            onClick={() => cancel.mutate(reason, { onSuccess: onClose })}
          >
            {cancel.isPending ? 'Cancelling…' : 'Cancel order'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
