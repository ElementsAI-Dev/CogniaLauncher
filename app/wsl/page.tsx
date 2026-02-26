'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { PageHeader } from '@/components/layout/page-header';
import { useWsl } from '@/hooks/use-wsl';
import { useLocale } from '@/components/providers/locale-provider';
import { isTauri } from '@/lib/tauri';
import {
  WslStatusCard,
  WslDistroCard,
  WslOnlineList,
  WslImportDialog,
  WslExportDialog,
  WslEmptyState,
  WslNotAvailable,
  WslConfigCard,
  WslDistroConfigCard,
  WslExecTerminal,
} from '@/components/wsl';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
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
  AlertCircle,
  Upload,
  RefreshCw,
  ArrowUpCircle,
} from 'lucide-react';
import { toast } from 'sonner';
import type { WslImportOptions, WslMountOptions } from '@/types/tauri';

export default function WslPage() {
  const { t } = useLocale();
  const isDesktop = isTauri();
  const {
    available,
    distros,
    onlineDistros,
    status,
    capabilities,
    loading,
    error,
    checkAvailability,
    refreshDistros,
    refreshOnlineDistros,
    refreshStatus,
    refreshAll,
    terminate,
    shutdown,
    setDefault,
    setVersion,
    setDefaultVersion,
    exportDistro,
    importDistro,
    importInPlace,
    updateWsl,
    launch,
    config,
    execCommand,
    refreshConfig,
    setConfigValue,
    getDiskUsage,
    mountDisk,
    unmountDisk,
    getIpAddress,
    changeDefaultUser,
    getDistroConfig,
    setDistroConfigValue,
    installWslOnly,
  } = useWsl();

  const initializedRef = useRef(false);
  const [activeTab, setActiveTab] = useState<'installed' | 'available'>('installed');
  const [importOpen, setImportOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [exportDistroName, setExportDistroName] = useState('');
  const [confirmAction, setConfirmAction] = useState<
    | { type: 'unregister'; name: string }
    | { type: 'shutdown' }
    | { type: 'mount'; options: WslMountOptions }
    | { type: 'unmount'; diskPath?: string }
    | null
  >(null);
  const [selectedDistroForConfig, setSelectedDistroForConfig] = useState<string | null>(null);

  // Auto-select first distro for per-distro config when distros change
  useEffect(() => {
    if (distros.length > 0 && !selectedDistroForConfig) {
      setSelectedDistroForConfig(distros[0].name);
    } else if (distros.length === 0) {
      setSelectedDistroForConfig(null);
    }
  }, [distros, selectedDistroForConfig]);

  // Initialize on mount
  useEffect(() => {
    if (!isDesktop || initializedRef.current) return;
    initializedRef.current = true;

    const init = async () => {
      const isAvailable = await checkAvailability();
      if (isAvailable) {
        await refreshAll();
      }
    };
    init();
  }, [isDesktop, checkAvailability, refreshAll]);

  const handleRefresh = useCallback(async () => {
    if (activeTab === 'installed') {
      await refreshDistros();
      await refreshStatus();
    } else {
      await refreshOnlineDistros();
    }
  }, [activeTab, refreshDistros, refreshStatus, refreshOnlineDistros]);

  const handleInstallOnline = useCallback(async (name: string) => {
    try {
      const { packageInstall } = await import('@/lib/tauri');
      await packageInstall([`wsl:${name}`]);
      toast.success(t('wsl.installSuccess').replace('{name}', name));
      await refreshDistros();
    } catch (err) {
      toast.error(String(err));
    }
  }, [t, refreshDistros]);

  const handleLaunch = useCallback(async (name: string) => {
    try {
      await launch(name);
      toast.success(`${name} launched`);
    } catch (err) {
      toast.error(String(err));
    }
  }, [launch]);

  const handleTerminate = useCallback(async (name: string) => {
    try {
      await terminate(name);
      toast.success(t('wsl.terminateSuccess').replace('{name}', name));
    } catch (err) {
      toast.error(String(err));
    }
  }, [terminate, t]);

  const handleShutdown = useCallback(async () => {
    try {
      await shutdown();
      toast.success(t('wsl.shutdownSuccess'));
    } catch (err) {
      toast.error(String(err));
    }
  }, [shutdown, t]);

  const handleSetDefault = useCallback(async (name: string) => {
    try {
      await setDefault(name);
      toast.success(t('wsl.setDefaultSuccess').replace('{name}', name));
    } catch (err) {
      toast.error(String(err));
    }
  }, [setDefault, t]);

  const handleSetVersion = useCallback(async (name: string, version: number) => {
    try {
      await setVersion(name, version);
      toast.success(
        t('wsl.setVersionSuccess')
          .replace('{name}', name)
          .replace('{version}', String(version))
      );
    } catch (err) {
      toast.error(String(err));
    }
  }, [setVersion, t]);

  const handleExportOpen = useCallback((name: string) => {
    setExportDistroName(name);
    setExportOpen(true);
  }, []);

  const handleExport = useCallback(async (name: string, filePath: string, asVhd: boolean) => {
    try {
      await exportDistro(name, filePath, asVhd);
      toast.success(t('wsl.exportSuccess').replace('{name}', name));
    } catch (err) {
      toast.error(String(err));
    }
  }, [exportDistro, t]);

  const handleImport = useCallback(async (options: WslImportOptions) => {
    try {
      await importDistro(options);
      toast.success(t('wsl.importSuccess').replace('{name}', options.name));
    } catch (err) {
      toast.error(String(err));
    }
  }, [importDistro, t]);

  const handleInstallWslOnly = useCallback(async () => installWslOnly(), [installWslOnly]);

  const handleSetDefaultVersion = useCallback(async (version: number) => {
    try {
      await setDefaultVersion(version);
      toast.success(t('wsl.setDefaultVersionSuccess').replace('{version}', String(version)));
    } catch (err) {
      toast.error(String(err));
    }
  }, [setDefaultVersion, t]);

  const handleImportInPlacePrompt = useCallback(async () => {
    const name = window.prompt(t('wsl.name'));
    if (!name) return;
    const vhdxPath = window.prompt(t('wsl.vhdxFile'));
    if (!vhdxPath) return;

    try {
      await importInPlace(name, vhdxPath);
      toast.success(t('wsl.importInPlaceSuccess').replace('{name}', name));
      await refreshDistros();
    } catch (err) {
      toast.error(String(err));
    }
  }, [importInPlace, refreshDistros, t]);

  const handleMount = useCallback(async (options: WslMountOptions) => {
    try {
      const result = await mountDisk(options);
      toast.success(t('wsl.mountSuccess') + (result ? `\n${result}` : ''));
    } catch (err) {
      toast.error(String(err));
    }
  }, [mountDisk, t]);

  const handleUnmount = useCallback(async (diskPath?: string) => {
    try {
      await unmountDisk(diskPath);
      toast.success(t('wsl.unmountSuccess'));
    } catch (err) {
      toast.error(String(err));
    }
  }, [t, unmountDisk]);

  const handleMountPrompt = useCallback(() => {
    const diskPath = window.prompt(t('wsl.diskPath'));
    if (!diskPath) return;

    const isVhd = window.confirm(t('wsl.mountAsVhdConfirm'));
    const fsTypeInput = window.prompt(t('wsl.mountFsTypeOptional'))?.trim();
    const partitionInput = window.prompt(t('wsl.mountPartitionOptional'))?.trim();
    const mountName = window.prompt(t('wsl.mountNameOptional'))?.trim();
    const mountOptions =
      capabilities?.mountOptions !== false
        ? window.prompt(t('wsl.mountOptionsOptional'))?.trim()
        : undefined;
    const bare = window.confirm(t('wsl.mountBareConfirm'));

    let partition: number | undefined;
    if (partitionInput) {
      const parsed = Number.parseInt(partitionInput, 10);
      if (Number.isNaN(parsed) || parsed <= 0) {
        toast.error(t('wsl.mountPartitionInvalid'));
        return;
      }
      partition = parsed;
    }

    setConfirmAction({
      type: 'mount',
      options: {
        diskPath,
        isVhd,
        fsType: fsTypeInput || undefined,
        partition,
        mountName: mountName || undefined,
        mountOptions: mountOptions || undefined,
        bare,
      },
    });
  }, [capabilities?.mountOptions, t]);

  const handleUnmountPrompt = useCallback(() => {
    const diskPath = window.prompt(t('wsl.diskPathOptional'))?.trim();
    setConfirmAction({ type: 'unmount', diskPath: diskPath || undefined });
  }, [t]);

  const handleUnregister = useCallback(async (name: string) => {
    try {
      const { packageUninstall } = await import('@/lib/tauri');
      await packageUninstall([`wsl:${name}`]);
      toast.success(t('wsl.unregisterSuccess').replace('{name}', name));
      await refreshDistros();
    } catch (err) {
      toast.error(String(err));
    }
  }, [t, refreshDistros]);

  const handleChangeDefaultUser = useCallback(async (name: string) => {
    const username = window.prompt(t('wsl.username'));
    if (!username) return;
    try {
      await changeDefaultUser(name, username);
      toast.success(
        t('wsl.changeDefaultUserSuccess')
          .replace('{name}', name)
          .replace('{user}', username)
      );
    } catch (err) {
      toast.error(String(err));
    }
  }, [changeDefaultUser, t]);

  const handleUpdate = useCallback(async () => {
    try {
      const result = await updateWsl();
      toast.success(t('wsl.updateSuccess') + (result ? `\n${result}` : ''));
    } catch (err) {
      toast.error(String(err));
    }
  }, [updateWsl, t]);

  const confirmAndExecute = useCallback(async () => {
    if (!confirmAction) return;
    if (confirmAction.type === 'unregister') {
      await handleUnregister(confirmAction.name);
    } else if (confirmAction.type === 'shutdown') {
      await handleShutdown();
    } else if (confirmAction.type === 'mount') {
      await handleMount(confirmAction.options);
    } else if (confirmAction.type === 'unmount') {
      await handleUnmount(confirmAction.diskPath);
    }
    setConfirmAction(null);
  }, [confirmAction, handleMount, handleShutdown, handleUnmount, handleUnregister]);

  const importInPlaceUnsupported = capabilities?.importInPlace === false;
  const importInPlaceHint = importInPlaceUnsupported
    ? t('wsl.capabilityUnsupported')
        .replace('{feature}', t('wsl.importInPlace'))
        .replace('{version}', capabilities?.version ?? 'Unknown')
    : null;

  // Non-Tauri fallback
  if (!isDesktop) {
    return (
      <div className="p-4 md:p-6">
        <PageHeader title={t('wsl.title')} description={t('wsl.description')} />
        <Alert className="mt-4">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{t('wsl.notAvailable')}</AlertDescription>
        </Alert>
      </div>
    );
  }

  // Availability check
  if (available === false) {
    return (
      <div className="p-4 md:p-6 space-y-6">
        <PageHeader title={t('wsl.title')} description={t('wsl.description')} />
        <WslNotAvailable t={t} onInstallWsl={handleInstallWslOnly} />
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-6">
      <PageHeader
        title={t('wsl.title')}
        description={t('wsl.description')}
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handleUpdate} className="gap-2">
              <ArrowUpCircle className="h-4 w-4" />
              {t('wsl.update')}
            </Button>
            <Button variant="outline" size="sm" onClick={() => setImportOpen(true)} className="gap-2">
              <Upload className="h-4 w-4" />
              {t('wsl.import')}
            </Button>
            <Button variant="ghost" size="icon" onClick={handleRefresh} disabled={loading} className="h-8 w-8">
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        }
      />

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Loading skeleton when not yet loaded */}
      {available === null && (
        <div className="grid gap-4 md:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Card key={i}>
              <CardHeader><Skeleton className="h-6 w-32" /></CardHeader>
              <CardContent><Skeleton className="h-16 w-full" /></CardContent>
            </Card>
          ))}
        </div>
      )}

      {available && (
        <div className="grid gap-6 lg:grid-cols-[1fr_350px]">
          {/* Main content */}
          <div className="space-y-4">
            <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'installed' | 'available')}>
              <TabsList>
                <TabsTrigger value="installed">
                  {t('wsl.installed')} ({distros.length})
                </TabsTrigger>
                <TabsTrigger value="available">
                  {t('wsl.available')} ({onlineDistros.length})
                </TabsTrigger>
              </TabsList>

              <TabsContent value="installed" className="space-y-3 mt-4">
                {loading && distros.length === 0 ? (
                  <div className="space-y-3">
                    {[1, 2, 3].map((i) => (
                      <Card key={i}>
                        <CardContent className="p-4">
                          <div className="flex items-center gap-3">
                            <Skeleton className="h-10 w-10 rounded-lg" />
                            <div className="space-y-2">
                              <Skeleton className="h-5 w-28" />
                              <Skeleton className="h-4 w-36" />
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                ) : distros.length === 0 ? (
                  <WslEmptyState t={t} />
                ) : (
                  distros.map((distro) => (
                    <WslDistroCard
                      key={distro.name}
                      distro={distro}
                      onLaunch={handleLaunch}
                      onTerminate={handleTerminate}
                      onSetDefault={handleSetDefault}
                      onSetVersion={handleSetVersion}
                      onExport={handleExportOpen}
                      onUnregister={(name) =>
                        setConfirmAction({ type: 'unregister', name })
                      }
                      onChangeDefaultUser={handleChangeDefaultUser}
                      getDiskUsage={getDiskUsage}
                      t={t}
                    />
                  ))
                )}
              </TabsContent>

              <TabsContent value="available" className="mt-4">
                <WslOnlineList
                  distros={onlineDistros}
                  installedNames={distros.map((d) => d.name)}
                  loading={loading}
                  onInstall={handleInstallOnline}
                  t={t}
                />
              </TabsContent>
            </Tabs>

            {distros.length > 0 && (
              <WslExecTerminal
                distros={distros}
                onExec={execCommand}
                t={t}
              />
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-4">
            <WslStatusCard
              status={status}
              loading={loading}
              onRefresh={() => refreshStatus()}
              onShutdownAll={() => setConfirmAction({ type: 'shutdown' })}
              getIpAddress={() => getIpAddress()}
              t={t}
            />
            <Card>
              <CardHeader className="pb-3">
                <h3 className="text-sm font-semibold">{t('wsl.advancedOps')}</h3>
                <p className="text-xs text-muted-foreground">{t('wsl.advancedOpsDesc')}</p>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleSetDefaultVersion(1)}
                  >
                    {t('wsl.defaultVersion')} 1
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleSetDefaultVersion(2)}
                  >
                    {t('wsl.defaultVersion')} 2
                  </Button>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full justify-start"
                  onClick={handleImportInPlacePrompt}
                  disabled={importInPlaceUnsupported}
                  title={importInPlaceHint ?? undefined}
                >
                  {t('wsl.importInPlace')}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full justify-start"
                  onClick={handleMountPrompt}
                >
                  {t('wsl.mount')}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full justify-start"
                  onClick={handleUnmountPrompt}
                >
                  {t('wsl.unmount')}
                </Button>
                {importInPlaceHint && (
                  <p className="text-xs text-muted-foreground">{importInPlaceHint}</p>
                )}
                {capabilities?.mountOptions === false && (
                  <p className="text-xs text-muted-foreground">
                    {t('wsl.mountOptionsFallback')}
                  </p>
                )}
              </CardContent>
            </Card>
            <WslConfigCard
              config={config}
              loading={loading}
              onRefresh={refreshConfig}
              onSetConfig={setConfigValue}
              t={t}
            />
            {selectedDistroForConfig && (
              <WslDistroConfigCard
                distroName={selectedDistroForConfig}
                getDistroConfig={getDistroConfig}
                setDistroConfigValue={setDistroConfigValue}
                t={t}
              />
            )}
          </div>
        </div>
      )}

      {/* Import Dialog */}
      <WslImportDialog
        open={importOpen}
        onOpenChange={setImportOpen}
        onImport={handleImport}
        t={t}
      />

      {/* Export Dialog */}
      <WslExportDialog
        open={exportOpen}
        distroName={exportDistroName}
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
                  : confirmAction?.type === 'mount'
                    ? t('wsl.mount')
                    : confirmAction?.type === 'unmount'
                      ? t('wsl.unmount')
                      : t('wsl.shutdown')}
              </AlertDialogTitle>
              <AlertDialogDescription>
                {confirmAction?.type === 'unregister'
                  ? t('wsl.unregisterConfirm').replace(
                      '{name}',
                      confirmAction.name ?? ''
                    )
                  : confirmAction?.type === 'mount'
                    ? t('wsl.mountConfirm')
                    : confirmAction?.type === 'unmount'
                      ? confirmAction.diskPath
                        ? t('wsl.unmountConfirm').replace('{path}', confirmAction.diskPath)
                        : t('wsl.unmountAllConfirm')
                      : t('wsl.shutdownConfirm')}
                {confirmAction?.type === 'unregister' && (
                  <>
                    <br />
                    <span className="text-destructive font-medium">
                      {t('wsl.dataLossWarning')}
                    </span>
                  </>
                )}
                {(confirmAction?.type === 'mount'
                  || confirmAction?.type === 'unmount'
                  || confirmAction?.type === 'shutdown') && (
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
