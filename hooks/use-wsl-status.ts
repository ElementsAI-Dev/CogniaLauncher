import { useEffect, useState } from 'react';
import { isTauri } from '@/lib/tauri';
import type { WslDistroStatus, WslStatus } from '@/types/tauri';

export interface UseWslStatusReturn {
  available: boolean | null;
  distros: WslDistroStatus[];
  status: WslStatus | null;
  runningCount: number;
}

export function useWslStatus(): UseWslStatusReturn {
  const [available, setAvailable] = useState<boolean | null>(null);
  const [distros, setDistros] = useState<WslDistroStatus[]>([]);
  const [status, setStatus] = useState<WslStatus | null>(null);

  useEffect(() => {
    if (!isTauri()) {
      setAvailable(false);
      return;
    }

    const load = async () => {
      try {
        const { wslIsAvailable, wslListDistros, wslGetStatus } = await import('@/lib/tauri');
        const isAvail = await wslIsAvailable();
        setAvailable(isAvail);
        if (isAvail) {
          const [d, s] = await Promise.allSettled([wslListDistros(), wslGetStatus()]);
          if (d.status === 'fulfilled') setDistros(d.value);
          if (s.status === 'fulfilled') setStatus(s.value);
        }
      } catch {
        setAvailable(false);
      }
    };
    load();
  }, []);

  const runningCount = distros.filter((d) => d.state.toLowerCase() === 'running').length;

  return { available, distros, status, runningCount };
}
