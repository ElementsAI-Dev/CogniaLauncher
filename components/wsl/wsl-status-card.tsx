'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Activity, RefreshCw, Power, Info } from 'lucide-react';
import type { WslStatus } from '@/types/tauri';

interface WslStatusCardProps {
  status: WslStatus | null;
  loading: boolean;
  onRefresh: () => void;
  onShutdownAll: () => void;
  t: (key: string, params?: Record<string, string | number>) => string;
}

export function WslStatusCard({
  status,
  loading,
  onRefresh,
  onShutdownAll,
  t,
}: WslStatusCardProps) {
  if (loading && !status) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-32" />
        </CardHeader>
        <CardContent className="space-y-3">
          <Skeleton className="h-4 w-48" />
          <Skeleton className="h-4 w-36" />
          <Skeleton className="h-4 w-40" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
        <CardTitle className="text-base font-semibold flex items-center gap-2">
          <Info className="h-4 w-4 text-muted-foreground" />
          {t('wsl.status')}
        </CardTitle>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={onRefresh}
            disabled={loading}
            className="h-8 w-8"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">{t('wsl.kernelVersion')}</span>
          <span className="text-sm font-mono">{status?.version ?? '—'}</span>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground flex items-center gap-1.5">
              <Activity className="h-3.5 w-3.5" />
              {t('wsl.runningDistros')}
            </span>
            <Badge variant={status?.running_distros.length ? 'default' : 'secondary'}>
              {status?.running_distros.length ?? 0}
            </Badge>
          </div>

          {status?.running_distros.length ? (
            <div className="flex flex-wrap gap-1.5">
              {status.running_distros.map((name) => (
                <Badge key={name} variant="outline" className="text-xs">
                  {name}
                </Badge>
              ))}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">{t('wsl.noRunning')}</p>
          )}
        </div>

        {status?.running_distros.length ? (
          <Button
            variant="destructive"
            size="sm"
            className="w-full gap-2"
            onClick={onShutdownAll}
          >
            <Power className="h-3.5 w-3.5" />
            {t('wsl.shutdown')}
          </Button>
        ) : null}
      </CardContent>
    </Card>
  );
}
