/** Mirrors PaginationMeta / Paginated<T> in libs/contracts. */
export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrevious: boolean;
}

export interface Paginated<T> {
  items: T[];
  meta: PaginationMeta;
}
