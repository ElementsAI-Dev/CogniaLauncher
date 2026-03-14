'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ProviderStatusInfo } from '@/types/tauri';
import {
  isProviderStatusAvailable,
  normalizeProviderStatus,
  type ProviderStatusLike,
} from '@/lib/utils/provider';

/**
 * Shared hook for provider availability check with local state.
 * Used by ProviderCard and ProviderListItem to avoid code duplication.
 */
export function useProviderStatus(
  providerId: string,
  initialStatus: ProviderStatusLike,
  onCheckStatus: (providerId: string) => Promise<ProviderStatusLike>,
) {
  const [isChecking, setIsChecking] = useState(false);
  const normalizedInitialStatus = useMemo(
    () => normalizeProviderStatus(providerId, initialStatus),
    [providerId, initialStatus],
  );
  const [localStatus, setLocalStatus] = useState<ProviderStatusInfo | undefined>(
    normalizedInitialStatus,
  );

  useEffect(() => {
    setLocalStatus(normalizedInitialStatus);
  }, [normalizedInitialStatus]);

  const handleCheckStatus = useCallback(async () => {
    setIsChecking(true);
    try {
      const nextStatus = await onCheckStatus(providerId);
      setLocalStatus(normalizeProviderStatus(providerId, nextStatus));
    } finally {
      setIsChecking(false);
    }
  }, [onCheckStatus, providerId]);

  const statusInfo = localStatus ?? normalizedInitialStatus;
  const availabilityStatus = isProviderStatusAvailable(statusInfo);

  return { isChecking, statusInfo, availabilityStatus, handleCheckStatus };
}
