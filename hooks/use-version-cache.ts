'use client';

import { useCallback, useRef } from 'react';
import { useEnvironmentStore } from '@/lib/stores/environment';

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

interface UseVersionCacheOptions {
  expiryMs?: number;
}

const DEFAULT_EXPIRY_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Hook for managing version cache with automatic expiry
 */
export function useVersionCache<T>({
  expiryMs = DEFAULT_EXPIRY_MS,
}: UseVersionCacheOptions = {}) {
  const cacheRef = useRef<Map<string, CacheEntry<T>>>(new Map());

  const get = useCallback(
    (key: string): T | null => {
      const entry = cacheRef.current.get(key);
      if (!entry) return null;

      const isExpired = Date.now() - entry.timestamp > expiryMs;
      if (isExpired) {
        cacheRef.current.delete(key);
        return null;
      }

      return entry.data;
    },
    [expiryMs]
  );

  const set = useCallback((key: string, data: T) => {
    cacheRef.current.set(key, {
      data,
      timestamp: Date.now(),
    });
  }, []);

  const invalidate = useCallback((key: string) => {
    cacheRef.current.delete(key);
  }, []);

  const invalidateAll = useCallback(() => {
    cacheRef.current.clear();
  }, []);

  const isValid = useCallback(
    (key: string): boolean => {
      const entry = cacheRef.current.get(key);
      if (!entry) return false;
      return Date.now() - entry.timestamp <= expiryMs;
    },
    [expiryMs]
  );

  return {
    get,
    set,
    invalidate,
    invalidateAll,
    isValid,
  };
}

/**
 * Hook for caching available versions with automatic refresh
 */
const VERSION_CACHE_EXPIRY_MS = 5 * 60 * 1000; // 5 minutes

export function useAvailableVersionsCache() {
  const { availableVersions, setAvailableVersions } = useEnvironmentStore();
  const timestampsRef = useRef<Record<string, number>>({});

  const isCacheValid = useCallback((envType: string): boolean => {
    const timestamp = timestampsRef.current[envType];
    if (!timestamp) return false;
    return Date.now() - timestamp <= VERSION_CACHE_EXPIRY_MS;
  }, []);

  const getCachedVersions = useCallback(
    (envType: string) => {
      if (!isCacheValid(envType)) {
        return null;
      }
      return availableVersions[envType] || null;
    },
    [availableVersions, isCacheValid]
  );

  const setCachedVersions = useCallback(
    (envType: string, versions: typeof availableVersions[string]) => {
      setAvailableVersions(envType, versions);
      timestampsRef.current[envType] = Date.now();
    },
    [setAvailableVersions]
  );

  const invalidateCache = useCallback((envType?: string) => {
    if (envType) {
      delete timestampsRef.current[envType];
    } else {
      timestampsRef.current = {};
    }
  }, []);

  return {
    getCachedVersions,
    setCachedVersions,
    isCacheValid,
    invalidateCache,
  };
}
