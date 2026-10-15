const INR = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 0,
});

const DATE = new Intl.DateTimeFormat('en-IN', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
});

const DATETIME = new Intl.DateTimeFormat('en-IN', {
  day: 'numeric',
  month: 'short',
  hour: 'numeric',
  minute: '2-digit',
});

/** Money crosses the wire as integer paise so it never hits float rounding. */
export function formatPrice(paise: number): string {
  return INR.format(paise / 100);
}

export function formatDate(value: string | Date): string {
  return DATE.format(new Date(value));
}

export function formatDateTime(value: string | Date): string {
  return DATETIME.format(new Date(value));
}

/** Title Case from an ENUM_LIKE status: "PENDING_REVIEW" -> "Pending review". */
export function titleCaseStatus(status: string): string {
  const lower = status.toLowerCase().replace(/_/g, ' ');
  return lower.charAt(0).toUpperCase() + lower.slice(1);
}

export function initials(name: string): string {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('');
}
