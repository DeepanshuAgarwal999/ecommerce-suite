'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { queryKeys } from '@/lib/api';
import { productsApi, type VendorProductsQuery } from '../api/products-api';
import type { CreateProductInput, UpdateProductInput } from '../types';

export function useVendorProducts(query: VendorProductsQuery) {
  return useQuery({
    queryKey: queryKeys.products.list({ ...query }),
    queryFn: () => productsApi.list(query),
  });
}

export function useCategories() {
  return useQuery({
    queryKey: queryKeys.catalog.categories(),
    queryFn: productsApi.categories,
    staleTime: 10 * 60_000,
  });
}

export function useBrands() {
  return useQuery({
    queryKey: queryKeys.catalog.brands(),
    queryFn: productsApi.brands,
    staleTime: 10 * 60_000,
  });
}

export function useCreateProduct() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateProductInput) => productsApi.create(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.products.all });
    },
  });
}

export function useUpdateProduct(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: UpdateProductInput) => productsApi.update(id, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.products.all });
    },
  });
}

export function useArchiveProduct() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => productsApi.archive(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.products.all });
      toast.success('Product archived');
    },
  });
}
