import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { titleCaseStatus } from '@/lib/utils/format';

type Tone = 'neutral' | 'success' | 'warning' | 'destructive';

/** Status -> colour. Covers ProductStatus, OrderStatus and VendorStatus — every
 *  status string in the app is one of these words or falls back to neutral. */
const toneByStatus: Record<string, Tone> = {
  // Vendor / shared
  PENDING: 'warning',
  UNDER_REVIEW: 'warning',
  APPROVED: 'success',
  ACTIVE: 'success',
  REJECTED: 'destructive',
  SUSPENDED: 'destructive',
  // Product
  DRAFT: 'neutral',
  PENDING_REVIEW: 'warning',
  ARCHIVED: 'neutral',
  // Order
  PENDING_PAYMENT: 'warning',
  PAYMENT_FAILED: 'destructive',
  CONFIRMED: 'warning',
  PACKED: 'warning',
  SHIPPED: 'success',
  OUT_FOR_DELIVERY: 'success',
  DELIVERED: 'success',
  CANCELLED: 'destructive',
  RETURN_REQUESTED: 'warning',
  RETURN_APPROVED: 'warning',
  RETURNED: 'neutral',
  REFUNDED: 'neutral',
};

const toneClass: Record<Tone, string> = {
  neutral: 'bg-muted text-muted-foreground',
  success: 'bg-[oklch(0.94_0.04_150)] text-success',
  warning: 'bg-[oklch(0.96_0.04_85)] text-[oklch(0.5_0.14_70)]',
  destructive: 'bg-[oklch(0.95_0.03_27)] text-destructive',
};

export function StatusBadge({ status, className }: { status: string; className?: string }) {
  const tone = toneByStatus[status] ?? 'neutral';
  return (
    <Badge variant="outline" className={cn('border-transparent font-bold', toneClass[tone], className)}>
      {titleCaseStatus(status)}
    </Badge>
  );
}
