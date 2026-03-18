'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardAction } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty';
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
  Timer,
  Container,
  Gpu,
} from 'lucide-react';
import { toast } from 'sonner';
import { formatBytes } from '@/lib/utils';
import { formatPmLabel, formatKb } from '@/lib/wsl';
import { WslDistroConfigCard } from '@/components/wsl/wsl-distro-config-card';
import type { WslDistroOverviewProps } from '@/types/wsl';
import type {
  WslDiskUsage,
  WslDistroEnvironment,
  WslDistroResources,
} from '@/types/tauri';

export function WslDistroOverview({
  distroName,
  distro,
  info,
  onRefreshInfo,
  onRefreshLiveInfo,
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
  const [autoRefresh, setAutoRefresh] = useState(false);
  const autoRefreshRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [updatingPkgs, setUpdatingPkgs] = useState<'update' | 'upgrade' | null>(null);
  const [lastResourceUpdate, setLastResourceUpdate] = useState<string | null>(null);

  const isRunning = distro?.state.toLowerCase() === 'running';
  const hasSnapshotInfo = Boolean(info);
  const loadingEnv = isRunning && !envFetched;
  const effectiveDiskUsage = info?.diskUsage.data ?? diskUsage;
  const effectiveIpAddress = isRunning
    ? (info?.ipAddress.data ?? ipAddress)
    : null;
  const effectiveEnv = info?.environment.data ?? env;
  const effectiveResources = info?.resources.data ?? resources;
  const effectiveLoadingDisk = hasSnapshotInfo
    ? info?.diskUsage.state === 'loading'
    : loadingDisk;
  const effectiveLoadingEnv = hasSnapshotInfo
    ? info?.environment.state === 'loading'
    : loadingEnv;
  const effectiveLoadingResources = hasSnapshotInfo
    ? info?.resources.state === 'loading'
    : !resourcesFetched;
  const canRefreshInfo = Boolean(onRefreshInfo);

  // Load disk usage
  useEffect(() => {
    if (hasSnapshotInfo) return;
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
  }, [distroName, getDiskUsage, hasSnapshotInfo]);

  // Load environment info (only when running)
  useEffect(() => {
    if (hasSnapshotInfo) return;
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
  }, [detectDistroEnv, distroName, hasSnapshotInfo, isRunning]);

  // Load IP address
  useEffect(() => {
    if (hasSnapshotInfo) return;
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
  }, [distroName, getIpAddress, hasSnapshotInfo, isRunning]);

  // Load resource usage (only when running and prop provided)
  useEffect(() => {
    if (hasSnapshotInfo) return;
    if (!isRunning || !getDistroResources) return;
    let cancelled = false;
    getDistroResources(distroName)
      .then((res) => {
        if (!cancelled) {
          setResources(res);
          setLastResourceUpdate(new Date().toLocaleTimeString());
        }
      })
      .catch(() => {
        if (!cancelled) setResources(null);
      })
      .finally(() => {
        if (!cancelled) setResourcesFetched(true);
      });
    return () => { cancelled = true; };
  }, [distroName, getDistroResources, hasSnapshotInfo, isRunning]);

  const handleRefreshResources = useCallback(() => {
    if (onRefreshLiveInfo) {
      void onRefreshLiveInfo();
      return;
    }
    if (!getDistroResources) return;
    setResourcesFetched(false);
    getDistroResources(distroName)
      .then((res) => {
        setResources(res);
        setLastResourceUpdate(new Date().toLocaleTimeString());
      })
      .catch(() => setResources(null))
      .finally(() => setResourcesFetched(true));
  }, [distroName, getDistroResources, onRefreshLiveInfo]);

  // Auto-refresh resource monitoring (5s interval)
  useEffect(() => {
    if (hasSnapshotInfo) return;
    if (autoRefresh && isRunning && getDistroResources) {
      autoRefreshRef.current = setInterval(() => {
        getDistroResources(distroName)
          .then((res) => {
            setResources(res);
            setLastResourceUpdate(new Date().toLocaleTimeString());
          })
          .catch(() => {});
      }, 5000);
    }
    return () => {
      if (autoRefreshRef.current) {
        clearInterval(autoRefreshRef.current);
        autoRefreshRef.current = null;
      }
    };
  }, [autoRefresh, distroName, getDistroResources, hasSnapshotInfo, isRunning]);

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
  const displayedIp = effectiveIpAddress;

  const diskPercent = effectiveDiskUsage && effectiveDiskUsage.totalBytes > 0
    ? (effectiveDiskUsage.usedBytes / effectiveDiskUsage.totalBytes) * 100
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
            {effectiveLoadingDisk ? (
              <Skeleton className="h-6 w-32" />
            ) : effectiveDiskUsage && effectiveDiskUsage.totalBytes > 0 ? (
              <div className="space-y-1.5">
                <p className="text-sm font-semibold">
                  {formatBytes(effectiveDiskUsage.usedBytes)} / {formatBytes(effectiveDiskUsage.totalBytes)}
                </p>
                <Progress value={diskPercent} className={`h-2 ${
                  diskPercent > 80 ? '[&>div]:bg-red-500' : diskPercent > 50 ? '[&>div]:bg-amber-500' : ''
                }`} />
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
      {effectiveDiskUsage?.filesystemPath && (
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-sm">
              <FolderOpen className="h-4 w-4 text-muted-foreground shrink-0" />
              <span className="text-muted-foreground">{t('wsl.detail.filesystemPath')}:</span>
              <code className="font-mono text-xs bg-muted px-2 py-0.5 rounded flex-1 truncate">
                {effectiveDiskUsage.filesystemPath}
              </code>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Environment Info */}
      {(isRunning || hasSnapshotInfo) && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <Server className="h-4 w-4 text-muted-foreground" />
              {t('wsl.detail.environment')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {info?.environment.state === 'stale' && (
              <div className="mb-4 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                <p>{t('wsl.detail.infoStale')}</p>
                <p className="text-xs text-amber-800">{t('wsl.detail.infoRetryHint')}</p>
                {canRefreshInfo && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-3"
                    onClick={() => { void onRefreshInfo?.(); }}
                  >
                    {t('common.refresh')}
                  </Button>
                )}
              </div>
            )}
            {effectiveLoadingEnv ? (
              <div className="grid gap-4 grid-cols-2 lg:grid-cols-3">
                {Array.from({ length: 9 }, (_, i) => i + 1).map((i) => (
                  <Skeleton key={i} className="h-10 w-full" />
                ))}
              </div>
            ) : info?.environment.state === 'unavailable' ? (
              <Empty className="border-none py-4">
                <EmptyHeader>
                  <EmptyMedia variant="icon">
                    <Server />
                  </EmptyMedia>
                  <EmptyTitle className="text-sm font-normal text-muted-foreground">
                    {t('wsl.detail.infoUnavailable')}
                  </EmptyTitle>
                  <p className="text-xs text-muted-foreground">
                    {info.environment.reason}
                  </p>
                  {canRefreshInfo && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="mt-3"
                      onClick={() => { void onRefreshInfo?.(); }}
                    >
                      {t('common.refresh')}
                    </Button>
                  )}
                </EmptyHeader>
              </Empty>
            ) : effectiveEnv ? (
              <div className="grid gap-4 grid-cols-2 lg:grid-cols-3">
                <div className="flex items-start gap-2">
                  <Info className="h-3.5 w-3.5 mt-0.5 text-muted-foreground shrink-0" />
                  <div>
                    <p className="text-xs text-muted-foreground">{t('wsl.detail.osName')}</p>
                    <p className="text-sm font-medium">{effectiveEnv.prettyName}</p>
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <Cpu className="h-3.5 w-3.5 mt-0.5 text-muted-foreground shrink-0" />
                  <div>
                    <p className="text-xs text-muted-foreground">{t('wsl.detail.architecture')}</p>
                    <p className="text-sm font-medium">{effectiveEnv.architecture}</p>
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <Package className="h-3.5 w-3.5 mt-0.5 text-muted-foreground shrink-0" />
                  <div>
                    <p className="text-xs text-muted-foreground">{t('wsl.detail.packageManager')}</p>
                    <p className="text-sm font-medium">
                      {formatPmLabel(effectiveEnv.packageManager)}
                      {effectiveEnv.installedPackages != null && (
                        <span className="text-xs text-muted-foreground ml-1">
                          ({effectiveEnv.installedPackages.toLocaleString()} {t('wsl.detail.installedPackages').toLowerCase()})
                        </span>
                      )}
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <Box className="h-3.5 w-3.5 mt-0.5 text-muted-foreground shrink-0" />
                  <div>
                    <p className="text-xs text-muted-foreground">{t('wsl.detail.kernel')}</p>
                    <p className="text-sm font-medium font-mono truncate max-w-[200px]" title={effectiveEnv.kernelVersion}>
                      {effectiveEnv.kernelVersion}
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <Terminal className="h-3.5 w-3.5 mt-0.5 text-muted-foreground shrink-0" />
                  <div>
                    <p className="text-xs text-muted-foreground">{t('wsl.detail.initSystem')}</p>
                    <p className="text-sm font-medium">{effectiveEnv.initSystem}</p>
                  </div>
                </div>
                {effectiveEnv.defaultShell && (
                  <div className="flex items-start gap-2">
                    <Terminal className="h-3.5 w-3.5 mt-0.5 text-muted-foreground shrink-0" />
                    <div>
                      <p className="text-xs text-muted-foreground">{t('wsl.detail.defaultShell')}</p>
                      <p className="text-sm font-medium font-mono">{effectiveEnv.defaultShell}</p>
                    </div>
                  </div>
                )}
                {effectiveEnv.defaultUser && (
                  <div className="flex items-start gap-2">
                    <User className="h-3.5 w-3.5 mt-0.5 text-muted-foreground shrink-0" />
                    <div>
                      <p className="text-xs text-muted-foreground">{t('wsl.detail.defaultUser')}</p>
                      <p className="text-sm font-medium">{effectiveEnv.defaultUser}</p>
                    </div>
                  </div>
                )}
                {effectiveEnv.hostname && (
                  <div className="flex items-start gap-2">
                    <Server className="h-3.5 w-3.5 mt-0.5 text-muted-foreground shrink-0" />
                    <div>
                      <p className="text-xs text-muted-foreground">{t('wsl.detail.hostname')}</p>
                      <p className="text-sm font-medium">{effectiveEnv.hostname}</p>
                    </div>
                  </div>
                )}
                {effectiveEnv.versionCodename && (
                  <div className="flex items-start gap-2">
                    <Info className="h-3.5 w-3.5 mt-0.5 text-muted-foreground shrink-0" />
                    <div>
                      <p className="text-xs text-muted-foreground">{t('wsl.detail.osVersion')}</p>
                      <p className="text-sm font-medium">
                        {effectiveEnv.versionId ?? ''}{effectiveEnv.versionCodename ? ` (${effectiveEnv.versionCodename})` : ''}
                      </p>
                    </div>
                  </div>
                )}
                <div className="flex items-start gap-2">
                  <Container className="h-3.5 w-3.5 mt-0.5 text-muted-foreground shrink-0" />
                  <div>
                    <p className="text-xs text-muted-foreground">{t('wsl.detail.docker')}</p>
                    <p className="text-sm font-medium">
                      {effectiveEnv.dockerAvailable ? (
                        <Badge variant="default" className="text-[10px]">{t('wsl.detail.dockerAvailable')}</Badge>
                      ) : (
                        <Badge variant="secondary" className="text-[10px]">{t('wsl.detail.dockerNotFound')}</Badge>
                      )}
                    </p>
                  </div>
                </div>
                {effectiveEnv.gpuName && (
                  <div className="flex items-start gap-2">
                    <Gpu className="h-3.5 w-3.5 mt-0.5 text-muted-foreground shrink-0" />
                    <div>
                      <p className="text-xs text-muted-foreground">{t('wsl.detail.gpu')}</p>
                      <p className="text-sm font-medium">{effectiveEnv.gpuName}</p>
                      {effectiveEnv.gpuMemory && (
                        <p className="text-xs text-muted-foreground">{effectiveEnv.gpuMemory}</p>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <Empty className="border-none py-4">
                <EmptyHeader>
                  <EmptyMedia variant="icon">
                    <Server />
                  </EmptyMedia>
                  <EmptyTitle className="text-sm font-normal text-muted-foreground">
                    {t('wsl.detail.envDetectFailed')}
                  </EmptyTitle>
                </EmptyHeader>
              </Empty>
            )}
          </CardContent>
        </Card>
      )}

      {/* Resource Usage (only when running and prop provided) */}
      {(isRunning || hasSnapshotInfo) && getDistroResources && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <MemoryStick className="h-4 w-4 text-muted-foreground" />
              {t('wsl.detail.resources')}
            </CardTitle>
            <CardAction>
              <div className="flex items-center gap-1">
                <Button
                  variant={autoRefresh ? 'default' : 'ghost'}
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => setAutoRefresh((v) => !v)}
                  title={autoRefresh ? t('wsl.detail.autoRefreshStop') : t('wsl.detail.autoRefreshStart')}
                >
                  <Timer className={`h-3.5 w-3.5 ${autoRefresh ? 'animate-pulse' : ''}`} />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={handleRefreshResources}
                  disabled={!resourcesFetched}
                >
                  <RefreshCw className={`h-3.5 w-3.5 ${!resourcesFetched ? 'animate-spin' : ''}`} />
                </Button>
                {lastResourceUpdate && (
                  <span className="text-[11px] text-muted-foreground">{lastResourceUpdate}</span>
                )}
              </div>
            </CardAction>
          </CardHeader>
          <CardContent>
            {info?.resources.state === 'stale' && (
              <div className="mb-4 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                <p>{t('wsl.detail.infoStale')}</p>
                <p className="text-xs text-amber-800">{t('wsl.detail.infoRetryHint')}</p>
                {canRefreshInfo && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-3"
                    onClick={() => { void onRefreshInfo?.(); }}
                  >
                    {t('common.refresh')}
                  </Button>
                )}
              </div>
            )}
            {effectiveLoadingResources ? (
              <div className="grid gap-4 grid-cols-2 lg:grid-cols-3">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-16 w-full" />
                ))}
              </div>
            ) : info?.resources.state === 'unavailable' ? (
              <Empty className="border-none py-4">
                <EmptyHeader>
                  <EmptyMedia variant="icon">
                    <MemoryStick />
                  </EmptyMedia>
                  <EmptyTitle className="text-sm font-normal text-muted-foreground">
                    {t('wsl.detail.infoUnavailable')}
                  </EmptyTitle>
                  <p className="text-xs text-muted-foreground">
                    {info.resources.reason}
                  </p>
                  {canRefreshInfo && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="mt-3"
                      onClick={() => { void onRefreshInfo?.(); }}
                    >
                      {t('common.refresh')}
                    </Button>
                  )}
                </EmptyHeader>
              </Empty>
            ) : effectiveResources ? (
              <div className="grid gap-4 grid-cols-2 lg:grid-cols-3">
                {/* Memory */}
                <div className="space-y-1.5">
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    <MemoryStick className="h-3 w-3" />
                    {t('wsl.detail.memory')}
                  </p>
                  <p className="text-sm font-semibold">
                    {formatKb(effectiveResources.memUsedKb)} / {formatKb(effectiveResources.memTotalKb)}
                  </p>
                  <Progress
                    value={effectiveResources.memTotalKb > 0 ? (effectiveResources.memUsedKb / effectiveResources.memTotalKb) * 100 : 0}
                    className="h-1.5"
                  />
                </div>
                {/* Swap */}
                <div className="space-y-1.5">
                  <p className="text-xs text-muted-foreground">{t('wsl.detail.swap')}</p>
                  {effectiveResources.swapTotalKb > 0 ? (
                    <>
                      <p className="text-sm font-semibold">
                        {formatKb(effectiveResources.swapUsedKb)} / {formatKb(effectiveResources.swapTotalKb)}
                      </p>
                      <Progress
                        value={(effectiveResources.swapUsedKb / effectiveResources.swapTotalKb) * 100}
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
                    {effectiveResources.cpuCount} {effectiveResources.cpuCount === 1 ? 'core' : 'cores'}
                  </p>
                  <p className="text-xs text-muted-foreground font-mono">
                    {t('wsl.detail.loadAvg')}: {effectiveResources.loadAvg[0].toFixed(2)} / {effectiveResources.loadAvg[1].toFixed(2)} / {effectiveResources.loadAvg[2].toFixed(2)}
                  </p>
                </div>
              </div>
            ) : (
              <Empty className="border-none py-4">
                <EmptyHeader>
                  <EmptyMedia variant="icon">
                    <MemoryStick />
                  </EmptyMedia>
                  <EmptyTitle className="text-sm font-normal text-muted-foreground">
                    {t('wsl.detail.resourcesFailed')}
                  </EmptyTitle>
                </EmptyHeader>
              </Empty>
            )}
          </CardContent>
        </Card>
      )}

      {/* Package Update (only when running with env detected) */}
      {isRunning && updateDistroPackages && effectiveEnv && effectiveEnv.packageManager !== 'unknown' && (
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
                disabled={updatingPkgs !== null || info?.environment.state === 'stale'}
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
                disabled={updatingPkgs !== null || info?.environment.state === 'stale'}
              >
                {updatingPkgs === 'upgrade' ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <ArrowUpCircle className="h-3.5 w-3.5" />
                )}
                {t('wsl.detail.pkgUpgrade')}
              </Button>
              <span className="text-xs text-muted-foreground">
                {formatPmLabel(effectiveEnv.packageManager)}
              </span>
            </div>
            {info?.environment.state === 'stale' && (
              <p className="mt-3 text-xs text-muted-foreground">
                {t('wsl.detail.infoRetryHint')}
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
