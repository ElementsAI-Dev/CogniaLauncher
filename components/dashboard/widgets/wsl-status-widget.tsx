'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useLocale } from '@/components/providers/locale-provider';
import { isTauri } from '@/lib/tauri';
import { Terminal, ExternalLink } from 'lucide-react';
import Link from 'next/link';
import type { WslDistroStatus, WslStatus } from '@/types/tauri';

export function WslStatusWidget() {
  const { t } = useLocale();
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

  if (available === false) {
    return (
      <div className="p-4 text-center text-sm text-muted-foreground">
        <Terminal className="h-8 w-8 mx-auto mb-2 opacity-50" />
        <p>{t('wsl.notAvailable')}</p>
      </div>
    );
  }

  const running = distros.filter((d) => d.state.toLowerCase() === 'running').length;

  return (
    <div className="space-y-3">
      <div className="grid gap-3 grid-cols-3">
        <Card>
          <CardContent className="p-3 text-center">
            <p className="text-2xl font-bold">{distros.length}</p>
            <p className="text-xs text-muted-foreground">{t('wsl.distros')}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 text-center">
            <p className="text-2xl font-bold text-green-600">{running}</p>
            <p className="text-xs text-muted-foreground">{t('wsl.running')}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 text-center">
            <p className="text-sm font-mono truncate">{status?.version ?? '—'}</p>
            <p className="text-xs text-muted-foreground">{t('wsl.kernelVersion')}</p>
          </CardContent>
        </Card>
      </div>

      {distros.length > 0 && (
        <div className="space-y-1.5">
          {distros.slice(0, 4).map((d) => (
            <div key={d.name} className="flex items-center justify-between text-sm px-1">
              <span className="truncate font-medium">{d.name}</span>
              <Badge
                variant={d.state.toLowerCase() === 'running' ? 'default' : 'secondary'}
                className="text-xs"
              >
                {d.state.toLowerCase() === 'running' ? t('wsl.running') : t('wsl.stopped')}
              </Badge>
            </div>
          ))}
          {distros.length > 4 && (
            <p className="text-xs text-muted-foreground text-center">
              +{distros.length - 4} more
            </p>
          )}
        </div>
      )}

      <Button variant="outline" size="sm" className="w-full gap-2" asChild>
        <Link href="/wsl">
          <ExternalLink className="h-3.5 w-3.5" />
          {t('wsl.title')}
        </Link>
      </Button>
    </div>
  );
}
