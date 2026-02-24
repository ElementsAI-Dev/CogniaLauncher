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
  Cpu,
  Package,
  Terminal,
  User,
  Server,
  Box,
} from 'lucide-react';
import { formatBytes } from '@/lib/utils';
import { WslDistroConfigCard } from '@/components/wsl/wsl-distro-config-card';
import type { WslDistroStatus, WslDiskUsage, WslDistroConfig, WslDistroEnvironment } from '@/types/tauri';

interface WslDistroOverviewProps {
  distroName: string;
  distro: WslDistroStatus | null;
  getDiskUsage: (name: string) => Promise<WslDiskUsage | null>;
  getIpAddress: (distro?: string) => Promise<string>;
  getDistroConfig: (distro: string) => Promise<WslDistroConfig | null>;
  setDistroConfigValue: (distro: string, section: string, key: string, value?: string) => Promise<void>;
  detectDistroEnv: (distro: string) => Promise<WslDistroEnvironment | null>;
  t: (key: string, params?: Record<string, string | number>) => string;
}

/** Map distro ID to a display-friendly package manager label */
function formatPmLabel(pm: string): string {
  const labels: Record<string, string> = {
    apt: 'APT (dpkg)',
    pacman: 'Pacman',
    dnf: 'DNF (rpm)',
    yum: 'YUM (rpm)',
    zypper: 'Zypper (rpm)',
    apk: 'APK',
    'xbps-install': 'XBPS',
    emerge: 'Portage',
    nix: 'Nix',
    swupd: 'swupd',
    eopkg: 'eopkg',
  };
  return labels[pm] ?? pm;
}

export function WslDistroOverview({
  distroName,
  distro,
  getDiskUsage,
  getIpAddress,
  getDistroConfig,
  setDistroConfigValue,
  detectDistroEnv,
  t,
}: WslDistroOverviewProps) {
  const [diskUsage, setDiskUsage] = useState<WslDiskUsage | null>(null);
  const [ipAddress, setIpAddress] = useState<string | null>(null);
  const [loadingDisk, setLoadingDisk] = useState(true);
  const [env, setEnv] = useState<WslDistroEnvironment | null>(null);
  const [envFetched, setEnvFetched] = useState(false);

  const isRunning = distro?.state.toLowerCase() === 'running';
  const loadingEnv = isRunning && !envFetched;

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

  // Load environment info (only when running)
  useEffect(() => {
    if (!isRunning) return;
    let cancelled = false;
    detectDistroEnv(distroName)
      .then((result) => {
        if (!cancelled) setEnv(result);
      })
      .catch(() => {
        if (!cancelled) setEnv(null);
      })
      .finally(() => {
        if (!cancelled) setEnvFetched(true);
      });
    return () => { cancelled = true; };
  }, [distroName, isRunning, detectDistroEnv]);

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

      {/* Environment Info */}
      {isRunning && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <Server className="h-4 w-4 text-muted-foreground" />
              {t('wsl.detail.environment')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loadingEnv ? (
              <div className="grid gap-3 grid-cols-2 lg:grid-cols-3">
                {[1, 2, 3, 4, 5, 6].map((i) => (
                  <Skeleton key={i} className="h-10 w-full" />
                ))}
              </div>
            ) : env ? (
              <div className="grid gap-x-6 gap-y-3 grid-cols-2 lg:grid-cols-3">
                <div className="flex items-start gap-2">
                  <Info className="h-3.5 w-3.5 mt-0.5 text-muted-foreground shrink-0" />
                  <div>
                    <p className="text-xs text-muted-foreground">{t('wsl.detail.osName')}</p>
                    <p className="text-sm font-medium">{env.prettyName}</p>
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <Cpu className="h-3.5 w-3.5 mt-0.5 text-muted-foreground shrink-0" />
                  <div>
                    <p className="text-xs text-muted-foreground">{t('wsl.detail.architecture')}</p>
                    <p className="text-sm font-medium">{env.architecture}</p>
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <Package className="h-3.5 w-3.5 mt-0.5 text-muted-foreground shrink-0" />
                  <div>
                    <p className="text-xs text-muted-foreground">{t('wsl.detail.packageManager')}</p>
                    <p className="text-sm font-medium">
                      {formatPmLabel(env.packageManager)}
                      {env.installedPackages != null && (
                        <span className="text-xs text-muted-foreground ml-1">
                          ({env.installedPackages.toLocaleString()} {t('wsl.detail.installedPackages').toLowerCase()})
                        </span>
                      )}
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <Box className="h-3.5 w-3.5 mt-0.5 text-muted-foreground shrink-0" />
                  <div>
                    <p className="text-xs text-muted-foreground">{t('wsl.detail.kernel')}</p>
                    <p className="text-sm font-medium font-mono truncate max-w-[200px]" title={env.kernelVersion}>
                      {env.kernelVersion}
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <Terminal className="h-3.5 w-3.5 mt-0.5 text-muted-foreground shrink-0" />
                  <div>
                    <p className="text-xs text-muted-foreground">{t('wsl.detail.initSystem')}</p>
                    <p className="text-sm font-medium">{env.initSystem}</p>
                  </div>
                </div>
                {env.defaultShell && (
                  <div className="flex items-start gap-2">
                    <Terminal className="h-3.5 w-3.5 mt-0.5 text-muted-foreground shrink-0" />
                    <div>
                      <p className="text-xs text-muted-foreground">{t('wsl.detail.defaultShell')}</p>
                      <p className="text-sm font-medium font-mono">{env.defaultShell}</p>
                    </div>
                  </div>
                )}
                {env.defaultUser && (
                  <div className="flex items-start gap-2">
                    <User className="h-3.5 w-3.5 mt-0.5 text-muted-foreground shrink-0" />
                    <div>
                      <p className="text-xs text-muted-foreground">{t('wsl.detail.defaultUser')}</p>
                      <p className="text-sm font-medium">{env.defaultUser}</p>
                    </div>
                  </div>
                )}
                {env.hostname && (
                  <div className="flex items-start gap-2">
                    <Server className="h-3.5 w-3.5 mt-0.5 text-muted-foreground shrink-0" />
                    <div>
                      <p className="text-xs text-muted-foreground">{t('wsl.detail.hostname')}</p>
                      <p className="text-sm font-medium">{env.hostname}</p>
                    </div>
                  </div>
                )}
                {env.versionCodename && (
                  <div className="flex items-start gap-2">
                    <Info className="h-3.5 w-3.5 mt-0.5 text-muted-foreground shrink-0" />
                    <div>
                      <p className="text-xs text-muted-foreground">{t('wsl.detail.osVersion')}</p>
                      <p className="text-sm font-medium">
                        {env.versionId ?? ''}{env.versionCodename ? ` (${env.versionCodename})` : ''}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                {t('wsl.detail.envDetectFailed')}
              </p>
            )}
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
