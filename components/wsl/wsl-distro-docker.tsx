'use client';

import { useState, useCallback, useEffect } from 'react';
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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Input } from '@/components/ui/input';
import {
  Container,
  RefreshCw,
  Play,
  Square,
  RotateCw,
  Trash2,
  Loader2,
  Box,
} from 'lucide-react';
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty';
import { toast } from 'sonner';
import type { WslExecResult } from '@/types/tauri';

interface DockerContainer {
  id: string;
  name: string;
  image: string;
  status: string;
  ports: string;
  state: string;
}

interface DockerImage {
  repository: string;
  tag: string;
  id: string;
  size: string;
}

interface WslDistroDockerProps {
  distroName: string;
  isRunning: boolean;
  onExec: (distro: string, command: string, user?: string) => Promise<WslExecResult>;
  t: (key: string, params?: Record<string, string | number>) => string;
}

export function WslDistroDocker({ distroName, isRunning, onExec, t }: WslDistroDockerProps) {
  const [dockerVersion, setDockerVersion] = useState<string | null>(null);
  const [containers, setContainers] = useState<DockerContainer[]>([]);
  const [images, setImages] = useState<DockerImage[]>([]);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [pruneConfirmOpen, setPruneConfirmOpen] = useState(false);
  const [containerSearch, setContainerSearch] = useState('');

  const refresh = useCallback(async () => {
    if (!isRunning) return;
    setLoading(true);
    try {
      // Docker version
      const verResult = await onExec(distroName, "docker version --format '{{.Server.Version}}' 2>/dev/null || echo ''");
      setDockerVersion(verResult.stdout.trim() || null);

      // Containers
      const cResult = await onExec(distroName, "docker ps -a --format '{{.ID}}\\t{{.Names}}\\t{{.Image}}\\t{{.Status}}\\t{{.Ports}}\\t{{.State}}' 2>/dev/null || echo ''");
      const parsedContainers: DockerContainer[] = cResult.stdout
        .split('\n')
        .filter((l) => l.trim())
        .map((line) => {
          const parts = line.split('\t');
          return {
            id: parts[0] ?? '',
            name: parts[1] ?? '',
            image: parts[2] ?? '',
            status: parts[3] ?? '',
            ports: parts[4] ?? '',
            state: parts[5]?.toLowerCase() ?? '',
          };
        })
        .filter((c) => c.id);
      setContainers(parsedContainers);

      // Images
      const iResult = await onExec(distroName, "docker images --format '{{.Repository}}\\t{{.Tag}}\\t{{.ID}}\\t{{.Size}}' 2>/dev/null || echo ''");
      const parsedImages: DockerImage[] = iResult.stdout
        .split('\n')
        .filter((l) => l.trim())
        .map((line) => {
          const parts = line.split('\t');
          return {
            repository: parts[0] ?? '',
            tag: parts[1] ?? '',
            id: parts[2] ?? '',
            size: parts[3] ?? '',
          };
        })
        .filter((img) => img.repository);
      setImages(parsedImages);

      setLoaded(true);
    } catch {
      setDockerVersion(null);
      setContainers([]);
      setImages([]);
    } finally {
      setLoading(false);
    }
  }, [distroName, isRunning, onExec]);

  useEffect(() => {
    if (isRunning && !loaded) {
      refresh();
    }
  }, [isRunning, loaded, refresh]);

  const handleContainerAction = useCallback(async (containerId: string, action: 'start' | 'stop' | 'restart') => {
    setActionLoading(`${containerId}-${action}`);
    try {
      const result = await onExec(distroName, `docker ${action} ${containerId} 2>&1`);
      if (result.exitCode === 0) {
        toast.success(t('wsl.detail.docker.actionSuccess').replace('{action}', action));
        await refresh();
      } else {
        toast.error(result.stderr || result.stdout || `Failed to ${action}`);
      }
    } catch (err) {
      toast.error(String(err));
    } finally {
      setActionLoading(null);
    }
  }, [distroName, onExec, refresh, t]);

  const handlePrune = useCallback(async () => {
    setActionLoading('prune');
    try {
      const result = await onExec(distroName, 'docker system prune -f 2>&1');
      if (result.exitCode === 0) {
        toast.success(t('wsl.detail.docker.pruneSuccess'));
        await refresh();
      } else {
        toast.error(result.stderr || result.stdout);
      }
    } catch (err) {
      toast.error(String(err));
    } finally {
      setActionLoading(null);
    }
  }, [distroName, onExec, refresh, t]);

  const getImageSizeClass = (size: string): string => {
    const upper = size.toUpperCase();
    if (upper.includes('GB')) return 'text-red-600 dark:text-red-400 font-medium';
    if (upper.includes('MB')) {
      const num = parseFloat(size);
      if (!isNaN(num) && num > 500) return 'text-amber-600 dark:text-amber-400 font-medium';
    }
    return 'text-muted-foreground';
  };

  const filteredContainers = containers.filter((c) => {
    if (!containerSearch) return true;
    const search = containerSearch.toLowerCase();
    return c.name.toLowerCase().includes(search) || c.image.toLowerCase().includes(search);
  });

  if (!isRunning) {
    return (
      <Card>
        <CardContent className="pt-6">
          <Empty className="border-none py-4">
            <EmptyHeader>
              <EmptyMedia variant="icon"><Container /></EmptyMedia>
              <EmptyTitle className="text-sm font-normal text-muted-foreground">
                {t('wsl.detail.docker.notRunning')}
              </EmptyTitle>
            </EmptyHeader>
          </Empty>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Docker Info */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <Container className="h-4 w-4 text-muted-foreground" />
            {t('wsl.detail.docker.title')}
            {dockerVersion && (
              <Badge variant="outline" className="text-xs font-mono">{dockerVersion}</Badge>
            )}
          </CardTitle>
          <CardAction>
            <div className="flex items-center gap-1">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs gap-1"
                    onClick={() => setPruneConfirmOpen(true)}
                    disabled={!!actionLoading}
                  >
                    {actionLoading === 'prune' ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
                    {t('wsl.detail.docker.prune')}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>{t('wsl.detail.docker.pruneDesc')}</TooltipContent>
              </Tooltip>
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={refresh} disabled={loading}>
                <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
              </Button>
            </div>
          </CardAction>
        </CardHeader>
        <CardContent>
          {loading && !loaded ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => <Skeleton key={i} className="h-8 w-full" />)}
            </div>
          ) : !dockerVersion ? (
            <Empty className="border-none py-4">
              <EmptyHeader>
                <EmptyMedia variant="icon"><Container /></EmptyMedia>
                <EmptyTitle className="text-sm font-normal text-muted-foreground">
                  {t('wsl.detail.docker.notInstalled')}
                </EmptyTitle>
              </EmptyHeader>
            </Empty>
          ) : null}
        </CardContent>
      </Card>

      {/* Containers */}
      {loaded && dockerVersion && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Box className="h-3.5 w-3.5 text-muted-foreground" />
              {t('wsl.detail.docker.containers')}
              <Badge variant="secondary" className="text-xs">{containers.length}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {containers.length > 0 && (
              <Input
                placeholder={t('wsl.detail.dockerSearchContainers')}
                value={containerSearch}
                onChange={(e) => setContainerSearch(e.target.value)}
                className="h-9 mb-3"
              />
            )}
            {filteredContainers.length === 0 ? (
              <p className="text-xs text-muted-foreground">{t('wsl.detail.docker.noContainers')}</p>
            ) : (
              <ScrollArea className="max-h-[400px]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t('wsl.detail.docker.containerName')}</TableHead>
                      <TableHead>{t('wsl.detail.docker.containerImage')}</TableHead>
                      <TableHead>{t('wsl.detail.docker.containerStatus')}</TableHead>
                      <TableHead className="w-24 text-right">{t('wsl.detail.docker.containerActions')}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredContainers.map((c) => {
                      const isActive = c.state === 'running';
                      return (
                        <TableRow key={c.id} className="group">
                          <TableCell className="font-mono text-xs">{c.name}</TableCell>
                          <TableCell className="text-xs text-muted-foreground truncate max-w-[150px]">{c.image}</TableCell>
                          <TableCell>
                            <Badge variant={isActive ? 'default' : 'secondary'} className="text-[10px]">
                              {c.state}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center gap-1.5 justify-end opacity-0 group-hover:opacity-100 transition-opacity">
                              {!isActive ? (
                                <Button variant="ghost" size="icon" className="h-6 w-6" disabled={!!actionLoading} onClick={() => handleContainerAction(c.id, 'start')}>
                                  {actionLoading === `${c.id}-start` ? <Loader2 className="h-3 w-3 animate-spin" /> : <Play className="h-3 w-3" />}
                                </Button>
                              ) : (
                                <Button variant="ghost" size="icon" className="h-6 w-6" disabled={!!actionLoading} onClick={() => handleContainerAction(c.id, 'stop')}>
                                  {actionLoading === `${c.id}-stop` ? <Loader2 className="h-3 w-3 animate-spin" /> : <Square className="h-3 w-3" />}
                                </Button>
                              )}
                              <Button variant="ghost" size="icon" className="h-6 w-6" disabled={!!actionLoading} onClick={() => handleContainerAction(c.id, 'restart')}>
                                {actionLoading === `${c.id}-restart` ? <Loader2 className="h-3 w-3 animate-spin" /> : <RotateCw className="h-3 w-3" />}
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </ScrollArea>
            )}
          </CardContent>
        </Card>
      )}

      {/* Images */}
      {loaded && dockerVersion && images.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              {t('wsl.detail.docker.images')}
              <Badge variant="secondary" className="text-xs">{images.length}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="max-h-[200px]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('wsl.detail.docker.imageRepo')}</TableHead>
                    <TableHead>{t('wsl.detail.docker.imageTag')}</TableHead>
                    <TableHead className="text-right">{t('wsl.detail.docker.imageSize')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {images.map((img) => (
                    <TableRow key={`${img.repository}:${img.tag}`}>
                      <TableCell className="font-mono text-xs">{img.repository}</TableCell>
                      <TableCell className="text-xs"><Badge variant="outline" className="text-[10px]">{img.tag}</Badge></TableCell>
                      <TableCell className={`text-right text-xs ${getImageSizeClass(img.size)}`}>{img.size}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>
          </CardContent>
        </Card>
      )}

      <AlertDialog open={pruneConfirmOpen} onOpenChange={setPruneConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('wsl.detail.dockerPruneConfirmTitle')}</AlertDialogTitle>
            <AlertDialogDescription>{t('wsl.detail.dockerPruneConfirmDesc')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={handlePrune} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {t('wsl.detail.docker.prune')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
