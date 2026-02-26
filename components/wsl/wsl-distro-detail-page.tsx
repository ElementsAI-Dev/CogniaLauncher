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
import { Card, CardContent, CardHeader } from '@/components/ui/card';
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
  MoveRight,
  Expand,
  HardDrive,
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
    capabilities,
    loading,
    error,
    checkAvailability,
    getCapabilities,
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
    setSparse,
    moveDistro,
    resizeDistro,
    getDistroConfig,
    setDistroConfigValue,
    detectDistroEnv,
  } = useWsl();

  const initializedRef = useRef(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [confirmAction, setConfirmAction] = useState<
    | { type: 'unregister' | 'terminate' }
    | { type: 'move'; location: string }
    | { type: 'resize'; size: string }
    | null
  >(null);

  // Initialize on mount
  useEffect(() => {
    if (!isDesktop || initializedRef.current) return;
    initializedRef.current = true;

    const init = async () => {
      const isAvailable = await checkAvailability();
      if (isAvailable) {
        await refreshDistros();
        await refreshStatus();
        await getCapabilities();
      }
    };
    init();
  }, [isDesktop, checkAvailability, getCapabilities, refreshDistros, refreshStatus]);

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

  const handleSetSparse = useCallback(async (enabled: boolean) => {
    try {
      await setSparse(distroName, enabled);
      toast.success(
        enabled
          ? t('wsl.setSparseSuccessEnabled').replace('{name}', distroName)
          : t('wsl.setSparseSuccessDisabled').replace('{name}', distroName)
      );
    } catch (err) {
      toast.error(String(err));
    }
  }, [distroName, setSparse, t]);

  const handleMovePrompt = useCallback(() => {
    const location = window.prompt(t('wsl.moveLocation'));
    if (!location) return;
    setConfirmAction({ type: 'move', location });
  }, [t]);

  const handleResizePrompt = useCallback(() => {
    const size = window.prompt(t('wsl.resizeSize'));
    if (!size) return;
    setConfirmAction({ type: 'resize', size });
  }, [t]);

  const confirmAndExecute = useCallback(async () => {
    if (!confirmAction) return;
    if (confirmAction.type === 'unregister') {
      await handleUnregister();
    } else if (confirmAction.type === 'terminate') {
      await handleTerminate();
    } else if (confirmAction.type === 'move') {
      try {
        const result = await moveDistro(distroName, confirmAction.location);
        toast.success(t('wsl.moveSuccess').replace('{name}', distroName) + (result ? `\n${result}` : ''));
      } catch (err) {
        toast.error(String(err));
      }
    } else if (confirmAction.type === 'resize') {
      try {
        const result = await resizeDistro(distroName, confirmAction.size);
        toast.success(t('wsl.resizeSuccess').replace('{name}', distroName) + (result ? `\n${result}` : ''));
      } catch (err) {
        toast.error(String(err));
      }
    }
    setConfirmAction(null);
  }, [confirmAction, distroName, handleTerminate, handleUnregister, moveDistro, resizeDistro, t]);

  const moveUnsupported = capabilities?.move === false;
  const resizeUnsupported = capabilities?.resize === false;
  const sparseUnsupported = capabilities?.setSparse === false;
  const moveHint = moveUnsupported
    ? t('wsl.capabilityUnsupported')
        .replace('{feature}', t('wsl.move'))
        .replace('{version}', capabilities?.version ?? 'Unknown')
    : undefined;
  const resizeHint = resizeUnsupported
    ? t('wsl.capabilityUnsupported')
        .replace('{feature}', t('wsl.resize'))
        .replace('{version}', capabilities?.version ?? 'Unknown')
    : undefined;
  const sparseHint = sparseUnsupported
    ? t('wsl.capabilityUnsupported')
        .replace('{feature}', t('wsl.setSparse'))
        .replace('{version}', capabilities?.version ?? 'Unknown')
    : undefined;

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

      <Card>
        <CardHeader className="pb-3">
          <h3 className="text-sm font-semibold">{t('wsl.manageOps')}</h3>
          <p className="text-xs text-muted-foreground">{t('wsl.manageOpsDesc')}</p>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            <Button
              variant="outline"
              size="sm"
              className="justify-start gap-1.5"
              onClick={handleMovePrompt}
              disabled={moveUnsupported}
              title={moveHint}
            >
              <MoveRight className="h-3.5 w-3.5" />
              {t('wsl.move')}
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="justify-start gap-1.5"
              onClick={handleResizePrompt}
              disabled={resizeUnsupported}
              title={resizeHint}
            >
              <Expand className="h-3.5 w-3.5" />
              {t('wsl.resize')}
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="justify-start gap-1.5"
              onClick={() => handleSetSparse(true)}
              disabled={sparseUnsupported}
              title={sparseHint}
            >
              <HardDrive className="h-3.5 w-3.5" />
              {t('wsl.setSparseEnable')}
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="justify-start gap-1.5"
              onClick={() => handleSetSparse(false)}
              disabled={sparseUnsupported}
              title={sparseHint}
            >
              <HardDrive className="h-3.5 w-3.5" />
              {t('wsl.setSparseDisable')}
            </Button>
          </div>
          {(moveHint || resizeHint || sparseHint) && (
            <p className="text-xs text-muted-foreground">
              {moveHint ?? resizeHint ?? sparseHint}
            </p>
          )}
        </CardContent>
      </Card>

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
                : confirmAction?.type === 'move'
                  ? t('wsl.move')
                  : confirmAction?.type === 'resize'
                    ? t('wsl.resize')
                    : t('wsl.terminate')}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirmAction?.type === 'unregister'
                ? t('wsl.unregisterConfirm').replace('{name}', distroName)
                : confirmAction?.type === 'move'
                  ? t('wsl.moveConfirm').replace('{name}', distroName)
                  : confirmAction?.type === 'resize'
                    ? t('wsl.resizeConfirm').replace('{name}', distroName)
                    : `${t('wsl.terminate')} ${distroName}?`}
              {confirmAction?.type === 'unregister' && (
                <>
                  <br />
                  <span className="text-destructive font-medium">
                    {t('wsl.dataLossWarning')}
                  </span>
                </>
              )}
              {(confirmAction?.type === 'move' || confirmAction?.type === 'resize') && (
                <>
                  <br />
                  <span className="text-muted-foreground">
                    {t('wsl.highRiskHint')}
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
                  || confirmAction?.type === 'move'
                  || confirmAction?.type === 'resize'
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
