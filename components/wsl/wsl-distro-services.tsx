'use client';

import { useState, useCallback, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardAction } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Cog,
  RefreshCw,
  Play,
  Square,
  RotateCw,
  Search,
  CheckCircle2,
  XCircle,
  Clock,
  Loader2,
} from 'lucide-react';
import { toast } from 'sonner';
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty';
import { parseServices, getStatusVariant } from '@/lib/wsl';
import type { ServiceInfo, WslDistroServicesProps } from '@/types/wsl';

function getStatusIcon(status: ServiceInfo['status']) {
  switch (status) {
    case 'running':
      return <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />;
    case 'failed':
      return <XCircle className="h-3.5 w-3.5 text-destructive" />;
    case 'exited':
      return <Clock className="h-3.5 w-3.5 text-amber-500" />;
    case 'inactive':
    case 'stopped':
      return <Square className="h-3.5 w-3.5 text-muted-foreground" />;
    default:
      return <Cog className="h-3.5 w-3.5 text-muted-foreground" />;
  }
}

function getStatusClassName(status: ServiceInfo['status']) {
  switch (status) {
    case 'running':
      return 'bg-green-500/10 text-green-700 dark:text-green-400 border-green-500/20';
    case 'failed':
      return 'bg-destructive/10 text-destructive border-destructive/20';
    case 'exited':
      return 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20';
    case 'inactive':
    case 'stopped':
      return 'bg-muted text-muted-foreground border-muted';
    default:
      return '';
  }
}

