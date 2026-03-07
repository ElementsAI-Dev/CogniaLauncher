'use client';

import { isTauri } from '@/lib/tauri';

export type CacheInvalidationDomain =
  | 'cache_overview'
  | 'cache_entries'
  | 'external_cache'
  | 'package_data'
  | 'environment_data'
  | 'provider_data'
  | 'about_cache_stats';

export type CacheInvalidationSource = 'manual' | 'backend';

export interface CacheInvalidationEvent {
  domain: CacheInvalidationDomain;
  reason: string;
  source: CacheInvalidationSource;
  timestamp: number;
  payload?: unknown;
}

type InvalidationHandler = (event: CacheInvalidationEvent) => void;

const listeners = new Map<CacheInvalidationDomain, Set<InvalidationHandler>>();

let bridgeStarted = false;
let bridgeStartPromise: Promise<void> | null = null;

const BACKEND_CACHE_DOMAINS: CacheInvalidationDomain[] = [
  'cache_overview',
  'cache_entries',
  'external_cache',
  'package_data',
  'environment_data',
  'provider_data',
  'about_cache_stats',
];

function isCacheInvalidationDomain(value: string): value is CacheInvalidationDomain {
  return BACKEND_CACHE_DOMAINS.includes(value as CacheInvalidationDomain);
}

function resolveBackendDomains(payload: unknown): CacheInvalidationDomain[] {
  if (!payload || typeof payload !== 'object' || !('domains' in payload)) {
    return BACKEND_CACHE_DOMAINS;
  }

  const domains = (payload as { domains?: unknown }).domains;
  if (!Array.isArray(domains)) {
    return BACKEND_CACHE_DOMAINS;
  }

  const filtered = domains.filter(
    (domain): domain is CacheInvalidationDomain =>
      typeof domain === 'string' && isCacheInvalidationDomain(domain),
  );

  return filtered.length > 0 ? filtered : BACKEND_CACHE_DOMAINS;
}

export function emitInvalidation(
  domain: CacheInvalidationDomain,
  reason: string,
  source: CacheInvalidationSource = 'manual',
  payload?: unknown,
) {
  const handlers = listeners.get(domain);
  if (!handlers || handlers.size === 0) return;

  const event: CacheInvalidationEvent = {
    domain,
    reason,
    source,
    timestamp: Date.now(),
    payload,
  };

  handlers.forEach((handler) => {
    try {
      handler(event);
    } catch {
      // keep fanout resilient to handler failures
    }
  });
}

export function emitInvalidations(
  domains: CacheInvalidationDomain[],
  reason: string,
  source: CacheInvalidationSource = 'manual',
  payload?: unknown,
) {
  domains.forEach((domain) => emitInvalidation(domain, reason, source, payload));
}

export function subscribeInvalidation(
  domain: CacheInvalidationDomain | CacheInvalidationDomain[],
  handler: InvalidationHandler,
): () => void {
  const domains = Array.isArray(domain) ? domain : [domain];

  domains.forEach((key) => {
    const bucket = listeners.get(key) ?? new Set<InvalidationHandler>();
    bucket.add(handler);
    listeners.set(key, bucket);
  });

  return () => {
    domains.forEach((key) => {
      const bucket = listeners.get(key);
      if (!bucket) return;
      bucket.delete(handler);
      if (bucket.size === 0) {
        listeners.delete(key);
      }
    });
  };
}

export function withThrottle<TArgs extends unknown[]>(
  fn: (...args: TArgs) => void,
  ms = 350,
): (...args: TArgs) => void {
  let timeout: ReturnType<typeof setTimeout> | null = null;

  return (...args: TArgs) => {
    if (timeout) return;
    timeout = setTimeout(() => {
      timeout = null;
      fn(...args);
    }, ms);
  };
}

export async function ensureCacheInvalidationBridge(): Promise<void> {
  if (typeof window === 'undefined') return;
  if (!isTauri()) return;
  if (bridgeStarted) return;
  if (bridgeStartPromise) return bridgeStartPromise;

  bridgeStartPromise = (async () => {
    try {
      const mod = await import('@/lib/tauri');
      const listenChanged = mod.listenCacheChanged as
        | ((handler: (event: unknown) => void) => Promise<() => void>)
        | undefined;
      const listenAutoCleaned = mod.listenCacheAutoCleaned as
        | ((handler: (event: unknown) => void) => Promise<() => void>)
        | undefined;

      if (typeof listenChanged !== 'function' || typeof listenAutoCleaned !== 'function') {
        return;
      }

      await Promise.all([
        listenChanged((event) => {
          emitInvalidations(resolveBackendDomains(event), 'backend:cache-changed', 'backend', event);
        }),
        listenAutoCleaned((event) => {
          emitInvalidations(resolveBackendDomains(event), 'backend:auto-cleaned', 'backend', event);
        }),
      ]);

      bridgeStarted = true;
    } catch {
      // no-op: bridge is best-effort in non-tauri or test environments
    } finally {
      bridgeStartPromise = null;
    }
  })();

  return bridgeStartPromise;
}
