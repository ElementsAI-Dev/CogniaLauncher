'use client';

import { useState, useEffect, useCallback } from 'react';

export interface NetworkStatus {
  online: boolean;
  effectiveType?: 'slow-2g' | '2g' | '3g' | '4g';
  downlink?: number;
  rtt?: number;
}

function getInitialNetworkStatus(): NetworkStatus {
  if (typeof navigator === 'undefined') {
    return { online: true };
  }
  
  const connection = (navigator as Navigator & {
    connection?: {
      effectiveType?: 'slow-2g' | '2g' | '3g' | '4g';
      downlink?: number;
      rtt?: number;
    };
  }).connection;

  return {
    online: navigator.onLine,
    effectiveType: connection?.effectiveType,
    downlink: connection?.downlink,
    rtt: connection?.rtt,
  };
}

export function useNetwork() {
  const [status, setStatus] = useState<NetworkStatus>(getInitialNetworkStatus);

  const updateNetworkStatus = useCallback(() => {
    setStatus(getInitialNetworkStatus());
  }, []);

  useEffect(() => {
    // Listen for online/offline events
    window.addEventListener('online', updateNetworkStatus);
    window.addEventListener('offline', updateNetworkStatus);

    // Listen for connection changes (if supported)
    const connection = (navigator as Navigator & {
      connection?: EventTarget & {
        addEventListener: (type: string, listener: () => void) => void;
        removeEventListener: (type: string, listener: () => void) => void;
      };
    }).connection;

    if (connection) {
      connection.addEventListener('change', updateNetworkStatus);
    }

    return () => {
      window.removeEventListener('online', updateNetworkStatus);
      window.removeEventListener('offline', updateNetworkStatus);
      if (connection) {
        connection.removeEventListener('change', updateNetworkStatus);
      }
    };
  }, [updateNetworkStatus]);

  return status;
}
