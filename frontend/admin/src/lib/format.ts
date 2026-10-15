import { format, formatDistanceToNow } from 'date-fns';

/** Every amount in the platform is an integer count of paise — see libs/common/money.util. */
export function formatMoney(paise: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(paise / 100);
}

export function formatNumber(value: number): string {
  return new Intl.NumberFormat('en-IN').format(value);
}

export function formatDate(value: string | Date, pattern = 'd MMM yyyy'): string {
  return format(new Date(value), pattern);
}

export function formatDateTime(value: string | Date): string {
  return format(new Date(value), 'd MMM yyyy, h:mm a');
}

export function formatRelative(value: string | Date): string {
  return formatDistanceToNow(new Date(value), { addSuffix: true });
}
