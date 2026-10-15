'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { isApiError, queryKeys } from '@/lib/api';
import { ordersApi } from '../api/orders-api';
import type { OrderListQuery, OrderStatus } from '../types';

export function useOrders(query: OrderListQuery) {
  return useQuery({
    queryKey: queryKeys.orders.list({ ...query }),
    queryFn: () => ordersApi.list(query),
    placeholderData: (previous) => previous,
  });
}

export function useOrder(orderId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.orders.detail(orderId ?? ''),
    queryFn: () => ordersApi.get(orderId as string),
    enabled: Boolean(orderId),
  });
}

export function useCancelOrder(orderId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (reason: string) => ordersApi.cancel(orderId, reason),
    onSuccess: (order) => {
      queryClient.setQueryData(queryKeys.orders.detail(orderId), order);
      queryClient.invalidateQueries({ queryKey: queryKeys.orders.all });
      toast.success(`Order ${order.orderNumber} cancelled.`);
    },
    onError: (error) => toast.error(isApiError(error) ? error.message : 'Could not cancel the order.'),
  });
}

export function useUpdateOrderStatus(orderId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ status, reason }: { status: OrderStatus; reason?: string }) =>
      ordersApi.updateStatus(orderId, status, reason),
    onSuccess: (order) => {
      queryClient.setQueryData(queryKeys.orders.detail(orderId), order);
      queryClient.invalidateQueries({ queryKey: queryKeys.orders.all });
      toast.success(`Order ${order.orderNumber} is now ${order.status.replace(/_/g, ' ').toLowerCase()}.`);
    },
    onError: (error) => toast.error(isApiError(error) ? error.message : 'Could not update the order.'),
  });
}
