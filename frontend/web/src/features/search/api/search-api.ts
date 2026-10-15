import { api, endpoints } from '@/lib/api';
import type { Suggestions } from '../types';

export const searchApi = {
  suggest: (q: string, signal?: AbortSignal) =>
    api.get<Suggestions>(endpoints.search.suggest, { searchParams: { q }, signal }),
};
