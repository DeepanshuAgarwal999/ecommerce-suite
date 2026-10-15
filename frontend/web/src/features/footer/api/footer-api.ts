import { api, endpoints } from '@/lib/api';
import type { FooterData } from '../types';

export const footerApi = {
  get: (init?: RequestInit) => api.get<FooterData>(endpoints.footer, init),
};
