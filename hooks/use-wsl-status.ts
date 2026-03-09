import { useEffect, useMemo, useState } from 'react';
import { isTauri } from '@/lib/tauri';
import type { WslCapabilities, WslDistroStatus, WslStatus } from '@/types/tauri';
import type { WslCompletenessSnapshot } from '@/types/wsl';
import { deriveWslCompleteness } from '@/lib/wsl/completeness';

export interface UseWslStatusReturn {
  available: boolean | null;
  distros: WslDistroStatus[];
  status: WslStatus | null;
  runningCount: number;
  completeness: WslCompletenessSnapshot;
}

export function useWslStatus(): UseWslStatusReturn {
  const [available, setAvailable] = useState<boolean | null>(null);
  const [distros, setDistros] = useState<WslDistroStatus[]>([]);
  const [status, setStatus] = useState<WslStatus | null>(null);
  const [capabilities, setCapabilities] = useState<WslCapabilities | null>(null);

  useEffect(() => {
    if (!isTauri()) {
      setAvailable(false);
      setCapabilities(null);
      return;
    }

    const load = async () => {
      try {
        const { wslIsAvailable, wslListDistros, wslGetStatus } = await import('@/lib/tauri');
        const isAvail = await wslIsAvailable();
        setAvailable(isAvail);
        if (isAvail) {
          const { wslGetCapabilities } = await import('@/lib/tauri');
          const [d, s, c] = await Promise.allSettled([wslListDistros(), wslGetStatus(), wslGetCapabilities()]);
          if (d.status === 'fulfilled') setDistros(d.value);
          if (s.status === 'fulfilled') setStatus(s.value);
          if (c.status === 'fulfilled') setCapabilities(c.value);
        } else {
          setCapabilities(null);
        }
      } catch {
        setAvailable(false);
        setCapabilities(null);
      }
    };
    load();
  }, []);

  const runningCount = distros.filter((d) => d.state.toLowerCase() === 'running').length;
  const completeness = useMemo(
    () => deriveWslCompleteness(available, distros, status, capabilities),
    [available, capabilities, distros, status]
  );

  return { available, distros, status, runningCount, completeness };
}
