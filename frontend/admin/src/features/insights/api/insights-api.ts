import { api, endpoints } from '@/lib/api';
import type { InsightRange, Insights } from '../types';

export const insightsApi = {
  get: (days: InsightRange) => api.get<Insights>(endpoints.admin.insights, { searchParams: { days } }),
};
