import { Star } from 'lucide-react';
import { cn } from '@/lib/utils';

export function Stars({
  value,
  onPick,
  size = 'size-5',
}: {
  value: number;
  onPick?: (star: number) => void;
  size?: string;
}) {
  return (
    <div className="flex items-center gap-0.5" role={onPick ? 'radiogroup' : undefined}>
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          disabled={!onPick}
          onClick={() => onPick?.(star)}
          aria-label={`${star} star${star > 1 ? 's' : ''}`}
          className={cn(
            size,
            star <= value ? 'text-amber-400' : 'text-muted-foreground/40',
            onPick && 'cursor-pointer transition-transform hover:scale-110',
          )}
        >
          <Star className={cn(size, 'fill-current')} aria-hidden />
        </button>
      ))}
    </div>
  );
}
