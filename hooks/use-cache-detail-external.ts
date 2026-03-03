'use client';

import { useExternalCache } from '@/hooks/use-external-cache';

interface UseCacheDetailExternalOptions {
  t: (key: string, params?: Record<string, string | number>) => string;
}

export function useCacheDetailExternal({ t }: UseCacheDetailExternalOptions) {
  return useExternalCache({
    t,
    includePathInfos: true,
    autoFetch: true,
    defaultUseTrash: true,
  });
}
