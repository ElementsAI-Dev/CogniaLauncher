'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import Link from 'next/link';
import { useWsl } from '@/hooks/use-wsl';
import { useLocale } from '@/components/providers/locale-provider';
import { isTauri } from '@/lib/tauri';
import { PageHeader } from '@/components/layout/page-header';
import { PageLoadingSkeleton } from '@/components/layout/page-loading-skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import {
  Breadcrumb as BreadcrumbRoot,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';
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
  WslExportDialog,
} from '@/components/wsl';
import { WslDistroOverview } from '@/components/wsl/wsl-distro-overview';
import { WslDistroTerminal } from '@/components/wsl/wsl-distro-terminal';
import { WslDistroFilesystem } from '@/components/wsl/wsl-distro-filesystem';
import { WslDistroNetwork } from '@/components/wsl/wsl-distro-network';
import { WslDistroServices } from '@/components/wsl/wsl-distro-services';
import {
  RefreshCw,
  Play,
  Square,
  AlertCircle,
  LayoutDashboard,
  TerminalSquare,
  FolderOpen,
  Network,
  Cog,
  Star,
  Download,
  Trash2,
  ArrowUpDown,
  UserCog,
} from 'lucide-react';
import { toast } from 'sonner';
import type { WslDistroStatus } from '@/types/tauri';

interface WslDistroDetailPageProps {
  distroName: string;
}

