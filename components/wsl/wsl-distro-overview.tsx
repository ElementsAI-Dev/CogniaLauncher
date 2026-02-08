'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import {
  HardDrive,
  Network,
  Info,
  FolderOpen,
} from 'lucide-react';
import { formatBytes } from '@/lib/utils';
import { WslDistroConfigCard } from '@/components/wsl/wsl-distro-config-card';
import type { WslDistroStatus, WslDiskUsage, WslDistroConfig } from '@/types/tauri';

interface WslDistroOverviewProps {
  distroName: string;
  distro: WslDistroStatus | null;
  getDiskUsage: (name: string) => Promise<WslDiskUsage | null>;
  getIpAddress: (distro?: string) => Promise<string>;
  getDistroConfig: (distro: string) => Promise<WslDistroConfig | null>;
  setDistroConfigValue: (distro: string, section: string, key: string, value?: string) => Promise<void>;
  t: (key: string, params?: Record<string, string | number>) => string;
}

export function WslDistroOverview({
  distroName,
  distro,
  getDiskUsage,
  getIpAddress,
  getDistroConfig,
  setDistroConfigValue,
  t,
}: WslDistroOverviewProps) {
  const [diskUsage, setDiskUsage] = useState<WslDiskUsage | null>(null);
  const [ipAddress, setIpAddress] = useState<string | null>(null);
  const [loadingDisk, setLoadingDisk] = useState(true);

  const isRunning = distro?.state.toLowerCase() === 'running';

  // Load disk usage
  useEffect(() => {
    let cancelled = false;
    getDiskUsage(distroName)
      .then((usage) => {
        if (!cancelled) setDiskUsage(usage);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoadingDisk(false);
      });
    return () => { cancelled = true; };
  }, [distroName, getDiskUsage]);

  // Load IP address
  useEffect(() => {
    if (!isRunning) return;
    let cancelled = false;
    getIpAddress(distroName)
      .then((ip) => {
        if (!cancelled) setIpAddress(ip);
      })
      .catch(() => {
        if (!cancelled) setIpAddress(null);
      });
    return () => { cancelled = true; };
  }, [distroName, isRunning, getIpAddress]);

  // Derive displayed IP: only show when running
  const displayedIp = isRunning ? ipAddress : null;

  const diskPercent = diskUsage && diskUsage.totalBytes > 0
    ? (diskUsage.usedBytes / diskUsage.totalBytes) * 100
    : 0;

  return (
    <div className="space-y-4">
      {/* Status Cards Row */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        {/* Status */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-1.5">
              <Info className="h-3.5 w-3.5" />
              {t('wsl.detail.status')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Badge variant={isRunning ? 'default' : 'secondary'} className="text-sm">
              {isRunning ? t('wsl.running') : t('wsl.stopped')}
            </Badge>
          </CardContent>
        </Card>

        {/* WSL Version */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {t('wsl.wslVersion')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">WSL {distro?.wslVersion ?? '?'}</p>
          </CardContent>
        </Card>

        {/* Disk Usage */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-1.5">
              <HardDrive className="h-3.5 w-3.5" />
              {t('wsl.detail.diskUsage')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loadingDisk ? (
              <Skeleton className="h-6 w-32" />
            ) : diskUsage && diskUsage.totalBytes > 0 ? (
              <div className="space-y-1.5">
                <p className="text-sm font-semibold">
                  {formatBytes(diskUsage.usedBytes)} / {formatBytes(diskUsage.totalBytes)}
                </p>
                <Progress value={diskPercent} className="h-2" />
                <p className="text-xs text-muted-foreground">{diskPercent.toFixed(1)}%</p>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">—</p>
            )}
          </CardContent>
        </Card>

        {/* IP Address */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-1.5">
              <Network className="h-3.5 w-3.5" />
              {t('wsl.ipAddress')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isRunning && displayedIp ? (
              <p className="text-sm font-mono font-semibold">{displayedIp}</p>
            ) : (
              <p className="text-sm text-muted-foreground">
                {isRunning ? '—' : t('wsl.stopped')}
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Filesystem Path */}
      {diskUsage?.filesystemPath && (
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-sm">
              <FolderOpen className="h-4 w-4 text-muted-foreground shrink-0" />
              <span className="text-muted-foreground">{t('wsl.detail.filesystemPath')}:</span>
              <code className="font-mono text-xs bg-muted px-2 py-0.5 rounded flex-1 truncate">
                {diskUsage.filesystemPath}
              </code>
            </div>
          </CardContent>
        </Card>
      )}

      <Separator />

      {/* Distribution Config (/etc/wsl.conf) — reuses WslDistroConfigCard */}
      <WslDistroConfigCard
        distroName={distroName}
        getDistroConfig={getDistroConfig}
        setDistroConfigValue={setDistroConfigValue}
        t={t}
      />
    </div>
  );
}