export function WslDistroServices({ distroName, isRunning, onExec, t }: WslDistroServicesProps) {
  const [services, setServices] = useState<ServiceInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [search, setSearch] = useState('');
  const [hasSystemd, setHasSystemd] = useState<boolean | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      // Check if systemd is available
      const pidResult = await onExec(distroName, 'cat /proc/1/comm 2>/dev/null || echo "unknown"');
      const initSystem = pidResult.stdout.trim();
      const systemdEnabled = initSystem === 'systemd';
      setHasSystemd(systemdEnabled);

      if (!systemdEnabled) {
        setServices([]);
        setLoaded(true);
        setLoading(false);
        return;
      }

      // List all services
      const result = await onExec(
        distroName,
        'systemctl list-units --type=service --all --no-pager --no-legend 2>/dev/null'
      );

      if (result.exitCode === 0) {
        const parsed = parseServices(result.stdout);
        setServices(parsed);
      } else {
        setServices([]);
      }
      setLoaded(true);
    } catch {
      setServices([]);
      setHasSystemd(false);
    } finally {
      setLoading(false);
    }
  }, [distroName, onExec]);

  // Auto-load if running
  useEffect(() => {
    if (isRunning && !loaded) {
      refresh();
    }
  }, [isRunning, loaded, refresh]);

  const handleServiceAction = useCallback(async (serviceName: string, action: 'start' | 'stop' | 'restart') => {
    setActionLoading(`${serviceName}-${action}`);
    try {
      const result = await onExec(distroName, `sudo systemctl ${action} ${serviceName}.service 2>&1`, 'root');
      if (result.exitCode === 0) {
        toast.success(
          t('wsl.detail.serviceActionSuccess')
            .replace('{service}', serviceName)
            .replace('{action}', action)
        );
        await refresh();
      } else {
        toast.error(result.stderr || result.stdout || `Failed to ${action} ${serviceName}`);
      }
    } catch (err) {
      toast.error(String(err));
    } finally {
      setActionLoading(null);
    }
  }, [distroName, onExec, t, refresh]);

  const filteredServices = services.filter((s) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return s.name.toLowerCase().includes(q) || s.description.toLowerCase().includes(q);
  });

  const countSource = search ? filteredServices : services;
  const runningCount = countSource.filter((s) => s.status === 'running').length;
  const failedCount = countSource.filter((s) => s.status === 'failed').length;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <Cog className="h-4 w-4 text-muted-foreground" />
            {t('wsl.detail.services')}
            {loaded && hasSystemd && (
              <div className="flex items-center gap-1.5">
                <Badge variant="default" className="text-[10px]">
                  {runningCount} {t('wsl.running').toLowerCase()}
                </Badge>
                {failedCount > 0 && (
                  <Badge variant="destructive" className="text-[10px]">
                    {failedCount} failed
                  </Badge>
                )}
              </div>
            )}
          </CardTitle>
          <CardAction>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={refresh}
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
        <CardContent className="space-y-3">
          {/* Not running */}
          {!isRunning && !loaded && (
            <Empty className="border-none py-4">
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <Cog />
                </EmptyMedia>
                <EmptyTitle className="text-sm font-normal text-muted-foreground">
                  {t('wsl.detail.servicesNotRunning')}
                </EmptyTitle>
              </EmptyHeader>
            </Empty>
          )}

          {/* Loading */}
          {loading && (
            <div className="space-y-2">
              {[1, 2, 3, 4, 5].map((i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          )}

          {/* No systemd */}
          {!loading && loaded && hasSystemd === false && (
            <div className="text-center py-8 space-y-3">
              <Cog className="h-10 w-10 mx-auto text-muted-foreground/50" />
              <div className="space-y-1">
                <p className="text-sm font-medium">{t('wsl.detail.noSystemd')}</p>
                <p className="text-xs text-muted-foreground max-w-md mx-auto">{t('wsl.detail.noSystemdDesc')}</p>
              </div>
            </div>
          )}

          {/* Services list */}
          {!loading && loaded && hasSystemd && (
            <>
              {/* Search */}
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  className="h-8 text-xs pl-8"
                  placeholder={t('wsl.detail.searchServices')}
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>

              {filteredServices.length === 0 ? (
                <Empty className="border-none py-4">
                  <EmptyHeader>
                    <EmptyMedia variant="icon">
                      {search ? <Search /> : <Cog />}
                    </EmptyMedia>
                    <EmptyTitle className="text-sm font-normal text-muted-foreground">
                      {search ? t('wsl.detail.noServicesMatch') : t('wsl.detail.noServices')}
                    </EmptyTitle>
                  </EmptyHeader>
                </Empty>
              ) : (
                <ScrollArea className="max-h-[500px]">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-10" />
                        <TableHead>{t('wsl.detail.serviceName')}</TableHead>
                        <TableHead>{t('wsl.detail.serviceDesc')}</TableHead>
                        <TableHead className="w-28 text-right">{t('wsl.detail.serviceActions')}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredServices.map((service) => {
                        const isActive = service.status === 'running';
                        return (
                          <TableRow key={service.name} className="group">
                            <TableCell className="w-10">
                              {getStatusIcon(service.status)}
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-mono font-medium truncate">{service.name}</span>
                                <Badge variant={getStatusVariant(service.status)} className={`text-[10px] ${getStatusClassName(service.status)}`}>
                                  {service.subState}
                                </Badge>
                              </div>
                            </TableCell>
                            <TableCell className="text-xs text-muted-foreground truncate">
                              {service.description || '—'}
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex items-center gap-1 justify-end sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                                {!isActive ? (
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-7 w-7"
                                        disabled={!!actionLoading}
                                        onClick={() => handleServiceAction(service.name, 'start')}
                                      >
                                        {actionLoading === `${service.name}-start` ? (
                                          <Loader2 className="h-3 w-3 animate-spin" />
                                        ) : (
                                          <Play className="h-3 w-3" />
                                        )}
                                      </Button>
                                    </TooltipTrigger>
                                    <TooltipContent>{t('wsl.detail.serviceStart')}</TooltipContent>
                                  </Tooltip>
                                ) : (
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-7 w-7"
                                        disabled={!!actionLoading}
                                        onClick={() => handleServiceAction(service.name, 'stop')}
                                      >
                                        {actionLoading === `${service.name}-stop` ? (
                                          <Loader2 className="h-3 w-3 animate-spin" />
                                        ) : (
                                          <Square className="h-3 w-3" />
                                        )}
                                      </Button>
                                    </TooltipTrigger>
                                    <TooltipContent>{t('wsl.detail.serviceStop')}</TooltipContent>
                                  </Tooltip>
                                )}
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-7 w-7"
                                      disabled={!!actionLoading}
                                      onClick={() => handleServiceAction(service.name, 'restart')}
                                    >
                                      {actionLoading === `${service.name}-restart` ? (
                                        <Loader2 className="h-3 w-3 animate-spin" />
                                      ) : (
                                        <RotateCw className="h-3 w-3" />
                                      )}
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>{t('wsl.detail.serviceRestart')}</TooltipContent>
                                </Tooltip>
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </ScrollArea>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