export function WslDistroDetailPage({ distroName }: WslDistroDetailPageProps) {
  const { t } = useLocale();
  const isDesktop = isTauri();
  const {
    available,
    distros,
    loading,
    error,
    checkAvailability,
    refreshDistros,
    refreshStatus,
    terminate,
    setDefault,
    setVersion,
    exportDistro,
    launch,
    execCommand,
    getDiskUsage,
    getIpAddress,
    changeDefaultUser,
    getDistroConfig,
    setDistroConfigValue,
    detectDistroEnv,
  } = useWsl();

  const initializedRef = useRef(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [confirmAction, setConfirmAction] = useState<{
    type: 'unregister' | 'terminate';
  } | null>(null);

  // Initialize on mount
  useEffect(() => {
    if (!isDesktop || initializedRef.current) return;
    initializedRef.current = true;

    const init = async () => {
      const isAvailable = await checkAvailability();
      if (isAvailable) {
        await refreshDistros();
        await refreshStatus();
      }
    };
    init();
  }, [isDesktop, checkAvailability, refreshDistros, refreshStatus]);

  // Find the distro data
  const distro: WslDistroStatus | undefined = distros.find(
    (d) => d.name === distroName
  );

  const isRunning = distro?.state.toLowerCase() === 'running';
  const wslVer = distro ? parseInt(distro.wslVersion, 10) : 2;
  const targetVersion = wslVer === 1 ? 2 : 1;

  const handleRefresh = useCallback(async () => {
    await refreshDistros();
    await refreshStatus();
  }, [refreshDistros, refreshStatus]);

  const handleLaunch = useCallback(async () => {
    try {
      await launch(distroName);
      toast.success(`${distroName} launched`);
      await handleRefresh();
    } catch (err) {
      toast.error(String(err));
    }
  }, [launch, distroName, handleRefresh]);

  const handleTerminate = useCallback(async () => {
    try {
      await terminate(distroName);
      toast.success(t('wsl.terminateSuccess').replace('{name}', distroName));
      await handleRefresh();
    } catch (err) {
      toast.error(String(err));
    }
  }, [terminate, distroName, t, handleRefresh]);

  const handleSetDefault = useCallback(async () => {
    try {
      await setDefault(distroName);
      toast.success(t('wsl.setDefaultSuccess').replace('{name}', distroName));
      await handleRefresh();
    } catch (err) {
      toast.error(String(err));
    }
  }, [setDefault, distroName, t, handleRefresh]);

  const handleSetVersion = useCallback(async () => {
    try {
      await setVersion(distroName, targetVersion);
      toast.success(
        t('wsl.setVersionSuccess')
          .replace('{name}', distroName)
          .replace('{version}', String(targetVersion))
      );
      await handleRefresh();
    } catch (err) {
      toast.error(String(err));
    }
  }, [setVersion, distroName, targetVersion, t, handleRefresh]);

  const handleExport = useCallback(
    async (name: string, filePath: string, asVhd: boolean) => {
      try {
        await exportDistro(name, filePath, asVhd);
        toast.success(t('wsl.exportSuccess').replace('{name}', name));
      } catch (err) {
        toast.error(String(err));
      }
    },
    [exportDistro, t]
  );

  const handleUnregister = useCallback(async () => {
    try {
      const { packageUninstall } = await import('@/lib/tauri');
      await packageUninstall([`wsl:${distroName}`]);
      toast.success(t('wsl.unregisterSuccess').replace('{name}', distroName));
      // Navigate back after unregister
      window.location.href = '/wsl';
    } catch (err) {
      toast.error(String(err));
    }
  }, [distroName, t]);

  const handleChangeDefaultUser = useCallback(async () => {
    const username = window.prompt(t('wsl.username'));
    if (!username) return;
    try {
      await changeDefaultUser(distroName, username);
      toast.success(
        t('wsl.changeDefaultUserSuccess')
          .replace('{name}', distroName)
          .replace('{user}', username)
      );
    } catch (err) {
      toast.error(String(err));
    }
  }, [changeDefaultUser, distroName, t]);

  const confirmAndExecute = useCallback(async () => {
    if (!confirmAction) return;
    if (confirmAction.type === 'unregister') {
      await handleUnregister();
    } else if (confirmAction.type === 'terminate') {
      await handleTerminate();
    }
    setConfirmAction(null);
  }, [confirmAction, handleUnregister, handleTerminate]);

  // Non-Tauri fallback
  if (!isDesktop) {
    return (
      <div className="p-4 md:p-6">
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{t('wsl.notAvailable')}</AlertDescription>
        </Alert>
      </div>
    );
  }

  // Loading state
  if (available === null || (loading && distros.length === 0)) {
    return <PageLoadingSkeleton variant="detail" />;
  }

  // Distro not found
  if (available && distros.length > 0 && !distro) {
    return (
      <div className="p-4 md:p-6 space-y-4">
        <BreadcrumbRoot>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink asChild>
                <Link href="/wsl">{t('wsl.title')}</Link>
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>{distroName}</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </BreadcrumbRoot>
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            {t('wsl.detail.notFound').replace('{name}', distroName)}
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-6">
      {/* Breadcrumb */}
      <BreadcrumbRoot>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink asChild>
              <Link href="/wsl">{t('wsl.title')}</Link>
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>{distroName}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </BreadcrumbRoot>

      {/* Header */}
      <PageHeader
        title={
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary/10">
              <TerminalSquare className="h-6 w-6 text-primary" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span>{distroName}</span>
                {distro?.isDefault && (
                  <Star className="h-4 w-4 text-yellow-500 fill-yellow-500" />
                )}
              </div>
              <div className="flex items-center gap-2 mt-1">
                <Badge variant={isRunning ? 'default' : 'secondary'} className="text-xs">
                  {isRunning ? t('wsl.running') : t('wsl.stopped')}
                </Badge>
                <Badge variant="outline" className="text-xs">
                  WSL {distro?.wslVersion ?? '?'}
                </Badge>
                {distro?.isDefault && (
                  <Badge variant="outline" className="text-xs text-yellow-600 border-yellow-300">
                    Default
                  </Badge>
                )}
              </div>
            </div>
          </div>
        }
        actions={
          <div className="flex items-center gap-2">
            {isRunning ? (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setConfirmAction({ type: 'terminate' })}
                className="gap-1.5"
              >
                <Square className="h-3.5 w-3.5" />
                {t('wsl.terminate')}
              </Button>
            ) : (
              <Button
                variant="default"
                size="sm"
                onClick={handleLaunch}
                className="gap-1.5"
              >
                <Play className="h-3.5 w-3.5" />
                {t('wsl.launch')}
              </Button>
            )}
            {!distro?.isDefault && (
              <Button variant="outline" size="sm" onClick={handleSetDefault} className="gap-1.5">
                <Star className="h-3.5 w-3.5" />
                {t('wsl.setDefault')}
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={handleSetVersion} className="gap-1.5">
              <ArrowUpDown className="h-3.5 w-3.5" />
              WSL {targetVersion}
            </Button>
            <Button variant="outline" size="sm" onClick={handleChangeDefaultUser} className="gap-1.5">
              <UserCog className="h-3.5 w-3.5" />
              {t('wsl.changeDefaultUser')}
            </Button>
            <Button variant="outline" size="sm" onClick={() => setExportOpen(true)} className="gap-1.5">
              <Download className="h-3.5 w-3.5" />
              {t('wsl.export')}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setConfirmAction({ type: 'unregister' })}
              className="gap-1.5 text-destructive hover:text-destructive"
            >
              <Trash2 className="h-3.5 w-3.5" />
              {t('wsl.unregister')}
            </Button>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handleRefresh}
                  disabled={loading}
                  className="h-8 w-8"
                >
                  <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                </Button>
              </TooltipTrigger>
              <TooltipContent>{t('common.refresh')}</TooltipContent>
            </Tooltip>
          </div>
        }
      />

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Tabs */}
      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview" className="gap-1.5">
            <LayoutDashboard className="h-3.5 w-3.5" />
            {t('wsl.detail.tabOverview')}
          </TabsTrigger>
          <TabsTrigger value="terminal" className="gap-1.5">
            <TerminalSquare className="h-3.5 w-3.5" />
            {t('wsl.detail.tabTerminal')}
          </TabsTrigger>
          <TabsTrigger value="filesystem" className="gap-1.5">
            <FolderOpen className="h-3.5 w-3.5" />
            {t('wsl.detail.tabFilesystem')}
          </TabsTrigger>
          <TabsTrigger value="network" className="gap-1.5">
            <Network className="h-3.5 w-3.5" />
            {t('wsl.detail.tabNetwork')}
          </TabsTrigger>
          <TabsTrigger value="services" className="gap-1.5">
            <Cog className="h-3.5 w-3.5" />
            {t('wsl.detail.tabServices')}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <WslDistroOverview
            distroName={distroName}
            distro={distro ?? null}
            getDiskUsage={getDiskUsage}
            getIpAddress={getIpAddress}
            getDistroConfig={getDistroConfig}
            setDistroConfigValue={setDistroConfigValue}
            detectDistroEnv={detectDistroEnv}
            t={t}
          />
        </TabsContent>

        <TabsContent value="terminal">
          <WslDistroTerminal
            distroName={distroName}
            isRunning={isRunning}
            onExec={execCommand}
            t={t}
          />
        </TabsContent>

        <TabsContent value="filesystem">
          <WslDistroFilesystem
            distroName={distroName}
            isRunning={isRunning}
            onExec={execCommand}
            t={t}
          />
        </TabsContent>

        <TabsContent value="network">
          <WslDistroNetwork
            distroName={distroName}
            isRunning={isRunning}
            getIpAddress={getIpAddress}
            onExec={execCommand}
            t={t}
          />
        </TabsContent>

        <TabsContent value="services">
          <WslDistroServices
            distroName={distroName}
            isRunning={isRunning}
            onExec={execCommand}
            t={t}
          />
        </TabsContent>
      </Tabs>

      {/* Export Dialog */}
      <WslExportDialog
        open={exportOpen}
        distroName={distroName}
        onOpenChange={setExportOpen}
        onExport={handleExport}
        t={t}
      />

      {/* Confirm Dialog */}
      <AlertDialog
        open={!!confirmAction}
        onOpenChange={(open) => !open && setConfirmAction(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirmAction?.type === 'unregister'
                ? t('wsl.unregister')
                : t('wsl.terminate')}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirmAction?.type === 'unregister'
                ? t('wsl.unregisterConfirm').replace('{name}', distroName)
                : `${t('wsl.terminate')} ${distroName}?`}
              {confirmAction?.type === 'unregister' && (
                <>
                  <br />
                  <span className="text-destructive font-medium">
                    {t('wsl.dataLossWarning')}
                  </span>
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmAndExecute}
              className={
                confirmAction?.type === 'unregister'
                  ? 'bg-destructive text-destructive-foreground hover:bg-destructive/90'
                  : ''
              }
            >
              {t('common.confirm')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
