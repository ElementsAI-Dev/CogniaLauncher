'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardAction } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Activity, RefreshCw, Power, Info, Network, Globe, Copy } from 'lucide-react';
import { toast } from 'sonner';
import { NETWORKING_MODE_INFO } from '@/lib/constants/wsl';
import type { WslStatusCardProps } from '@/types/wsl';

export function WslStatusCard({
  status,
  loading,
  onRefresh,
  onShutdownAll,
  getIpAddress,
  config,
  t,
}: WslStatusCardProps) {
  const [ipAddress, setIpAddress] = useState<string | null>(null);
  const runningCount = status?.runningDistros.length ?? 0;

  const shouldFetchIp = !!getIpAddress && runningCount > 0;
  const ipToShow = shouldFetchIp ? ipAddress : null;

  useEffect(() => {
    if (!shouldFetchIp) return;
    let cancelled = false;
    getIpAddress!()
      .then((ip) => { if (!cancelled) setIpAddress(ip); })
      .catch(() => { if (!cancelled) setIpAddress(null); });
    return () => { cancelled = true; };
  }, [shouldFetchIp, getIpAddress]);

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
      <CardHeader>
        <CardTitle className="text-base font-semibold flex items-center gap-2">
          <Info className="h-4 w-4 text-muted-foreground" />
          {t('wsl.status')}
        </CardTitle>
        <CardAction>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                onClick={onRefresh}
                disabled={loading}
                className="h-8 w-8"
              >
                <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              </Button>
            </TooltipTrigger>
            <TooltipContent>{t('common.refresh')}</TooltipContent>
          </Tooltip>
        </CardAction>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <span className="text-sm text-muted-foreground">{t('wsl.wslVersion')}</span>
          <span className="truncate text-sm font-mono">{status?.version ?? '—'}</span>
        </div>

        {status?.kernelVersion && (
          <div className="flex items-center justify-between gap-3">
            <span className="text-sm text-muted-foreground">{t('wsl.kernelVersion')}</span>
            <span className="truncate text-sm font-mono">{status.kernelVersion}</span>
          </div>
        )}

        {status?.wslgVersion && (
          <div className="flex items-center justify-between gap-3">
            <span className="text-sm text-muted-foreground">{t('wsl.wslgVersion')}</span>
            <span className="truncate text-sm font-mono">{status.wslgVersion}</span>
          </div>
        )}

        {status?.defaultDistribution && (
          <div className="flex items-center justify-between gap-3">
            <span className="text-sm text-muted-foreground">{t('wsl.defaultDistribution')}</span>
            <Badge variant="outline" className="text-xs font-mono">
              {status.defaultDistribution}
            </Badge>
          </div>
        )}

        {ipToShow && (
          <div className="flex items-center justify-between gap-3">
            <span className="text-sm text-muted-foreground flex items-center gap-1.5">
              <Network className="h-3.5 w-3.5" />
              {t('wsl.ipAddress')}
            </span>
            <span className="truncate text-sm font-mono">{ipToShow}</span>
            {ipAddress && (
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 shrink-0 ml-1"
                onClick={() => { void navigator.clipboard.writeText(ipAddress); toast.success(t('common.copied')); }}
              >
                <Copy className="h-3 w-3" />
              </Button>
            )}
          </div>
        )}

        {(() => {
          const mode = config?.['wsl2']?.['networkingMode'] ?? 'NAT';
          const modeInfo = NETWORKING_MODE_INFO[mode] ?? NETWORKING_MODE_INFO['NAT'];
          return (
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground flex items-center gap-1.5">
                <Globe className="h-3.5 w-3.5" />
                {t('wsl.networkingModeLabel') || 'Network'}
              </span>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Badge variant="outline" className="text-xs font-mono">
                    {t(modeInfo.labelKey)}
                  </Badge>
                </TooltipTrigger>
                <TooltipContent side="left" className="max-w-[260px]">
                  <p className="text-xs">{t(modeInfo.descKey)}</p>
                </TooltipContent>
              </Tooltip>
            </div>
          );
        })()}

        <Separator className="my-2" />

        <div className="space-y-2">
          <div className="flex items-center justify-between gap-3">
            <span className="text-sm text-muted-foreground flex items-center gap-1.5">
              <Activity className="h-3.5 w-3.5" />
              {t('wsl.runningDistros')}
            </span>
            <Badge variant={status?.runningDistros.length ? 'default' : 'secondary'}>
              {status?.runningDistros.length ?? 0}
            </Badge>
          </div>

          {status?.runningDistros.length ? (
            <div className="flex max-h-24 flex-wrap gap-1 overflow-y-auto scrollbar-thin">
              {status.runningDistros.map((name) => (
                <Badge key={name} variant="outline" className="text-xs">
                  {name}
                </Badge>
              ))}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">{t('wsl.noRunning')}</p>
          )}
        </div>

        {status?.runningDistros.length ? (
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5 text-amber-600 hover:text-amber-700 border-amber-300 hover:border-amber-400"
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
