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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import {
  Network,
  RefreshCw,
  Globe,
  Server,
  Copy,
  Unplug,
  Plus,
  Trash2,
  ArrowRightLeft,
} from 'lucide-react';
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty';
import { toast } from 'sonner';
import { parseListeningPorts, parseInterfaces } from '@/lib/wsl';
import type { NetworkInfo, ListeningPort, NetworkInterface, WslDistroNetworkProps } from '@/types/wsl';

interface PortForwardRule {
  listenAddress: string;
  listenPort: string;
  connectAddress: string;
  connectPort: string;
}

export function WslDistroNetwork({
  distroName,
  isRunning,
  getIpAddress,
  onExec,
  listPortForwards,
  addPortForward,
  removePortForward,
  t,
}: WslDistroNetworkProps) {
  const [info, setInfo] = useState<NetworkInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [portForwards, setPortForwards] = useState<PortForwardRule[]>([]);
  const [pfListenPort, setPfListenPort] = useState('');
  const [pfConnectPort, setPfConnectPort] = useState('');
  const [pfConnectAddr, setPfConnectAddr] = useState('');
  const [pfAdding, setPfAdding] = useState(false);
  const [confirmAction, setConfirmAction] = useState<
    | { type: 'add'; rule: { listenPort: number; connectPort: number; connectAddress: string } }
    | { type: 'remove'; listenPort: number }
    | null
  >(null);

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

  const refreshPortForwards = useCallback(async () => {
    try {
      const rules = await listPortForwards();
      setPortForwards(rules);
    } catch {
      setPortForwards([]);
    }
  }, [listPortForwards]);

  const showMutationError = useCallback((err: unknown) => {
    toast.error(t('wsl.detail.portForward.actionFailed').replace('{error}', String(err)));
  }, [t]);

  const performAddPortForward = useCallback(async (rule: {
    listenPort: number;
    connectPort: number;
    connectAddress: string;
  }) => {
    setPfAdding(true);
    try {
      await addPortForward(rule.listenPort, rule.connectPort, rule.connectAddress);
      toast.success(t('wsl.detail.portForward.added'));
      setPfListenPort('');
      setPfConnectPort('');
      setPfConnectAddr('');
      await refreshPortForwards();
    } catch (err) {
      showMutationError(err);
    } finally {
      setPfAdding(false);
    }
  }, [addPortForward, refreshPortForwards, showMutationError, t]);

  const performRemovePortForward = useCallback(async (listenPort: number) => {
    try {
      await removePortForward(listenPort);
      toast.success(t('wsl.detail.portForward.removed'));
      await refreshPortForwards();
    } catch (err) {
      showMutationError(err);
    }
  }, [refreshPortForwards, removePortForward, showMutationError, t]);

  const handleAddPortForward = useCallback(() => {
    const lp = parseInt(pfListenPort, 10);
    const cp = parseInt(pfConnectPort, 10);
    if (!lp || !cp || !pfConnectAddr.trim()) return;
    setConfirmAction({
      type: 'add',
      rule: { listenPort: lp, connectPort: cp, connectAddress: pfConnectAddr.trim() },
    });
  }, [pfConnectAddr, pfConnectPort, pfListenPort]);

  const handleRemovePortForward = useCallback((listenPort: string) => {
    const lp = parseInt(listenPort, 10);
    if (!lp) return;
    setConfirmAction({ type: 'remove', listenPort: lp });
  }, []);

  const confirmAndExecute = useCallback(async () => {
    if (!confirmAction) return;
    if (confirmAction.type === 'add') {
      await performAddPortForward(confirmAction.rule);
    } else {
      await performRemovePortForward(confirmAction.listenPort);
    }
    setConfirmAction(null);
  }, [confirmAction, performAddPortForward, performRemovePortForward]);

  // Auto-load if running
  useEffect(() => {
    if (isRunning && !loaded) {
      refresh();
      refreshPortForwards();
    }
  }, [isRunning, loaded, refresh, refreshPortForwards]);

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

      {/* Port Forwarding */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <ArrowRightLeft className="h-4 w-4 text-muted-foreground" />
            {t('wsl.detail.portForward.title')}
            {portForwards.length > 0 && (
              <Badge variant="secondary" className="text-xs">
                {portForwards.length}
              </Badge>
            )}
          </CardTitle>
          <CardAction>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={refreshPortForwards}
                  className="h-8 w-8"
                >
                  <RefreshCw className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>{t('common.refresh')}</TooltipContent>
            </Tooltip>
          </CardAction>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-xs text-muted-foreground">{t('wsl.detail.portForward.desc')}</p>
          <p className="text-xs text-muted-foreground">{t('wsl.detail.portForward.riskHint')}</p>

          {portForwards.length > 0 && (
            <ScrollArea className="max-h-[200px]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('wsl.detail.portForward.listenPort')}</TableHead>
                    <TableHead>{t('wsl.detail.portForward.connectAddr')}</TableHead>
                    <TableHead>{t('wsl.detail.portForward.connectPort')}</TableHead>
                    <TableHead className="w-10" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {portForwards.map((rule, i) => (
                    <TableRow key={i}>
                      <TableCell className="font-mono text-xs">{rule.listenPort}</TableCell>
                      <TableCell className="font-mono text-xs">{rule.connectAddress}</TableCell>
                      <TableCell className="font-mono text-xs">{rule.connectPort}</TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          aria-label={`remove-port-forward-${rule.listenPort}`}
                          onClick={() => handleRemovePortForward(rule.listenPort)}
                        >
                          <Trash2 className="h-3 w-3 text-destructive" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>
          )}

          <div className="flex items-end gap-2">
            <div className="flex-1 space-y-1">
              <span className="text-xs text-muted-foreground">{t('wsl.detail.portForward.listenPort')}</span>
              <Input
                className="h-7 text-xs"
                type="number"
                placeholder="3000"
                value={pfListenPort}
                onChange={(e) => setPfListenPort(e.target.value)}
              />
            </div>
            <div className="flex-1 space-y-1">
              <span className="text-xs text-muted-foreground">{t('wsl.detail.portForward.connectAddr')}</span>
              <Input
                className="h-7 text-xs"
                placeholder={info?.ipAddress || '172.x.x.x'}
                value={pfConnectAddr}
                onChange={(e) => setPfConnectAddr(e.target.value)}
              />
            </div>
            <div className="flex-1 space-y-1">
              <span className="text-xs text-muted-foreground">{t('wsl.detail.portForward.connectPort')}</span>
              <Input
                className="h-7 text-xs"
                type="number"
                placeholder="3000"
                value={pfConnectPort}
                onChange={(e) => setPfConnectPort(e.target.value)}
              />
            </div>
            <Button
              variant="outline"
              size="sm"
              className="h-7 gap-1"
              aria-label="add-port-forward-rule"
              disabled={pfAdding || !pfListenPort || !pfConnectPort || !pfConnectAddr}
              onClick={handleAddPortForward}
            >
              <Plus className="h-3 w-3" />
            </Button>
          </div>

          <div className="flex gap-1 flex-wrap">
            {[3000, 5432, 8080, 8443].map((port) => (
              <Button
                key={port}
                variant="outline"
                size="sm"
                className="h-6 text-[10px] px-2"
                onClick={() => {
                  setPfListenPort(String(port));
                  setPfConnectPort(String(port));
                  if (info?.ipAddress) setPfConnectAddr(info.ipAddress);
                }}
              >
                :{port}
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      <AlertDialog open={!!confirmAction} onOpenChange={(open) => !open && setConfirmAction(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirmAction?.type === 'add'
                ? t('wsl.detail.portForward.confirmAddTitle')
                : t('wsl.detail.portForward.confirmRemoveTitle')}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirmAction?.type === 'add'
                ? t('wsl.detail.portForward.confirmAddDesc')
                    .replace('{listenPort}', String(confirmAction.rule.listenPort))
                    .replace('{connectAddress}', confirmAction.rule.connectAddress)
                    .replace('{connectPort}', String(confirmAction.rule.connectPort))
                : t('wsl.detail.portForward.confirmRemoveDesc')
                    .replace('{listenPort}', String(confirmAction?.listenPort ?? ''))}
              <br />
              <span className="text-muted-foreground">{t('wsl.detail.portForward.riskHint')}</span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmAndExecute}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {t('common.confirm')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
