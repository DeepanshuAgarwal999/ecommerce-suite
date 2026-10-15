import { Star } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatCompact, formatRating } from '@/lib/utils/format';

interface RatingBadgeProps {
  rating: number;
  count?: number;
  className?: string;
}

export function RatingBadge({ rating, count, className }: RatingBadgeProps) {
  if (rating <= 0) return null;

  return (
    <div className={cn('flex items-center gap-1 text-xs', className)}>
      <span className="bg-success text-success-foreground inline-flex items-center gap-0.5 rounded px-1.5 py-0.5 font-semibold">
        {formatRating(rating)}
        <Star className="size-2.5 fill-current" aria-hidden />
      </span>
      {count !== undefined && count > 0 && (
        <span className="text-muted-foreground">({formatCompact(count)})</span>
      )}
    </div>
  );
}
