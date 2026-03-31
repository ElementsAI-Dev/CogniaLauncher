import { useEffect, useMemo, useState } from 'react';
import { isTauri } from '@/lib/tauri';
import type {
  WslCapabilities,
  WslDistroStatus,
  WslRuntimeSnapshot,
  WslStatus,
} from '@/types/tauri';
import type { WslCompletenessSnapshot } from '@/types/wsl';
import { deriveWslCompleteness } from '@/lib/wsl/completeness';

export interface UseWslStatusReturn {
  available: boolean | null;
  distros: WslDistroStatus[];
  status: WslStatus | null;
  runningCount: number;
  completeness: WslCompletenessSnapshot;
  runtimeSnapshot: WslRuntimeSnapshot | null;
}

export function useWslStatus(): UseWslStatusReturn {
  const [available, setAvailable] = useState<boolean | null>(null);
  const [distros, setDistros] = useState<WslDistroStatus[]>([]);
  const [status, setStatus] = useState<WslStatus | null>(null);
  const [capabilities, setCapabilities] = useState<WslCapabilities | null>(null);
  const [runtimeSnapshot, setRuntimeSnapshot] = useState<WslRuntimeSnapshot | null>(null);

  useEffect(() => {
    if (!isTauri()) {
      setAvailable(false);
      setCapabilities(null);
      setRuntimeSnapshot(null);
      return;
    }

    const load = async () => {
      try {
        const { wslGetRuntimeSnapshot, wslListDistros, wslGetStatus, wslGetCapabilities } = await import('@/lib/tauri');
        const snapshot = await wslGetRuntimeSnapshot();
        setRuntimeSnapshot(snapshot);
        setAvailable(snapshot.available);

        if (snapshot.available) {
          const [d, s, c] = await Promise.allSettled([
            wslListDistros(),
            wslGetStatus(),
            wslGetCapabilities(),
          ]);
          if (d.status === 'fulfilled') {
            setDistros(d.value);
          } else {
            setDistros([]);
          }
          if (s.status === 'fulfilled') {
            setStatus(s.value);
          } else {
            setStatus(null);
          }
          if (c.status === 'fulfilled') {
            setCapabilities(c.value);
          } else {
            setCapabilities(null);
          }
        } else {
          setDistros([]);
          setStatus(null);
          setCapabilities(null);
        }
      } catch {
        // Backward-compatible fallback path when snapshot command is unavailable.
        try {
          const { wslIsAvailable, wslListDistros, wslGetStatus, wslGetCapabilities } = await import('@/lib/tauri');
          const isAvail = await wslIsAvailable();
          setAvailable(isAvail);
          setRuntimeSnapshot(null);
          if (isAvail) {
            const [d, s, c] = await Promise.allSettled([
              wslListDistros(),
              wslGetStatus(),
              wslGetCapabilities(),
            ]);
            if (d.status === 'fulfilled') setDistros(d.value);
            if (s.status === 'fulfilled') setStatus(s.value);
            if (c.status === 'fulfilled') setCapabilities(c.value);
          } else {
            setDistros([]);
            setStatus(null);
            setCapabilities(null);
          }
        } catch {
          setAvailable(false);
          setDistros([]);
          setStatus(null);
          setCapabilities(null);
          setRuntimeSnapshot(null);
        }
      }
    };
    load();
  }, []);

  const runningCount = distros.filter((d) => d.state.toLowerCase() === 'running').length;
  const completeness = useMemo(
    () => deriveWslCompleteness(available, distros, status, capabilities, runtimeSnapshot),
    [available, capabilities, distros, runtimeSnapshot, status]
  );

  return { available, distros, status, runningCount, completeness, runtimeSnapshot };
}
