import { api, endpoints } from '@/lib/api';
import type { Brand, Category } from '../types';

/** Public catalog lookups, reused here to populate the create/edit form's pickers. */
export const catalogOptionsApi = {
  categories: () => api.get<Category[]>(endpoints.catalog.categories),
  brands: () => api.get<Brand[]>(endpoints.catalog.brands),
};
