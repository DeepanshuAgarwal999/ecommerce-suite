/** Envelope every paginated gateway list endpoint returns. */
export interface Paginated<T> {
  items: T[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrevious: boolean;
  };
}

/** Cursor pagination, used by the infinite product and search feeds. */
export interface CursorPage<T> {
  items: T[];
  nextCursor: string | null;
}

export interface Money {
  /** Integer paise. Never a float — see lib/utils/format. */
  amount: number;
  currency: 'INR';
}

export type Nullable<T> = T | null;

/** Async UI state for hand-rolled (non-Query) flows. */
export type LoadState = 'idle' | 'loading' | 'success' | 'error';
