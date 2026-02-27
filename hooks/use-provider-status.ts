'use client';

import { useState, useCallback } from 'react';

/**
 * Shared hook for provider availability check with local state.
 * Used by ProviderCard and ProviderListItem to avoid code duplication.
 */
export function useProviderStatus(
  providerId: string,
  initialAvailable: boolean | undefined,
  onCheckStatus: (providerId: string) => Promise<boolean>,
) {
  const [isChecking, setIsChecking] = useState(false);
  const [localAvailable, setLocalAvailable] = useState<boolean | undefined>(
    initialAvailable,
  );

  const handleCheckStatus = useCallback(async () => {
    setIsChecking(true);
    try {
      const available = await onCheckStatus(providerId);
      setLocalAvailable(available);
    } finally {
      setIsChecking(false);
    }
  }, [onCheckStatus, providerId]);

  const availabilityStatus = localAvailable ?? initialAvailable;

  return { isChecking, availabilityStatus, handleCheckStatus };
}
