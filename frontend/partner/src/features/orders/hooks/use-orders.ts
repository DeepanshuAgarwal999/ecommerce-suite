'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { isApiError, queryKeys } from '@/lib/api';
import { ordersApi, type VendorOrdersQuery } from '../api/orders-api';
import type { OrderStatus } from '../types';

export function useVendorOrders(query: VendorOrdersQuery) {
  return useQuery({
    queryKey: queryKeys.orders.list({ ...query }),
    queryFn: () => ordersApi.list(query),
  });
}

export function useUpdateOrderStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ orderId, status }: { orderId: string; status: OrderStatus }) =>
      ordersApi.updateStatus(orderId, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.orders.all });
      toast.success('Order updated');
    },
    onError: (error) => {
      toast.error(isApiError(error) ? error.message : 'Could not update the order. Try again.');
    },
  });
}
