'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
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
  MemoryStick,
  RefreshCw,
  ArrowUpCircle,
  Loader2,
} from 'lucide-react';
import { toast } from 'sonner';
import { formatBytes } from '@/lib/utils';
import { WslDistroConfigCard } from '@/components/wsl/wsl-distro-config-card';
import type {
  WslDistroStatus,
  WslDiskUsage,
  WslDistroConfig,
  WslDistroEnvironment,
  WslDistroResources,
  WslPackageUpdateResult,
} from '@/types/tauri';

interface WslDistroOverviewProps {
  distroName: string;
  distro: WslDistroStatus | null;
  getDiskUsage: (name: string) => Promise<WslDiskUsage | null>;
  getIpAddress: (distro?: string) => Promise<string>;
  getDistroConfig: (distro: string) => Promise<WslDistroConfig | null>;
  setDistroConfigValue: (distro: string, section: string, key: string, value?: string) => Promise<void>;
  detectDistroEnv: (distro: string) => Promise<WslDistroEnvironment | null>;
  getDistroResources?: (distro: string) => Promise<WslDistroResources | null>;
  updateDistroPackages?: (distro: string, mode: string) => Promise<WslPackageUpdateResult>;
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

/** Format KB to human-readable */
function formatKb(kb: number): string {
  return formatBytes(kb * 1024);
}

export function WslDistroOverview({
  distroName,
  distro,
  getDiskUsage,
  getIpAddress,
  getDistroConfig,
  setDistroConfigValue,
  detectDistroEnv,
  getDistroResources,
  updateDistroPackages,
  t,
}: WslDistroOverviewProps) {
  const [diskUsage, setDiskUsage] = useState<WslDiskUsage | null>(null);
  const [ipAddress, setIpAddress] = useState<string | null>(null);
  const [loadingDisk, setLoadingDisk] = useState(true);
  const [env, setEnv] = useState<WslDistroEnvironment | null>(null);
  const [envFetched, setEnvFetched] = useState(false);
  const [resources, setResources] = useState<WslDistroResources | null>(null);
  const [resourcesFetched, setResourcesFetched] = useState(false);
  const [updatingPkgs, setUpdatingPkgs] = useState<'update' | 'upgrade' | null>(null);

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

  // Load resource usage (only when running and prop provided)
  useEffect(() => {
    if (!isRunning || !getDistroResources) return;
    let cancelled = false;
    getDistroResources(distroName)
      .then((res) => {
        if (!cancelled) setResources(res);
      })
      .catch(() => {
        if (!cancelled) setResources(null);
      })
      .finally(() => {
        if (!cancelled) setResourcesFetched(true);
      });
    return () => { cancelled = true; };
  }, [distroName, isRunning, getDistroResources]);

  const handleRefreshResources = useCallback(() => {
    if (!getDistroResources) return;
    setResourcesFetched(false);
    getDistroResources(distroName)
      .then(setResources)
      .catch(() => setResources(null))
      .finally(() => setResourcesFetched(true));
  }, [distroName, getDistroResources]);

  const handlePackageAction = useCallback(async (mode: 'update' | 'upgrade') => {
    if (!updateDistroPackages) return;
    setUpdatingPkgs(mode);
    try {
      const result = await updateDistroPackages(distroName, mode);
      if (result.exitCode === 0) {
        toast.success(t('wsl.detail.pkgActionSuccess').replace('{mode}', mode).replace('{pm}', result.packageManager));
      } else {
        toast.error(`${result.command} failed (exit ${result.exitCode}): ${result.stderr.slice(0, 200)}`);
      }
    } catch (err) {
      toast.error(String(err));
    } finally {
      setUpdatingPkgs(null);
    }
  }, [distroName, updateDistroPackages, t]);

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

      {/* Resource Usage (only when running and prop provided) */}
      {isRunning && getDistroResources && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <MemoryStick className="h-4 w-4 text-muted-foreground" />
                {t('wsl.detail.resources')}
              </CardTitle>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={handleRefreshResources}
                disabled={!resourcesFetched}
              >
                <RefreshCw className={`h-3.5 w-3.5 ${!resourcesFetched ? 'animate-spin' : ''}`} />
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {!resourcesFetched ? (
              <div className="grid gap-3 grid-cols-2 lg:grid-cols-3">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-16 w-full" />
                ))}
              </div>
            ) : resources ? (
              <div className="grid gap-4 grid-cols-2 lg:grid-cols-3">
                {/* Memory */}
                <div className="space-y-1.5">
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    <MemoryStick className="h-3 w-3" />
                    {t('wsl.detail.memory')}
                  </p>
                  <p className="text-sm font-semibold">
                    {formatKb(resources.memUsedKb)} / {formatKb(resources.memTotalKb)}
                  </p>
                  <Progress
                    value={resources.memTotalKb > 0 ? (resources.memUsedKb / resources.memTotalKb) * 100 : 0}
                    className="h-1.5"
                  />
                </div>
                {/* Swap */}
                <div className="space-y-1.5">
                  <p className="text-xs text-muted-foreground">{t('wsl.detail.swap')}</p>
                  {resources.swapTotalKb > 0 ? (
                    <>
                      <p className="text-sm font-semibold">
                        {formatKb(resources.swapUsedKb)} / {formatKb(resources.swapTotalKb)}
                      </p>
                      <Progress
                        value={(resources.swapUsedKb / resources.swapTotalKb) * 100}
                        className="h-1.5"
                      />
                    </>
                  ) : (
                    <p className="text-sm text-muted-foreground">{t('wsl.detail.noSwap')}</p>
                  )}
                </div>
                {/* CPU & Load */}
                <div className="space-y-1.5">
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    <Cpu className="h-3 w-3" />
                    {t('wsl.detail.cpuLoad')}
                  </p>
                  <p className="text-sm font-semibold">
                    {resources.cpuCount} {resources.cpuCount === 1 ? 'core' : 'cores'}
                  </p>
                  <p className="text-xs text-muted-foreground font-mono">
                    {t('wsl.detail.loadAvg')}: {resources.loadAvg[0].toFixed(2)} / {resources.loadAvg[1].toFixed(2)} / {resources.loadAvg[2].toFixed(2)}
                  </p>
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">{t('wsl.detail.resourcesFailed')}</p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Package Update (only when running with env detected) */}
      {isRunning && updateDistroPackages && env && env.packageManager !== 'unknown' && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <Package className="h-4 w-4 text-muted-foreground" />
              {t('wsl.detail.packageActions')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-3">
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5"
                onClick={() => handlePackageAction('update')}
                disabled={updatingPkgs !== null}
              >
                {updatingPkgs === 'update' ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <RefreshCw className="h-3.5 w-3.5" />
                )}
                {t('wsl.detail.pkgUpdate')}
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5"
                onClick={() => handlePackageAction('upgrade')}
                disabled={updatingPkgs !== null}
              >
                {updatingPkgs === 'upgrade' ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <ArrowUpCircle className="h-3.5 w-3.5" />
                )}
                {t('wsl.detail.pkgUpgrade')}
              </Button>
              <span className="text-xs text-muted-foreground">
                {formatPmLabel(env.packageManager)}
              </span>
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
