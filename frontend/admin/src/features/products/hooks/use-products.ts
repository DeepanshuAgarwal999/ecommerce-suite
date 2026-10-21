'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { isApiError, queryKeys } from '@/lib/api';
import { catalogOptionsApi } from '../api/catalog-options-api';
import { productsApi } from '../api/products-api';
import type {
  CreateProductInput,
  ProductListQuery,
  ReviewProductInput,
  UpdateProductInput,
} from '../types';

export function useProducts(query: ProductListQuery) {
  return useQuery({
    queryKey: queryKeys.products.list({ ...query }),
    queryFn: () => productsApi.list(query),
    placeholderData: (previous) => previous,
  });
}

export function useProduct(productId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.products.detail(productId ?? ''),
    queryFn: () => productsApi.get(productId as string),
    enabled: Boolean(productId),
  });
}

export function useCategories() {
  return useQuery({
    queryKey: ['catalog', 'categories'],
    queryFn: catalogOptionsApi.categories,
    staleTime: 10 * 60_000,
  });
}

export function useBrands() {
  return useQuery({
    queryKey: ['catalog', 'brands'],
    queryFn: catalogOptionsApi.brands,
    staleTime: 10 * 60_000,
  });
}

export function useCreateProduct() {
  const queryClient = useQueryClient();
  const router = useRouter();

  return useMutation({
    mutationFn: (input: CreateProductInput) => productsApi.create(input),
    onSuccess: (product) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.products.all });
      toast.success(`${product.title} created.`);
      router.push(`/products/${product.id}`);
    },
    onError: (error) => {
      toast.error(isApiError(error) ? error.message : 'Could not create the product.');
    },
  });
}

export function useUpdateProduct(productId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: UpdateProductInput) => productsApi.update(productId, input),
    onSuccess: (product) => {
      queryClient.setQueryData(queryKeys.products.detail(productId), product);
      queryClient.invalidateQueries({ queryKey: queryKeys.products.all });
      toast.success(`${product.title} updated.`);
    },
    onError: (error) => {
      toast.error(isApiError(error) ? error.message : 'Could not save the changes.');
    },
  });
}

export function useArchiveProduct() {
  const queryClient = useQueryClient();
  const router = useRouter();

  return useMutation({
    mutationFn: (productId: string) => productsApi.archive(productId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.products.all });
      toast.success('Product archived.');
      router.push('/products');
    },
    onError: (error) => {
      toast.error(isApiError(error) ? error.message : 'Could not archive the product.');
    },
  });
}

export function useReviewProduct(productId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: ReviewProductInput) => productsApi.review(productId, input),
    onSuccess: (product) => {
      queryClient.setQueryData(queryKeys.products.detail(productId), product);
      queryClient.invalidateQueries({ queryKey: queryKeys.products.all });
      toast.success(
        product.status === 'ACTIVE'
          ? `${product.title} is now live.`
          : `${product.title} was rejected.`,
      );
    },
    onError: (error) => {
      toast.error(isApiError(error) ? error.message : 'Could not update the product.');
    },
  });
}

/** Pending reviews queue for the moderation screen. */
export function usePendingReviews(query: { page?: number; limit?: number; productId?: string }) {
  return useQuery({
    queryKey: ['reviews', 'pending', query],
    queryFn: () => productsApi.pendingReviews(query),
    placeholderData: (previous) => previous,
  });
}

/** Approve publishes the review and folds its stars into the product average. */
export function useApproveReview() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (reviewId: string) => productsApi.approveReview(reviewId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reviews'] });
      queryClient.invalidateQueries({ queryKey: queryKeys.products.all });
      toast.success('Review published.');
    },
    onError: (error) => {
      toast.error(isApiError(error) ? error.message : 'Could not approve the review.');
    },
  });
}

/** Reject unpublishes the review and removes its stars from the product average. */
export function useRejectReview() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (reviewId: string) => productsApi.rejectReview(reviewId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reviews'] });
      queryClient.invalidateQueries({ queryKey: queryKeys.products.all });
      toast.success('Review rejected.');
    },
    onError: (error) => {
      toast.error(isApiError(error) ? error.message : 'Could not reject the review.');
    },
  });
}
