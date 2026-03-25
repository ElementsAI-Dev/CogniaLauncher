/**
 * Provider-related utility functions
 * Extracted from components/settings/provider-settings.tsx
 */

import type { ProviderStatusInfo } from '@/types/tauri';

export type ProviderStatusLike = ProviderStatusInfo | boolean | null | undefined;
export type ProviderStatusState =
  | 'available'
  | 'unavailable'
  | 'timeout'
  | 'unsupported'
  | 'unknown';

/** Normalize a provider list value from JSON array or comma-separated string */
export function normalizeProviderList(rawValue: string): string {
  const trimmed = rawValue.trim();
  if (!trimmed) return "";

  if (trimmed.startsWith("[")) {
    try {
      const parsed = JSON.parse(trimmed) as string[];
      if (Array.isArray(parsed)) {
        return parsed.filter(Boolean).join(", ");
      }
    } catch {
      return rawValue;
    }
  }

  return rawValue;
}

export function normalizeProviderStatus(
  providerId: string,
  status: ProviderStatusLike,
): ProviderStatusInfo | undefined {
  if (status == null) return undefined;

  if (typeof status === 'boolean') {
    return {
      id: providerId,
      display_name: providerId,
      installed: status,
      platforms: [],
      scope_state: status ? 'available' : 'unavailable',
      scope_reason: null,
      status: status ? 'supported' : 'unsupported',
      reason: null,
      reason_code: null,
      update_supported: status,
      update_reason: null,
      update_reason_code: null,
    };
  }

  return status;
}

export function getProviderStatusState(
  status: ProviderStatusLike,
): ProviderStatusState {
  if (status == null) return 'unknown';

  if (typeof status === 'boolean') {
    return status ? 'available' : 'unavailable';
  }

  switch (status.scope_state) {
    case 'available':
      return 'available';
    case 'timeout':
      return 'timeout';
    case 'unsupported':
      return 'unsupported';
    case 'unavailable':
      return 'unavailable';
    default:
      return status.installed ? 'available' : 'unavailable';
  }
}

export function isProviderStatusAvailable(
  status: ProviderStatusLike,
): boolean | undefined {
  const state = getProviderStatusState(status);
  if (state === 'unknown') {
    return undefined;
  }
  return state === 'available';
}

export function getProviderStatusTextKey(
  state: ProviderStatusState,
): string {
  switch (state) {
    case 'available':
      return 'providers.statusAvailable';
    case 'timeout':
      return 'providers.statusTimeout';
    case 'unsupported':
      return 'providers.statusUnsupported';
    case 'unavailable':
      return 'providers.statusUnavailable';
    default:
      return 'providers.statusUnknown';
  }
}

export function getProviderStatusReason(
  status: ProviderStatusLike,
): string | null {
  const normalized =
    typeof status === 'boolean' ? normalizeProviderStatus('', status) : status;

  if (!normalized) {
    return null;
  }

  return normalized.reason ?? normalized.reason_code ?? normalized.scope_reason ?? null;
}

/**
 * Derive a unified status state from either a ProviderStatusInfo or a boolean availability flag.
 * Consolidates the duplicated pattern found in detail header and overview tab.
 */
export function deriveProviderStatusState(
  statusInfo: ProviderStatusInfo | null | undefined,
  isAvailable: boolean | null,
): ProviderStatusState {
  if (statusInfo) {
    return getProviderStatusState(statusInfo);
  }
  if (isAvailable === null) {
    return 'unknown';
  }
  return isAvailable ? 'available' : 'unavailable';
}

export function getProviderStatusSortValue(
  status: ProviderStatusLike,
): number {
  switch (getProviderStatusState(status)) {
    case 'available':
      return 4;
    case 'timeout':
      return 3;
    case 'unsupported':
      return 2;
    case 'unavailable':
      return 1;
    default:
      return 0;
  }
}
