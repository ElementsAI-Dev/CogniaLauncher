'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { isInternalNavigationPath } from '@/lib/plugin-navigation';
import { isTauri, listenPluginUiEffect } from '@/lib/tauri';

export function usePluginUiEffects() {
  const router = useRouter();

  useEffect(() => {
    if (!isTauri()) return;

    let unlisten: (() => void) | undefined;

    listenPluginUiEffect((effect) => {
      if (effect.effect === 'toast') {
        const message = typeof effect.payload.message === 'string' ? effect.payload.message : '';
        const level = typeof effect.payload.level === 'string' ? effect.payload.level : 'info';

        if (level === 'success') {
          toast.success(message);
          return;
        }
        if (level === 'warning') {
          toast.warning(message);
          return;
        }
        if (level === 'error') {
          toast.error(message);
          return;
        }

        toast.info(message);
        return;
      }

      if (effect.effect === 'navigate') {
        const path = typeof effect.payload.path === 'string' ? effect.payload.path : '';
        if (isInternalNavigationPath(path)) {
          router.push(path);
        }
      }
    }).then((fn) => {
      unlisten = fn;
    });

    return () => {
      unlisten?.();
    };
  }, [router]);
}
