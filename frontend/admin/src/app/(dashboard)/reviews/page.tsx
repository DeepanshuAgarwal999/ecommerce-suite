'use client';

import { useState } from 'react';
import { BadgeCheck, Star } from 'lucide-react';
import { PageHeader } from '@/components/layout/page-header';
import { DataTable } from '@/components/common/data-table';
import { Button } from '@/components/ui/button';
import {
  useApproveReview,
  usePendingReviews,
  useRejectReview,
} from '@/features/products/hooks/use-products';
import type { PendingReview } from '@/features/products/api/products-api';

function Stars({ value }: { value: number }) {
  return (
    <span className="inline-flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((star) => (
        <Star
          key={star}
          className={
            star <= value ? 'size-3.5 fill-amber-400 text-amber-400' : 'size-3.5 text-muted-foreground/40'
          }
          aria-hidden
        />
      ))}
    </span>
  );
}

export default function ReviewsPage() {
  const [page, setPage] = useState(1);
  const { data, isLoading, isFetching } = usePendingReviews({ page, limit: 20 });
  const approve = useApproveReview();
  const reject = useRejectReview();

  return (
    <>
      <PageHeader
        title="Reviews"
        description="Buyer ratings awaiting moderation — approving publishes the review and updates the product average."
      />
      <DataTable<PendingReview>
        columns={[
          {
            accessorKey: 'rating',
            header: 'Rating',
            cell: ({ row }) => <Stars value={row.original.rating} />,
          },
          {
            accessorKey: 'comment',
            header: 'Review',
            cell: ({ row }) => (
              <div className="max-w-md">
                {row.original.title && <p className="font-medium">{row.original.title}</p>}
                {row.original.comment && (
                  <p className="text-sm text-muted-foreground whitespace-pre-line">
                    {row.original.comment}
                  </p>
                )}
                <p className="mt-1 text-xs text-muted-foreground">
                  {row.original.userName} ·{' '}
                  {new Date(row.original.createdAt).toLocaleDateString('en-IN')}
                  {row.original.isVerifiedPurchase && ' · Verified purchase'}
                </p>
              </div>
            ),
          },
          {
            accessorKey: 'isVerifiedPurchase',
            header: 'Verified',
            cell: ({ row }) =>
              row.original.isVerifiedPurchase ? (
                <span className="inline-flex items-center gap-1 text-xs font-semibold text-green-600">
                  <BadgeCheck className="size-3.5" aria-hidden /> Yes
                </span>
              ) : (
                <span className="text-xs text-muted-foreground">No</span>
              ),
          },
          {
            id: 'actions',
            header: 'Moderate',
            cell: ({ row }) => (
              <div className="flex gap-2">
                <Button
                  size="sm"
                  disabled={approve.isPending || reject.isPending}
                  onClick={() => approve.mutate(row.original.id)}
                >
                  Approve
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={approve.isPending || reject.isPending}
                  onClick={() => reject.mutate(row.original.id)}
                >
                  Reject
                </Button>
              </div>
            ),
          },
        ]}
        data={data?.items ?? []}
        meta={data?.meta}
        isLoading={isLoading || isFetching}
        onPageChange={setPage}
        emptyLabel="No pending reviews. Everything is moderated."
      />
    </>
  );
}
