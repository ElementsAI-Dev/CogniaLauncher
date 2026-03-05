'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { PageHeader } from '@/components/layout/page-header';
import { useWsl } from '@/hooks/use-wsl';
import { useLocale } from '@/components/providers/locale-provider';
import { isTauri } from '@/lib/tauri';
import { useWslStore } from '@/lib/stores/wsl';
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
  WslChangeUserDialog,
  WslMountDialog,
  WslImportInPlaceDialog,
  WslInstallLocationDialog,
  WslCloneDialog,
  WslBackupCard,
} from '@/components/wsl';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
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
  Info,
  HardDrive,
} from 'lucide-react';
import { toast } from 'sonner';
import { formatBytes } from '@/lib/utils';
import type { WslImportOptions, WslMountOptions, WslTotalDiskUsage, WslVersionInfo } from '@/types/tauri';

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
    listUsers,
    installOnlineDistro,
    unregisterDistro,
    installWithLocation,
    getVersionInfo,
    getTotalDiskUsage,
    openInExplorer,
    openInTerminal,
    cloneDistro,
    batchLaunch,
    batchTerminate,
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
  const [changeUserOpen, setChangeUserOpen] = useState(false);
  const [changeUserDistro, setChangeUserDistro] = useState('');
  const [mountDialogOpen, setMountDialogOpen] = useState(false);
  const [importInPlaceOpen, setImportInPlaceOpen] = useState(false);
  const [installLocationDialogOpen, setInstallLocationDialogOpen] = useState(false);
  const [installLocationDistroName, setInstallLocationDistroName] = useState('');
  const [cloneDialogOpen, setCloneDialogOpen] = useState(false);
  const [cloneSourceDistro, setCloneSourceDistro] = useState('');
  const [versionInfo, setVersionInfo] = useState<WslVersionInfo | null>(null);
  const [totalDiskUsage, setTotalDiskUsage] = useState<WslTotalDiskUsage | null>(null);
  const [sidebarMetaLoading, setSidebarMetaLoading] = useState(false);
  const [activeTagFilter, setActiveTagFilter] = useState<string | null>(null);
  const [selectedDistros, setSelectedDistros] = useState<Set<string>>(new Set());
  const { distroTags, availableTags } = useWslStore();

  const filteredDistros = activeTagFilter
    ? distros.filter((d) => (distroTags[d.name] ?? []).includes(activeTagFilter))
    : distros;

  const refreshSidebarMeta = useCallback(async () => {
    if (!isDesktop) return;
    setSidebarMetaLoading(true);
    try {
      const [version, totalUsage] = await Promise.all([
        getVersionInfo(),
        getTotalDiskUsage(),
      ]);
      setVersionInfo(version);
      setTotalDiskUsage(totalUsage);
    } finally {
      setSidebarMetaLoading(false);
    }
  }, [getTotalDiskUsage, getVersionInfo, isDesktop]);

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
        await Promise.all([refreshAll(), refreshSidebarMeta()]);
      }
    };
    init();
  }, [isDesktop, checkAvailability, refreshAll, refreshSidebarMeta]);

  const handleRefresh = useCallback(async () => {
    if (activeTab === 'installed') {
      await Promise.all([refreshDistros(), refreshStatus(), refreshSidebarMeta()]);
    } else {
      await refreshOnlineDistros();
    }
  }, [activeTab, refreshDistros, refreshStatus, refreshOnlineDistros, refreshSidebarMeta]);

  const handleInstallOnline = useCallback(async (name: string) => {
    try {
      await installOnlineDistro(name);
      toast.success(t('wsl.installSuccess').replace('{name}', name));
      await refreshSidebarMeta();
    } catch (err) {
      toast.error(String(err));
    }
  }, [installOnlineDistro, refreshSidebarMeta, t]);

  const handleOpenInstallWithLocation = useCallback((name: string) => {
    setInstallLocationDistroName(name);
    setInstallLocationDialogOpen(true);
  }, []);

  const handleInstallWithLocation = useCallback(async (name: string, location: string) => {
    try {
      await installWithLocation(name, location);
      toast.success(t('wsl.installWithLocationSuccess').replace('{name}', name));
      await refreshSidebarMeta();
    } catch (err) {
      toast.error(String(err));
    }
  }, [installWithLocation, refreshSidebarMeta, t]);

  const handleLaunch = useCallback(async (name: string) => {
    try {
      await launch(name);
      toast.success(t('wsl.launchSuccess').replace('{name}', name));
    } catch (err) {
      toast.error(String(err));
    }
  }, [launch, t]);

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
      await refreshSidebarMeta();
    } catch (err) {
      toast.error(String(err));
    }
  }, [importDistro, refreshSidebarMeta, t]);

  const handleInstallWslOnly = useCallback(async () => {
    const result = await installWslOnly();
    const nowAvailable = await checkAvailability();
    if (nowAvailable) {
      await Promise.all([refreshAll(), refreshSidebarMeta()]);
    }
    return result;
  }, [checkAvailability, installWslOnly, refreshAll, refreshSidebarMeta]);

  const handleSetDefaultVersion = useCallback(async (version: number) => {
    try {
      await setDefaultVersion(version);
      toast.success(t('wsl.setDefaultVersionSuccess').replace('{version}', String(version)));
    } catch (err) {
      toast.error(String(err));
    }
  }, [setDefaultVersion, t]);

  const handleImportInPlaceConfirm = useCallback(async (name: string, vhdxPath: string) => {
    try {
      await importInPlace(name, vhdxPath);
      toast.success(t('wsl.importInPlaceSuccess').replace('{name}', name));
      await refreshSidebarMeta();
    } catch (err) {
      toast.error(String(err));
    }
  }, [importInPlace, refreshSidebarMeta, t]);

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

  const handleMountConfirm = useCallback(async (options: WslMountOptions) => {
    setConfirmAction({ type: 'mount', options });
    return '';
  }, []);

  const handleUnmountPrompt = useCallback(() => {
    // For unmount, a simple confirm dialog is sufficient since it's just an optional path
    setConfirmAction({ type: 'unmount', diskPath: undefined });
  }, []);

  const handleUnregister = useCallback(async (name: string) => {
    try {
      await unregisterDistro(name);
      toast.success(t('wsl.unregisterSuccess').replace('{name}', name));
      await refreshSidebarMeta();
    } catch (err) {
      toast.error(String(err));
    }
  }, [refreshSidebarMeta, t, unregisterDistro]);

  const handleChangeDefaultUserOpen = useCallback((name: string) => {
    setChangeUserDistro(name);
    setChangeUserOpen(true);
  }, []);

  const handleChangeDefaultUserConfirm = useCallback(async (distro: string, username: string) => {
    try {
      await changeDefaultUser(distro, username);
      toast.success(
        t('wsl.changeDefaultUserSuccess')
          .replace('{name}', distro)
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
      await refreshSidebarMeta();
    } catch (err) {
      toast.error(String(err));
    }
  }, [refreshSidebarMeta, updateWsl, t]);

  const handleOpenInExplorer = useCallback(async (name: string) => {
    try {
      await openInExplorer(name);
      toast.success(t('wsl.openInExplorer'));
    } catch (err) {
      toast.error(String(err));
    }
  }, [openInExplorer, t]);

  const handleOpenInTerminal = useCallback(async (name: string) => {
    try {
      await openInTerminal(name);
      toast.success(t('wsl.openInTerminal'));
    } catch (err) {
      toast.error(String(err));
    }
  }, [openInTerminal, t]);

  const handleCloneOpen = useCallback((name: string) => {
    setCloneSourceDistro(name);
    setCloneDialogOpen(true);
  }, []);

  const handleCloneConfirm = useCallback(async (name: string, newName: string, location: string) => {
    try {
      const result = await cloneDistro(name, newName, location);
      toast.success(t('wsl.cloneSuccess').replace('{name}', newName) + (result ? `\n${result}` : ''));
      await refreshSidebarMeta();
    } catch (err) {
      toast.error(String(err));
    }
  }, [cloneDistro, refreshSidebarMeta, t]);

  const handleBatchLaunch = useCallback(async () => {
    if (selectedDistros.size === 0) return;
    try {
      const results = await batchLaunch(Array.from(selectedDistros));
      const failed = results.filter(([, ok]) => !ok);
      if (failed.length === 0) {
        toast.success(t('wsl.batch.launchSuccess').replace('{count}', String(results.length)));
      } else {
        toast.warning(t('wsl.batch.partialFail').replace('{failed}', String(failed.length)).replace('{total}', String(results.length)));
      }
      setSelectedDistros(new Set());
    } catch (err) {
      toast.error(String(err));
    }
  }, [batchLaunch, selectedDistros, t]);

  const handleBatchTerminate = useCallback(async () => {
    if (selectedDistros.size === 0) return;
    try {
      const results = await batchTerminate(Array.from(selectedDistros));
      const failed = results.filter(([, ok]) => !ok);
      if (failed.length === 0) {
        toast.success(t('wsl.batch.terminateSuccess').replace('{count}', String(results.length)));
      } else {
        toast.warning(t('wsl.batch.partialFail').replace('{failed}', String(failed.length)).replace('{total}', String(results.length)));
      }
      setSelectedDistros(new Set());
    } catch (err) {
      toast.error(String(err));
    }
  }, [batchTerminate, selectedDistros, t]);

  const toggleSelectDistro = useCallback((name: string) => {
    setSelectedDistros((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  }, []);

  const toggleSelectAll = useCallback(() => {
    setSelectedDistros((prev) => {
      if (prev.size === filteredDistros.length) return new Set();
      return new Set(filteredDistros.map((d) => d.name));
    });
  }, [filteredDistros]);

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
  const desktopLayoutClass =
    'grid gap-6 xl:gap-8 xl:grid-cols-[minmax(0,1.45fr)_minmax(320px,1fr)] 2xl:grid-cols-[minmax(0,1.55fr)_minmax(340px,1fr)]';

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

  return (
    <div className="p-4 md:p-6 space-y-6">
      <PageHeader
        title={t('wsl.title')}
        description={t('wsl.description')}
        actions={
          <div
            data-testid="wsl-header-actions"
            className="flex flex-wrap items-center justify-end gap-2 sm:flex-nowrap"
          >
            <Button variant="outline" size="sm" onClick={handleUpdate} className="gap-2 whitespace-nowrap">
              <ArrowUpCircle className="h-4 w-4" />
              {t('wsl.update')}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setImportOpen(true)}
              className="gap-2 whitespace-nowrap"
            >
              <Upload className="h-4 w-4" />
              {t('wsl.import')}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleRefresh}
              disabled={loading || available !== true}
              className="h-8 w-8 shrink-0"
            >
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

      <div data-testid="wsl-page-content" className="space-y-6">
        {available === false && (
          <section data-testid="wsl-not-available" className="rounded-xl border border-border/60 bg-card/40 p-4 sm:p-5">
            <WslNotAvailable t={t} onInstallWsl={handleInstallWslOnly} />
          </section>
        )}

        {/* Loading skeleton before WSL availability is resolved */}
        {available === null && (
          <div data-testid="wsl-layout-grid" className={desktopLayoutClass}>
            <section data-testid="wsl-primary-region" className="space-y-4">
              <Card className="border-dashed">
                <CardHeader><Skeleton className="h-6 w-48" /></CardHeader>
                <CardContent className="space-y-3">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="flex items-center gap-3 rounded-md border p-3">
                      <Skeleton className="h-10 w-10 rounded-lg" />
                      <div className="w-full space-y-2">
                        <Skeleton className="h-5 w-28" />
                        <Skeleton className="h-4 w-36" />
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </section>
            <aside data-testid="wsl-supporting-region" className="space-y-4">
              {[1, 2].map((i) => (
                <Card key={i}>
                  <CardHeader><Skeleton className="h-6 w-32" /></CardHeader>
                  <CardContent><Skeleton className="h-20 w-full" /></CardContent>
                </Card>
              ))}
            </aside>
          </div>
        )}

        {available === true && (
          <div data-testid="wsl-layout-grid" className={desktopLayoutClass}>
            {/* Primary workflow region */}
            <section data-testid="wsl-primary-region" className="space-y-5">
              <section
                data-testid="wsl-distro-workflow-section"
                className="rounded-xl border border-border/60 bg-card/40 p-3 sm:p-4"
              >
                <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'installed' | 'available')}>
                  <TabsList>
                    <TabsTrigger value="installed">
                      {t('wsl.installed')} ({distros.length})
                    </TabsTrigger>
                    <TabsTrigger value="available">
                      {t('wsl.available')} ({onlineDistros.length})
                    </TabsTrigger>
                  </TabsList>

                  {distros.length > 0 && availableTags.length > 0 && (
                    <div className="mt-3 flex flex-wrap items-center gap-1.5">
                      <Badge
                        variant={activeTagFilter === null ? 'default' : 'outline'}
                        className="cursor-pointer text-xs"
                        onClick={() => setActiveTagFilter(null)}
                      >
                        {t('wsl.tags.all')}
                      </Badge>
                      {availableTags.map((tag) => (
                        <Badge
                          key={tag}
                          variant={activeTagFilter === tag ? 'default' : 'outline'}
                          className="cursor-pointer text-xs"
                          onClick={() => setActiveTagFilter(activeTagFilter === tag ? null : tag)}
                        >
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  )}

                  <TabsContent value="installed" className="mt-4 space-y-3">
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
                      <>
                        {filteredDistros.length > 1 && (
                          <div className="flex flex-wrap items-center gap-2 pb-1">
                            <Checkbox
                              checked={selectedDistros.size === filteredDistros.length && filteredDistros.length > 0}
                              onCheckedChange={toggleSelectAll}
                            />
                            <span className="text-xs text-muted-foreground">
                              {selectedDistros.size > 0
                                ? `${selectedDistros.size} ${t('wsl.batch.selected')}`
                                : t('wsl.batch.selectAll')}
                            </span>
                            {selectedDistros.size > 0 && (
                              <div className="flex w-full items-center gap-1 sm:ml-auto sm:w-auto">
                                <Button variant="outline" size="sm" className="h-7 flex-1 gap-1 text-xs sm:flex-none" onClick={handleBatchLaunch}>
                                  {t('wsl.batch.launch')}
                                </Button>
                                <Button variant="outline" size="sm" className="h-7 flex-1 gap-1 text-xs sm:flex-none" onClick={handleBatchTerminate}>
                                  {t('wsl.batch.terminate')}
                                </Button>
                              </div>
                            )}
                          </div>
                        )}
                        {filteredDistros.map((distro) => (
                          <div key={distro.name} className="flex items-start gap-2">
                            {filteredDistros.length > 1 && (
                              <Checkbox
                                className="mt-5"
                                checked={selectedDistros.has(distro.name)}
                                onCheckedChange={() => toggleSelectDistro(distro.name)}
                              />
                            )}
                            <div className="min-w-0 flex-1">
                              <WslDistroCard
                                distro={distro}
                                onLaunch={handleLaunch}
                                onTerminate={handleTerminate}
                                onSetDefault={handleSetDefault}
                                onSetVersion={handleSetVersion}
                                onExport={handleExportOpen}
                                onUnregister={(name) =>
                                  setConfirmAction({ type: 'unregister', name })
                                }
                                onChangeDefaultUser={handleChangeDefaultUserOpen}
                                onOpenInExplorer={handleOpenInExplorer}
                                onOpenInTerminal={handleOpenInTerminal}
                                onClone={handleCloneOpen}
                                getDiskUsage={getDiskUsage}
                                t={t}
                              />
                            </div>
                          </div>
                        ))}
                      </>
                    )}
                  </TabsContent>

                  <TabsContent value="available" className="mt-4">
                    <WslOnlineList
                      distros={onlineDistros}
                      installedNames={distros.map((d) => d.name)}
                      loading={loading}
                      onInstall={handleInstallOnline}
                      onInstallWithLocation={handleOpenInstallWithLocation}
                      t={t}
                    />
                  </TabsContent>
                </Tabs>
              </section>

              {distros.length > 0 && (
                <section
                  data-testid="wsl-terminal-workflow-section"
                  className="rounded-xl border border-border/60 bg-card/40 p-3 sm:p-4"
                >
                  <WslExecTerminal
                    distros={distros}
                    onExec={execCommand}
                    t={t}
                  />
                </section>
              )}
            </section>

            {/* Supporting region */}
            <aside data-testid="wsl-supporting-region" className="space-y-5">
              <section data-testid="wsl-runtime-support-section" className="space-y-4">
                <WslStatusCard
                  status={status}
                  loading={loading}
                  onRefresh={() => refreshStatus()}
                  onShutdownAll={() => setConfirmAction({ type: 'shutdown' })}
                  getIpAddress={() => getIpAddress()}
                  config={config}
                  t={t}
                />
                <Card>
                  <CardHeader className="pb-3">
                    <h3 className="flex items-center gap-2 text-sm font-semibold">
                      <Info className="h-4 w-4" />
                      {t('wsl.versionInfo')}
                    </h3>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">{t('wsl.wslVersion')}</span>
                      <span className="font-mono">{versionInfo?.wslVersion ?? status?.version ?? '—'}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">{t('wsl.kernelVersion')}</span>
                      <span className="font-mono">{versionInfo?.kernelVersion ?? status?.kernelVersion ?? '—'}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">{t('wsl.wslgVersion')}</span>
                      <span className="font-mono">{versionInfo?.wslgVersion ?? status?.wslgVersion ?? '—'}</span>
                    </div>
                    <Separator />
                    <div className="flex items-center justify-between text-sm">
                      <span className="flex items-center gap-1.5 text-muted-foreground">
                        <HardDrive className="h-3.5 w-3.5" />
                        {t('wsl.totalDiskUsage')}
                      </span>
                      <span className="font-mono">
                        {totalDiskUsage ? formatBytes(totalDiskUsage.totalBytes) : '—'}
                      </span>
                    </div>
                    {totalDiskUsage && totalDiskUsage.perDistro.length > 0 && (
                      <div className="space-y-1">
                        {totalDiskUsage.perDistro.slice(0, 3).map(([name, bytes]) => (
                          <div key={name} className="flex items-center justify-between text-xs">
                            <span className="truncate text-muted-foreground">{name}</span>
                            <span className="font-mono">{formatBytes(bytes)}</span>
                          </div>
                        ))}
                      </div>
                    )}
                    {sidebarMetaLoading && (
                      <p className="text-xs text-muted-foreground">{t('common.loading')}</p>
                    )}
                  </CardContent>
                </Card>
              </section>

              <section data-testid="wsl-operations-support-section" className="space-y-4">
                <Card>
                  <CardHeader className="pb-3">
                    <h3 className="text-sm font-semibold">{t('wsl.advancedOps')}</h3>
                    <p className="text-xs text-muted-foreground">{t('wsl.advancedOpsDesc')}</p>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="justify-center whitespace-nowrap"
                        onClick={() => handleSetDefaultVersion(1)}
                      >
                        {t('wsl.defaultVersion')} 1
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="justify-center whitespace-nowrap"
                        onClick={() => handleSetDefaultVersion(2)}
                      >
                        {t('wsl.defaultVersion')} 2
                      </Button>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full justify-start"
                      onClick={() => setImportInPlaceOpen(true)}
                      disabled={importInPlaceUnsupported}
                      title={importInPlaceHint ?? undefined}
                    >
                      {t('wsl.importInPlace')}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full justify-start"
                      onClick={() => setMountDialogOpen(true)}
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
                <WslBackupCard
                  distroNames={distros.map((d) => d.name)}
                  t={t}
                />
              </section>

              <section data-testid="wsl-config-support-section" className="space-y-4">
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
              </section>
            </aside>
          </div>
        )}
      </div>

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

      {/* Change Default User Dialog */}
      <WslChangeUserDialog
        open={changeUserOpen}
        distroName={changeUserDistro}
        onOpenChange={setChangeUserOpen}
        onConfirm={handleChangeDefaultUserConfirm}
        listUsers={listUsers}
        t={t}
      />

      {/* Mount Disk Dialog */}
      <WslMountDialog
        open={mountDialogOpen}
        onOpenChange={setMountDialogOpen}
        capabilities={capabilities}
        onConfirm={handleMountConfirm}
        t={t}
      />

      {/* Import In-Place Dialog */}
      <WslImportInPlaceDialog
        open={importInPlaceOpen}
        onOpenChange={setImportInPlaceOpen}
        onConfirm={handleImportInPlaceConfirm}
        t={t}
      />

      {/* Install with Location Dialog */}
      <WslInstallLocationDialog
        open={installLocationDialogOpen}
        distroName={installLocationDistroName}
        onOpenChange={setInstallLocationDialogOpen}
        onConfirm={handleInstallWithLocation}
        t={t}
      />

      {/* Clone Dialog */}
      <WslCloneDialog
        open={cloneDialogOpen}
        distroName={cloneSourceDistro}
        onOpenChange={setCloneDialogOpen}
        onConfirm={handleCloneConfirm}
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
