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
import type { WslImportOptions } from '@/types/tauri';

export default function WslPage() {
  const { t } = useLocale();
  const isDesktop = isTauri();
  const {
    available,
    distros,
    onlineDistros,
    status,
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
    exportDistro,
    importDistro,
    updateWsl,
    launch,
    config,
    execCommand,
    refreshConfig,
    setConfigValue,
  } = useWsl();

  const initializedRef = useRef(false);
  const [activeTab, setActiveTab] = useState<'installed' | 'available'>('installed');
  const [importOpen, setImportOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [exportDistroName, setExportDistroName] = useState('');
  const [confirmAction, setConfirmAction] = useState<{
    type: 'unregister' | 'shutdown';
    name?: string;
  } | null>(null);

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
    if (confirmAction.type === 'unregister' && confirmAction.name) {
      await handleUnregister(confirmAction.name);
    } else if (confirmAction.type === 'shutdown') {
      await handleShutdown();
    }
    setConfirmAction(null);
  }, [confirmAction, handleUnregister, handleShutdown]);

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
        <WslNotAvailable t={t} />
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
              t={t}
            />
            <WslConfigCard
              config={config}
              loading={loading}
              onRefresh={refreshConfig}
              onSetConfig={setConfigValue}
              t={t}
            />
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
                : t('wsl.shutdown')}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirmAction?.type === 'unregister'
                ? t('wsl.unregisterConfirm').replace(
                    '{name}',
                    confirmAction.name ?? ''
                  )
                : t('wsl.shutdownConfirm')}
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
