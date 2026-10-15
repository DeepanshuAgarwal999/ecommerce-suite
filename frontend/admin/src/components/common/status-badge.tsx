import { cn } from 'cn';
import { Badge } from '@/components/ui/badge';

type Tone = 'success' | 'warning' | 'destructive' | 'info' | 'neutral';

/**
 * One colour vocabulary for every status this console renders — vendor,
 * product, order, payment, refund. A reviewer scanning three different
 * tables should not have to learn three different meanings for amber.
 */
const STATUS_TONE: Record<string, Tone> = {
  // vendors
  PENDING: 'warning',
  UNDER_REVIEW: 'warning',
  APPROVED: 'success',
  REJECTED: 'destructive',
  SUSPENDED: 'destructive',

  // products
  DRAFT: 'neutral',
  PENDING_REVIEW: 'warning',
  ACTIVE: 'success',
  ARCHIVED: 'neutral',

  // orders
  PENDING_PAYMENT: 'warning',
  PAYMENT_FAILED: 'destructive',
  CONFIRMED: 'info',
  PACKED: 'info',
  SHIPPED: 'info',
  OUT_FOR_DELIVERY: 'info',
  DELIVERED: 'success',
  CANCELLED: 'destructive',
  RETURN_REQUESTED: 'warning',
  RETURN_APPROVED: 'info',
  RETURNED: 'neutral',
  REFUNDED: 'neutral',

  // payments / refunds
  CREATED: 'neutral',
  AUTHORIZED: 'info',
  CAPTURED: 'success',
  FAILED: 'destructive',
  REFUND_PENDING: 'warning',
  PARTIALLY_REFUNDED: 'warning',
  PROCESSED: 'success',

  // identities
  BLOCKED: 'destructive',
  DELETED: 'neutral',
};

const TONE_CLASSES: Record<Tone, string> = {
  success: 'border-transparent bg-status-success/15 text-status-success dark:bg-status-success/20',
  warning: 'border-transparent bg-status-warning/15 text-status-warning dark:bg-status-warning/20',
  destructive: 'border-transparent bg-destructive/10 text-destructive dark:bg-destructive/20',
  info: 'border-transparent bg-status-info/15 text-status-info dark:bg-status-info/20',
  neutral: 'border-transparent bg-status-neutral/15 text-status-neutral dark:bg-status-neutral/20',
};

export function StatusBadge({ status, className }: { status: string; className?: string }) {
  const tone = STATUS_TONE[status] ?? 'neutral';

  return (
    <Badge variant="outline" className={cn('font-medium', TONE_CLASSES[tone], className)}>
      {formatStatusLabel(status)}
    </Badge>
  );
}

function formatStatusLabel(status: string): string {
  return status
    .split('_')
    .map((word) => word.charAt(0) + word.slice(1).toLowerCase())
    .join(' ');
}
