import { cn } from '@/lib/utils';
import { discountPercent, formatPrice } from '@/lib/utils/format';

const sizeStyles = {
  sm: { price: 'text-sm', mrp: 'text-xs', off: 'text-[10px]' },
  md: { price: 'text-base', mrp: 'text-sm', off: 'text-xs' },
  lg: { price: 'text-2xl', mrp: 'text-base', off: 'text-sm' },
} as const;

interface PriceProps {
  pricePaise: number;
  mrpPaise: number;
  size?: keyof typeof sizeStyles;
  className?: string;
}

/** Price, struck-through MRP and percent off — the standard commerce triplet. */
export function Price({
  pricePaise,
  mrpPaise,
  size = 'md',
  className,
}: PriceProps) {
  const off = discountPercent(mrpPaise, pricePaise);
  const styles = sizeStyles[size];

  return (
    <div className={cn('flex flex-wrap items-baseline gap-1.5', className)}>
      <span className={cn('font-semibold tabular-nums', styles.price)}>
        {formatPrice(pricePaise)}
      </span>
      {off > 0 && (
        <>
          <span
            className={cn(
              'text-muted-foreground line-through tabular-nums',
              styles.mrp,
            )}
          >
            {formatPrice(mrpPaise)}
          </span>
          <span className={cn('text-success font-semibold', styles.off)}>
            {off}% OFF
          </span>
        </>
      )}
    </div>
  );
}
