import { BadgeCheck } from 'lucide-react';
import type { ReviewItem } from '../api/catalog-api';
import { Stars } from './stars';

export function ReviewList({ items }: { items: ReviewItem[] }) {
  if (items.length === 0) {
    return (
      <p className="text-muted-foreground text-sm">
        No reviews yet. Be the first to rate it after delivery.
      </p>
    );
  }
  return (
    <ul className="grid gap-3">
      {items.map((review) => (
        <li key={review.id} className="rounded-xl border p-3">
          <div className="flex items-center gap-2">
            <Stars value={review.rating} size="size-3.5" />
            {review.isVerifiedPurchase && (
              <span className="text-success inline-flex items-center gap-1 text-xs font-semibold">
                <BadgeCheck className="size-3.5" aria-hidden /> Verified purchase
              </span>
            )}
            <span className="text-muted-foreground ml-auto text-xs">
              {new Date(review.createdAt).toLocaleDateString('en-IN', {
                day: 'numeric',
                month: 'short',
                year: 'numeric',
              })}
            </span>
          </div>
          {review.title && <p className="mt-1 text-sm font-bold">{review.title}</p>}
          {review.comment && (
            <p className="text-foreground/85 mt-0.5 text-sm whitespace-pre-line">{review.comment}</p>
          )}
          <p className="text-muted-foreground mt-1 text-xs">— {review.userName}</p>
        </li>
      ))}
    </ul>
  );
}
