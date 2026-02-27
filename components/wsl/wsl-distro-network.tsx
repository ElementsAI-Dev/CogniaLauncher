'use client';

import { useState, useCallback, useEffect } from 'react';
import { writeClipboard } from '@/lib/clipboard';
import { Card, CardContent, CardHeader, CardTitle, CardAction } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
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
  Network,
  RefreshCw,
  Globe,
  Server,
  Copy,
  Unplug,
} from 'lucide-react';
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty';
import { toast } from 'sonner';
import { parseListeningPorts, parseInterfaces } from '@/lib/wsl';
import type { NetworkInfo, ListeningPort, NetworkInterface, WslDistroNetworkProps } from '@/types/wsl';

export function WslDistroNetwork({ distroName, isRunning, getIpAddress, onExec, t }: WslDistroNetworkProps) {
  const [info, setInfo] = useState<NetworkInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      // Get IP address
      let ipAddress = '';
      try {
        ipAddress = await getIpAddress(distroName);
      } catch {
        ipAddress = '';
      }

      // Get hostname
      let hostname = '';
      try {
        const hostnameResult = await onExec(distroName, 'hostname');
        hostname = hostnameResult.stdout.trim();
      } catch {
        hostname = '';
      }

      // Get DNS
      let dns: string[] = [];
      try {
        const dnsResult = await onExec(distroName, "grep 'nameserver' /etc/resolv.conf | awk '{print $2}'");
        dns = dnsResult.stdout.split('\n').filter((l) => l.trim());
      } catch {
        dns = [];
      }

      // Get listening ports
      let listeningPorts: ListeningPort[] = [];
      try {
        const portsResult = await onExec(distroName, 'ss -tlnp 2>/dev/null || netstat -tlnp 2>/dev/null || true');
        listeningPorts = parseListeningPorts(portsResult.stdout);
      } catch {
        listeningPorts = [];
      }

      // Get network interfaces
      let interfaces: NetworkInterface[] = [];
      try {
        const ifResult = await onExec(distroName, 'ip addr show 2>/dev/null || ifconfig 2>/dev/null || true');
        interfaces = parseInterfaces(ifResult.stdout);
      } catch {
        interfaces = [];
      }

      setInfo({ hostname, ipAddress, dns, listeningPorts, interfaces });
      setLoaded(true);
    } catch {
      setInfo(null);
    } finally {
      setLoading(false);
    }
  }, [distroName, getIpAddress, onExec]);

  // Auto-load if running
  useEffect(() => {
    if (isRunning && !loaded) {
      refresh();
    }
  }, [isRunning, loaded, refresh]);

  const handleCopy = async (text: string) => {
    await writeClipboard(text);
    toast.success(t('common.copied'));
  };

  return (
    <div className="space-y-4">
      {/* Overview card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <Network className="h-4 w-4 text-muted-foreground" />
            {t('wsl.detail.networkInfo')}
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
        <CardContent>
          {!isRunning && !loaded && (
            <Empty className="border-none py-4">
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <Unplug />
                </EmptyMedia>
                <EmptyTitle className="text-sm font-normal text-muted-foreground">
                  {t('wsl.detail.networkNotRunning')}
                </EmptyTitle>
              </EmptyHeader>
            </Empty>
          )}

          {loading && (
            <div className="space-y-3">
              <Skeleton className="h-5 w-48" />
              <Skeleton className="h-5 w-36" />
              <Skeleton className="h-5 w-40" />
            </div>
          )}

          {!loading && info && (
            <div className="space-y-3">
              {/* Hostname */}
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground flex items-center gap-1.5">
                  <Server className="h-3.5 w-3.5" />
                  {t('wsl.detail.hostname')}
                </span>
                <div className="flex items-center gap-1.5">
                  <span className="text-sm font-mono">{info.hostname || '—'}</span>
                  {info.hostname && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-5 w-5" onClick={() => handleCopy(info.hostname)}>
                          <Copy className="h-2.5 w-2.5" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>{t('common.copy')}</TooltipContent>
                    </Tooltip>
                  )}
                </div>
              </div>

              {/* IP Address */}
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground flex items-center gap-1.5">
                  <Globe className="h-3.5 w-3.5" />
                  {t('wsl.ipAddress')}
                </span>
                <div className="flex items-center gap-1.5">
                  <span className="text-sm font-mono">{info.ipAddress || '—'}</span>
                  {info.ipAddress && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-5 w-5" onClick={() => handleCopy(info.ipAddress)}>
                          <Copy className="h-2.5 w-2.5" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>{t('common.copy')}</TooltipContent>
                    </Tooltip>
                  )}
                </div>
              </div>

              {/* DNS */}
              {info.dns.length > 0 && (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">DNS</span>
                  <div className="flex items-center gap-1.5 flex-wrap justify-end">
                    {info.dns.map((dns) => (
                      <Badge key={dns} variant="outline" className="text-xs font-mono">
                        {dns}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Network Interfaces */}
      {info && info.interfaces.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold">
              {t('wsl.detail.networkInterfaces')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="max-h-[300px]">
              <div className="space-y-3">
                {info.interfaces.map((iface) => (
                  <div key={iface.name} className="rounded-md border p-3 space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-sm">{iface.name}</span>
                      {iface.mac && (
                        <Badge variant="outline" className="text-[10px] font-mono">
                          {iface.mac}
                        </Badge>
                      )}
                    </div>
                    {iface.ipv4 && (
                      <div className="text-xs text-muted-foreground">
                        <span className="mr-2">IPv4:</span>
                        <span className="font-mono">{iface.ipv4}</span>
                      </div>
                    )}
                    {iface.ipv6 && (
                      <div className="text-xs text-muted-foreground">
                        <span className="mr-2">IPv6:</span>
                        <span className="font-mono truncate">{iface.ipv6}</span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      )}

      {/* Listening Ports */}
      {info && info.listeningPorts.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              {t('wsl.detail.listeningPorts')}
              <Badge variant="secondary" className="text-xs">
                {info.listeningPorts.length}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="max-h-[300px]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('wsl.detail.portProtocol')}</TableHead>
                    <TableHead>{t('wsl.detail.portAddress')}</TableHead>
                    <TableHead>{t('wsl.detail.portNumber')}</TableHead>
                    <TableHead>{t('wsl.detail.portProcess')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {info.listeningPorts.map((port, i) => (
                    <TableRow key={i}>
                      <TableCell>
                        <Badge variant="outline" className="text-[10px]">
                          {port.protocol}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-mono text-xs">{port.address || '*'}</TableCell>
                      <TableCell className="font-mono text-xs font-semibold">{port.port}</TableCell>
                      <TableCell className="text-xs text-muted-foreground truncate">{port.process || '—'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>
          </CardContent>
        </Card>
      )}

      {/* No ports */}
      {info && info.listeningPorts.length === 0 && loaded && (
        <Card>
          <CardContent className="pt-6">
            <Empty className="border-none py-4">
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <Network />
                </EmptyMedia>
                <EmptyTitle className="text-sm font-normal text-muted-foreground">
                  {t('wsl.detail.noPorts')}
                </EmptyTitle>
              </EmptyHeader>
            </Empty>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
