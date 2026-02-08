'use client';

import { useState, useCallback, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Cog,
  RefreshCw,
  Play,
  Square,
  RotateCw,
  Search,
  AlertCircle,
  CheckCircle2,
  XCircle,
  Clock,
  Loader2,
} from 'lucide-react';
import { toast } from 'sonner';
import type { WslExecResult } from '@/types/tauri';

interface ServiceInfo {
  name: string;
  status: 'running' | 'stopped' | 'failed' | 'exited' | 'inactive' | 'other';
  description: string;
  pid?: string;
  activeState: string;
  subState: string;
}

interface WslDistroServicesProps {
  distroName: string;
  isRunning: boolean;
  onExec: (distro: string, command: string, user?: string) => Promise<WslExecResult>;
  t: (key: string, params?: Record<string, string | number>) => string;
}

function parseServices(output: string): ServiceInfo[] {
  const services: ServiceInfo[] = [];
  const lines = output.split('\n').filter((l) => l.trim());

  for (const line of lines) {
    // Parse systemctl list-units --type=service --no-pager --no-legend output
    // Format: UNIT LOAD ACTIVE SUB DESCRIPTION...
    const match = line.trim().match(/^(\S+\.service)\s+(\S+)\s+(\S+)\s+(\S+)\s+(.*)/);
    if (!match) continue;

    const [, unit, , active, sub, description] = match;
    const name = unit.replace('.service', '');

    let status: ServiceInfo['status'] = 'other';
    if (sub === 'running') status = 'running';
    else if (active === 'inactive' || sub === 'dead') status = 'inactive';
    else if (active === 'failed') status = 'failed';
    else if (sub === 'exited') status = 'exited';
    else if (active === 'active' && sub !== 'running') status = 'stopped';

    services.push({
      name,
      status,
      description: description.trim(),
      activeState: active,
      subState: sub,
    });
  }

  return services;
}

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

function getStatusVariant(status: ServiceInfo['status']): 'default' | 'secondary' | 'destructive' | 'outline' {
  switch (status) {
    case 'running': return 'default';
    case 'failed': return 'destructive';
    case 'exited': return 'outline';
    default: return 'secondary';
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

  const runningCount = services.filter((s) => s.status === 'running').length;
  const failedCount = services.filter((s) => s.status === 'failed').length;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
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
          <Button
            variant="ghost"
            size="icon"
            onClick={refresh}
            disabled={loading}
            className="h-8 w-8"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        </CardHeader>
        <CardContent className="space-y-3">
          {/* Not running */}
          {!isRunning && !loaded && (
            <p className="text-sm text-muted-foreground text-center py-4">
              {t('wsl.detail.servicesNotRunning')}
            </p>
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
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                {t('wsl.detail.noSystemd')}
              </AlertDescription>
            </Alert>
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
                <p className="text-sm text-muted-foreground text-center py-4">
                  {search ? t('wsl.detail.noServicesMatch') : t('wsl.detail.noServices')}
                </p>
              ) : (
                <ScrollArea className="max-h-[500px]">
                  <div className="space-y-1">
                    {filteredServices.map((service) => {
                      const isActive = service.status === 'running';
                      return (
                        <div
                          key={service.name}
                          className="flex items-center gap-2 px-2 py-2 rounded hover:bg-muted transition-colors group"
                        >
                          {getStatusIcon(service.status)}
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-mono font-medium truncate">{service.name}</span>
                              <Badge variant={getStatusVariant(service.status)} className="text-[10px]">
                                {service.subState}
                              </Badge>
                            </div>
                            {service.description && (
                              <p className="text-xs text-muted-foreground truncate">{service.description}</p>
                            )}
                          </div>
                          <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                            {!isActive ? (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7"
                                disabled={!!actionLoading}
                                onClick={() => handleServiceAction(service.name, 'start')}
                                title="Start"
                              >
                                {actionLoading === `${service.name}-start` ? (
                                  <Loader2 className="h-3 w-3 animate-spin" />
                                ) : (
                                  <Play className="h-3 w-3" />
                                )}
                              </Button>
                            ) : (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7"
                                disabled={!!actionLoading}
                                onClick={() => handleServiceAction(service.name, 'stop')}
                                title="Stop"
                              >
                                {actionLoading === `${service.name}-stop` ? (
                                  <Loader2 className="h-3 w-3 animate-spin" />
                                ) : (
                                  <Square className="h-3 w-3" />
                                )}
                              </Button>
                            )}
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7"
                              disabled={!!actionLoading}
                              onClick={() => handleServiceAction(service.name, 'restart')}
                              title="Restart"
                            >
                              {actionLoading === `${service.name}-restart` ? (
                                <Loader2 className="h-3 w-3 animate-spin" />
                              ) : (
                                <RotateCw className="h-3 w-3" />
                              )}
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </ScrollArea>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
