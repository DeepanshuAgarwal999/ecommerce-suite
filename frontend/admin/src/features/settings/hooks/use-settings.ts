'use client';

import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import { isApiError } from '@/lib/api';
import { settingsApi } from '../api/settings-api';

export function useResetCache() {
  return useMutation({
    mutationFn: settingsApi.resetCache,
    onSuccess: (result) => {
      toast.success(`Cache cleared — ${result.deletedKeys} keys deleted.`);
    },
    onError: (error) => {
      toast.error(isApiError(error) ? error.message : 'Could not reset the cache.');
    },
  });
}
