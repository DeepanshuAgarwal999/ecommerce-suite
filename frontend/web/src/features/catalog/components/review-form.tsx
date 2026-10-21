'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { isApiError } from '@/lib/api/errors';
import { queryKeys } from '@/lib/api/query-keys';
import { Button } from '@/components/ui/button';
import { catalogApi, type CreateReviewInput, type MyReview } from '../api/catalog-api';
import { Stars } from './stars';

/**
 * Delivery-gated write form. Unlocks only when the buyer has a DELIVERED order
 * containing this product; the picked orderId is what the backend verifies.
 * New submissions (and edits) stay pending until staff approve them.
 */
export function ReviewForm({ productId }: { productId: string }) {
  const queryClient = useQueryClient();
  const [rating, setRating] = useState(0);
  const [title, setTitle] = useState('');
  const [comment, setComment] = useState('');
  const [orderId, setOrderId] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [submittedPending, setSubmittedPending] = useState(false);

  const mineQuery = useQuery({
    queryKey: [...queryKeys.catalog.all, 'reviews', productId, 'mine'],
    queryFn: () => catalogApi.myReview(productId),
    retry: false,
  });

  const ordersQuery = useQuery({
    queryKey: [...queryKeys.catalog.all, 'reviews', productId, 'reviewable-orders'],
    queryFn: () => catalogApi.reviewableOrders(productId),
    retry: false,
  });

  const mine: MyReview | null = mineQuery.data ?? null;
  const eligibleOrders = ordersQuery.data?.items ?? [];

  const submit = useMutation({
    mutationFn: (input: CreateReviewInput) => catalogApi.createReview(input),
    onSuccess: () => {
      setSubmittedPending(true);
      setFormError(null);
      queryClient.invalidateQueries({ queryKey: [...queryKeys.catalog.all, 'reviews', productId] });
    },
    onError: (error: unknown) => {
      setFormError(
        isApiError(error) ? error.message : 'Could not submit your review. Please try again.',
      );
    },
  });

  if (!mine && eligibleOrders.length === 0) {
    return (
      <p className="text-muted-foreground mt-1 text-sm">
        {ordersQuery.isLoading
          ? 'Checking your delivered orders…'
          : 'You can rate this product after you receive it. The review option unlocks on delivered orders only.'}
      </p>
    );
  }

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    setFormError(null);
    if (rating < 1 && !mine) {
      setFormError('Please pick a star rating first.');
      return;
    }
    const chosenOrder = orderId || mine?.orderId || eligibleOrders[0]?.id || '';
    if (!chosenOrder) {
      setFormError('You can rate this product only after its order is delivered.');
      return;
    }
    submit.mutate({
      productId,
      orderId: chosenOrder,
      rating: rating || mine?.rating || 5,
      title: title.trim() || undefined,
      comment: comment.trim() || undefined,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="mt-2 grid gap-3">
      {mine?.isPublished === true && (
        <p className="text-success text-xs font-semibold">
          Your review is live. Editing it will send it back for approval.
        </p>
      )}
      {mine && !mine.isPublished && (
        <p className="text-xs font-semibold text-amber-600">
          Your review is awaiting admin approval and will appear here once published.
        </p>
      )}
      {eligibleOrders.length > 1 && (
        <label className="grid gap-1 text-sm">
          <span className="font-semibold">Delivered order</span>
          <select
            className="rounded-lg border px-2 py-2"
            value={orderId || mine?.orderId || eligibleOrders[0]?.id || ''}
            onChange={(event) => setOrderId(event.target.value)}
          >
            {eligibleOrders.map((order) => (
              <option key={order.id} value={order.id}>
                Order {order.id.slice(0, 8)}… · {order.status} ·{' '}
                {new Date(order.createdAt).toLocaleDateString('en-IN')}
              </option>
            ))}
          </select>
        </label>
      )}
      <div className="flex items-center gap-2">
        <span className="text-sm font-semibold">Your rating</span>
        <Stars value={rating || mine?.rating || 0} onPick={setRating} />
      </div>
      <input
        className="rounded-lg border px-3 py-2 text-sm"
        placeholder="Title (optional)"
        maxLength={200}
        defaultValue={mine?.title ?? ''}
        onChange={(event) => setTitle(event.target.value)}
      />
      <textarea
        className="min-h-24 rounded-lg border px-3 py-2 text-sm"
        placeholder="What did you like? Size, quality, delivery…"
        maxLength={4000}
        defaultValue={mine?.comment ?? ''}
        onChange={(event) => setComment(event.target.value)}
      />
      {formError && <p className="text-destructive text-sm">{formError}</p>}
      {submittedPending && !formError && (
        <p className="text-sm text-amber-600">
          Thanks! Your review was submitted and will be published after admin approval.
        </p>
      )}
      <div>
        <Button type="submit" disabled={submit.isPending}>
          {submit.isPending ? 'Submitting…' : mine ? 'Update review' : 'Submit review'}
        </Button>
      </div>
    </form>
  );
}
