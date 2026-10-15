'use client';

import { useState } from 'react';
import { ShoppingBag } from 'lucide-react';
import { EmptyState } from '@/components/common/empty-state';
import { StatusBadge } from '@/components/common/status-badge';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { formatDate, formatPrice } from '@/lib/utils/format';
import { useUpdateOrderStatus, useVendorOrders } from '../hooks/use-orders';
import type { OrderStatus } from '../types';

const statusFilters: { label: string; value: OrderStatus | 'ALL' }[] = [
  { label: 'All orders', value: 'ALL' },
  { label: 'Confirmed', value: 'CONFIRMED' },
  { label: 'Packed', value: 'PACKED' },
  { label: 'Shipped', value: 'SHIPPED' },
  { label: 'Delivered', value: 'DELIVERED' },
  { label: 'Cancelled', value: 'CANCELLED' },
];

/** The single next step a vendor can mark, given the order's current status. */
function nextAction(status: OrderStatus): OrderStatus | null {
  if (status === 'CONFIRMED') return 'PACKED';
  if (status === 'PACKED') return 'SHIPPED';
  return null;
}

export function OrderTable() {
  const [filter, setFilter] = useState<OrderStatus | 'ALL'>('ALL');
  const orders = useVendorOrders({
    page: 1,
    limit: 50,
    status: filter === 'ALL' ? undefined : filter,
  });
  const updateStatus = useUpdateOrderStatus();

  return (
    <div className="flex flex-col gap-4">
      <Select value={filter} onValueChange={(value) => setFilter(value as OrderStatus | 'ALL')}>
        <SelectTrigger className="w-48">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {statusFilters.map((item) => (
            <SelectItem key={item.value} value={item.value}>
              {item.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {orders.isPending ? (
        <div className="flex flex-col gap-2">
          {Array.from({ length: 5 }, (_, i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </div>
      ) : (orders.data?.items.length ?? 0) === 0 ? (
        <EmptyState
          icon={ShoppingBag}
          title="No orders here yet"
          description="Orders containing your products will show up as they come in."
        />
      ) : (
        <div className="scrollbar-none overflow-x-auto rounded-xl border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Order</TableHead>
                <TableHead>Placed</TableHead>
                <TableHead>Items</TableHead>
                <TableHead>Total</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-36" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {orders.data?.items.map((order) => {
                const total = order.items.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);
                const action = nextAction(order.status);

                return (
                  <TableRow key={order.id}>
                    <TableCell className="font-mono text-sm font-medium">{order.orderNumber}</TableCell>
                    <TableCell className="text-muted-foreground">{formatDate(order.createdAt)}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {order.items.length} {order.items.length === 1 ? 'item' : 'items'}
                    </TableCell>
                    <TableCell className="tabular-nums">{formatPrice(total)}</TableCell>
                    <TableCell>
                      <StatusBadge status={order.status} />
                    </TableCell>
                    <TableCell>
                      {action && (
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={updateStatus.isPending}
                          onClick={() => updateStatus.mutate({ orderId: order.id, status: action })}
                        >
                          Mark {action.toLowerCase()}
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
