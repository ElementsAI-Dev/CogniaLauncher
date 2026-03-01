'use client';

import { useState, useCallback, useEffect } from 'react';
import { PageHeader } from '@/components/layout/page-header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
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
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { DestinationPicker } from '@/components/downloads/destination-picker';
import { usePlugins } from '@/hooks/use-plugins';
import { useLocale } from '@/components/providers/locale-provider';
import { isTauri } from '@/lib/tauri';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Plus,
  Trash2,
  RefreshCw,
  ArrowLeft,
  Plug,
  Shield,
  Package,
  Hammer,
  Info,
  ArrowUpCircle,
  Heart,
  Settings2,
  Download,
  AlertTriangle,
} from 'lucide-react';
import Link from 'next/link';
import type { PluginInfo, PluginPermissionState, PluginLanguage, ScaffoldConfig, PluginUpdateInfo, PluginHealth, PluginSettingDeclaration } from '@/types/plugin';

export default function PluginsPage() {
  const { t, locale } = useLocale();
  const isDesktop = isTauri();
  const {
    plugins,
    pluginTools,
    loading,
    fetchPlugins,
    installPlugin,
    importLocalPlugin,
    uninstallPlugin,
    enablePlugin,
    disablePlugin,
    reloadPlugin,
    getPermissions,
    grantPermission,
    revokePermission,
    scaffoldPlugin,
    checkUpdate,
    updatePlugin,
    getHealth,
    resetHealth,
    getSettingsSchema,
    getSettingsValues,
    setSetting,
    exportData,
    checkAllUpdates,
    updateAll,
    pendingUpdates,
  } = usePlugins();

  const [installDialogOpen, setInstallDialogOpen] = useState(false);
  const [installSource, setInstallSource] = useState('');
  const [installing, setInstalling] = useState(false);
  const [permDialogPlugin, setPermDialogPlugin] = useState<string | null>(null);
  const [permState, setPermState] = useState<PluginPermissionState | null>(null);
  const [detailPlugin, setDetailPlugin] = useState<PluginInfo | null>(null);
  const [uninstallTarget, setUninstallTarget] = useState<PluginInfo | null>(null);
  const [scaffoldOpen, setScaffoldOpen] = useState(false);
  const [scaffolding, setScaffolding] = useState(false);
  const [importPath, setImportPath] = useState('');
  const [importingLocal, setImportingLocal] = useState(false);
  const [updateInfo, setUpdateInfo] = useState<Record<string, PluginUpdateInfo | null>>({});
  const [updatingPlugin, setUpdatingPlugin] = useState<string | null>(null);
  const [updateConfirmPlugin, setUpdateConfirmPlugin] = useState<string | null>(null);
  const [healthDialogPlugin, setHealthDialogPlugin] = useState<string | null>(null);
  const [healthData, setHealthData] = useState<PluginHealth | null>(null);
  const [settingsDialogPlugin, setSettingsDialogPlugin] = useState<string | null>(null);
  const [settingsSchema, setSettingsSchema] = useState<PluginSettingDeclaration[]>([]);
  const [settingsValues, setSettingsValues] = useState<Record<string, unknown>>({});
  const [scaffoldForm, setScaffoldForm] = useState({
    name: '', id: '', description: '', author: '', outputDir: '',
    language: 'typescript' as PluginLanguage,
    permConfigRead: true, permEnvRead: true, permPkgSearch: false,
    permClipboard: false, permNotification: false, permProcessExec: false,
    permFsRead: false, permFsWrite: false,
  });

  useEffect(() => {
    if (isDesktop) fetchPlugins();
  }, [isDesktop, fetchPlugins]);

  const handleInstall = useCallback(async () => {
    if (!installSource.trim()) return;
    setInstalling(true);
    try {
      await installPlugin(installSource.trim());
      setInstallDialogOpen(false);
      setInstallSource('');
    } finally {
      setInstalling(false);
    }
  }, [installSource, installPlugin]);

  const handleImportLocal = useCallback(async () => {
    if (!importPath.trim()) return;
    setImportingLocal(true);
    try {
      await importLocalPlugin(importPath.trim());
      setInstallDialogOpen(false);
      setImportPath('');
    } finally {
      setImportingLocal(false);
    }
  }, [importPath, importLocalPlugin]);

  const handleCheckUpdate = useCallback(async (plugin: PluginInfo) => {
    const info = await checkUpdate(plugin.id);
    setUpdateInfo((prev) => ({ ...prev, [plugin.id]: info }));
    if (!info) {
      const { toast } = await import('sonner');
      toast.info(t('toolbox.plugin.noUpdate'));
    }
  }, [checkUpdate, t]);

  const handleConfirmUpdate = useCallback((pluginId: string) => {
    setUpdateConfirmPlugin(pluginId);
  }, []);

  const handleUpdate = useCallback(async (pluginId: string) => {
    setUpdateConfirmPlugin(null);
    setUpdatingPlugin(pluginId);
    try {
      await updatePlugin(pluginId);
      setUpdateInfo((prev) => ({ ...prev, [pluginId]: null }));
    } finally {
      setUpdatingPlugin(null);
    }
  }, [updatePlugin]);

  const handleScaffold = useCallback(async () => {
    if (!scaffoldForm.name.trim() || !scaffoldForm.id.trim() || !scaffoldForm.outputDir.trim()) return;
    setScaffolding(true);
    try {
      const config: ScaffoldConfig = {
        name: scaffoldForm.name.trim(),
        id: scaffoldForm.id.trim(),
        description: scaffoldForm.description.trim(),
        author: scaffoldForm.author.trim(),
        outputDir: scaffoldForm.outputDir.trim(),
        language: scaffoldForm.language,
        permissions: {
          configRead: scaffoldForm.permConfigRead,
          envRead: scaffoldForm.permEnvRead,
          pkgSearch: scaffoldForm.permPkgSearch,
          clipboard: scaffoldForm.permClipboard,
          notification: scaffoldForm.permNotification,
          processExec: scaffoldForm.permProcessExec,
          fsRead: scaffoldForm.permFsRead,
          fsWrite: scaffoldForm.permFsWrite,
          http: [],
        },
      };
      await scaffoldPlugin(config);
      setScaffoldOpen(false);
    } finally {
      setScaffolding(false);
    }
  }, [scaffoldForm, scaffoldPlugin]);

  const handleOpenPermissions = useCallback(async (pluginId: string) => {
    setPermDialogPlugin(pluginId);
    const perms = await getPermissions(pluginId);
    setPermState(perms);
  }, [getPermissions]);

  const handleTogglePermission = useCallback(async (permission: string, granted: boolean) => {
    if (!permDialogPlugin) return;
    if (granted) {
      await revokePermission(permDialogPlugin, permission);
    } else {
      await grantPermission(permDialogPlugin, permission);
    }
    const perms = await getPermissions(permDialogPlugin);
    setPermState(perms);
  }, [permDialogPlugin, grantPermission, revokePermission, getPermissions]);

  const handleOpenHealth = useCallback(async (pluginId: string) => {
    setHealthDialogPlugin(pluginId);
    const data = await getHealth(pluginId);
    setHealthData(data);
  }, [getHealth]);

  const handleResetHealth = useCallback(async () => {
    if (!healthDialogPlugin) return;
    await resetHealth(healthDialogPlugin);
    const data = await getHealth(healthDialogPlugin);
    setHealthData(data);
  }, [healthDialogPlugin, resetHealth, getHealth]);

  const handleOpenSettings = useCallback(async (pluginId: string) => {
    setSettingsDialogPlugin(pluginId);
    const [schema, values] = await Promise.all([
      getSettingsSchema(pluginId),
      getSettingsValues(pluginId),
    ]);
    setSettingsSchema(schema ?? []);
    setSettingsValues(values ?? {});
  }, [getSettingsSchema, getSettingsValues]);

  const handleSetSetting = useCallback(async (key: string, value: unknown) => {
    if (!settingsDialogPlugin) return;
    await setSetting(settingsDialogPlugin, key, value);
    setSettingsValues((prev) => ({ ...prev, [key]: value }));
    const { toast: toastFn } = await import('sonner');
    toastFn.success(t('toolbox.plugin.pluginSettingsSaved'));
  }, [settingsDialogPlugin, setSetting, t]);

  const handleExport = useCallback(async (pluginId: string) => {
    await exportData(pluginId);
  }, [exportData]);

  const handleCheckAllUpdates = useCallback(async () => {
    const updates = await checkAllUpdates();
    if (updates.length === 0) {
      const { toast: toastFn } = await import('sonner');
      toastFn.info(t('toolbox.plugin.noUpdatesAvailable'));
    }
  }, [checkAllUpdates, t]);

  const handleUpdateAll = useCallback(async () => {
    await updateAll();
    setUpdateInfo({});
  }, [updateAll]);

  const getHealthStatus = useCallback((plugin: PluginInfo): 'good' | 'warning' | 'critical' => {
    if (!plugin.enabled) return 'good';
    // We don't have health data in plugin list, so default to good
    return 'good';
  }, []);

  if (!isDesktop) {
    return (
      <div className="p-4 md:p-6 space-y-6">
        <PageHeader title={t('toolbox.plugin.title')} />
        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
          <Plug className="h-12 w-12 mb-4 opacity-40" />
          <p>{t('toolbox.plugin.noPlugins')}</p>
          <p className="text-sm mt-1">{t('toolbox.plugin.noPluginsDesc')}</p>
        </div>
      </div>
    );
  }

  const PERM_LABELS: Record<string, string> = {
    config_read: t('toolbox.plugin.permConfigRead'),
    config_write: t('toolbox.plugin.permConfigWrite'),
    env_read: t('toolbox.plugin.permEnvRead'),
    pkg_search: t('toolbox.plugin.permPkgSearch'),
    pkg_install: t('toolbox.plugin.permPkgInstall'),
    clipboard: t('toolbox.plugin.permClipboard'),
    notification: t('toolbox.plugin.permNotification'),
    fs_read: t('toolbox.plugin.permFsRead'),
    fs_write: t('toolbox.plugin.permFsWrite'),
    http: t('toolbox.plugin.permHttp'),
    process_exec: t('toolbox.plugin.permProcessExec'),
  };

  return (
    <div className="p-4 md:p-6 space-y-6">
      <PageHeader
        title={t('toolbox.plugin.title')}
        description={t('toolbox.plugin.description')}
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" className="gap-1.5" asChild>
              <Link href="/toolbox">
                <ArrowLeft className="h-3.5 w-3.5" />
                {t('toolbox.actions.backToToolbox')}
              </Link>
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={() => fetchPlugins()}
              disabled={loading}
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
              {t('common.refresh')}
            </Button>
            <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setScaffoldOpen(true)}>
              <Hammer className="h-3.5 w-3.5" />
              {t('toolbox.plugin.createPlugin')}
            </Button>
            {plugins.length > 0 && (
              <Button variant="outline" size="sm" className="gap-1.5" onClick={handleCheckAllUpdates} disabled={loading}>
                <ArrowUpCircle className="h-3.5 w-3.5" />
                {t('toolbox.plugin.checkAllUpdates')}
              </Button>
            )}
            <Button size="sm" className="gap-1.5" onClick={() => setInstallDialogOpen(true)}>
              <Plus className="h-3.5 w-3.5" />
              {t('toolbox.plugin.install')}
            </Button>
          </div>
        }
      />

      {pendingUpdates.length > 0 && (
        <div className="flex items-center justify-between rounded-lg border border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-950/50 p-3">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-blue-600 dark:text-blue-400" />
            <span className="text-sm font-medium text-blue-700 dark:text-blue-300">
              {t('toolbox.plugin.updatesAvailable', { count: pendingUpdates.length })}
            </span>
          </div>
          <Button size="sm" className="gap-1.5" onClick={handleUpdateAll} disabled={loading}>
            <ArrowUpCircle className="h-3.5 w-3.5" />
            {t('toolbox.plugin.updateAll')}
          </Button>
        </div>
      )}

      {plugins.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
          <Package className="h-12 w-12 mb-4 opacity-40" />
          <h3 className="text-lg font-medium">{t('toolbox.plugin.noPlugins')}</h3>
          <p className="text-sm mt-1">{t('toolbox.plugin.noPluginsDesc')}</p>
          <Button
            variant="outline"
            className="mt-4 gap-1.5"
            onClick={() => setInstallDialogOpen(true)}
          >
            <Plus className="h-4 w-4" />
            {t('toolbox.plugin.install')}
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {plugins.map((plugin) => (
            <PluginCard
              key={plugin.id}
              plugin={plugin}
              t={t}
              onToggleEnabled={(enabled) =>
                enabled ? disablePlugin(plugin.id) : enablePlugin(plugin.id)
              }
              onUninstall={() => setUninstallTarget(plugin)}
              onReload={() => reloadPlugin(plugin.id)}
              onPermissions={() => handleOpenPermissions(plugin.id)}
              onDetails={() => setDetailPlugin(plugin)}
              onCheckUpdate={() => handleCheckUpdate(plugin)}
              onUpdate={() => handleConfirmUpdate(plugin.id)}
              onHealth={() => handleOpenHealth(plugin.id)}
              onSettings={() => handleOpenSettings(plugin.id)}
              onExport={() => handleExport(plugin.id)}
              pluginUpdateInfo={updateInfo[plugin.id] ?? null}
              isUpdating={updatingPlugin === plugin.id}
              healthStatus={getHealthStatus(plugin)}
            />
          ))}
        </div>
      )}

      {/* Uninstall Confirmation */}
      <AlertDialog open={uninstallTarget !== null} onOpenChange={(open) => { if (!open) setUninstallTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('toolbox.plugin.uninstallConfirmTitle')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('toolbox.plugin.uninstallConfirmDesc', { name: uninstallTarget?.name ?? '' })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (uninstallTarget) {
                  uninstallPlugin(uninstallTarget.id);
                  setUninstallTarget(null);
                }
              }}
            >
              {t('toolbox.plugin.uninstall')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Install / Import Dialog */}
      <Dialog open={installDialogOpen} onOpenChange={setInstallDialogOpen}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle>{t('toolbox.plugin.installDialog')}</DialogTitle>
            <DialogDescription>{t('toolbox.plugin.installDialogDesc')}</DialogDescription>
          </DialogHeader>
          <Tabs defaultValue="url" className="mt-2">
            <TabsList className="w-full">
              <TabsTrigger value="url" className="flex-1">{t('toolbox.plugin.installTab')}</TabsTrigger>
              <TabsTrigger value="local" className="flex-1">{t('toolbox.plugin.importTab')}</TabsTrigger>
            </TabsList>
            <TabsContent value="url" className="space-y-4 pt-2">
              <div className="grid gap-2">
                <Label htmlFor="plugin-source">{t('toolbox.plugin.sourceLabel')}</Label>
                <Input
                  id="plugin-source"
                  value={installSource}
                  onChange={(e) => setInstallSource(e.target.value)}
                  placeholder={t('toolbox.plugin.sourcePlaceholder')}
                />
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setInstallDialogOpen(false)}>
                  {t('common.cancel')}
                </Button>
                <Button onClick={handleInstall} disabled={installing || !installSource.trim()}>
                  {installing ? t('toolbox.plugin.running') : t('toolbox.plugin.install')}
                </Button>
              </DialogFooter>
            </TabsContent>
            <TabsContent value="local" className="space-y-4 pt-2">
              <DestinationPicker
                value={importPath}
                onChange={setImportPath}
                placeholder={t('toolbox.plugin.importPlaceholder')}
                label={t('toolbox.plugin.importLabel')}
                isDesktop={isDesktop}
                browseTooltip={t('toolbox.plugin.importBrowse')}
              />
              <DialogFooter>
                <Button variant="outline" onClick={() => setInstallDialogOpen(false)}>
                  {t('common.cancel')}
                </Button>
                <Button onClick={handleImportLocal} disabled={importingLocal || !importPath.trim()}>
                  {importingLocal ? t('toolbox.plugin.importing') : t('toolbox.plugin.import')}
                </Button>
              </DialogFooter>
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>

      {/* Scaffold Dialog */}
      <Dialog open={scaffoldOpen} onOpenChange={setScaffoldOpen}>
        <DialogContent className="sm:max-w-[540px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Hammer className="h-4 w-4" />
              {t('toolbox.plugin.createPlugin')}
            </DialogTitle>
            <DialogDescription>{t('toolbox.plugin.createPluginDesc')}</DialogDescription>
          </DialogHeader>
          <ScrollArea className="max-h-[60vh]">
            <div className="grid gap-4 py-2 pr-2">
              <div className="grid grid-cols-2 gap-3">
                <div className="grid gap-1.5">
                  <Label className="text-xs">{t('toolbox.plugin.scaffoldName')}</Label>
                  <Input
                    value={scaffoldForm.name}
                    onChange={(e) => setScaffoldForm(p => ({ ...p, name: e.target.value }))}
                    placeholder={t('toolbox.plugin.scaffoldNamePlaceholder')}
                  />
                </div>
                <div className="grid gap-1.5">
                  <Label className="text-xs">{t('toolbox.plugin.scaffoldId')}</Label>
                  <Input
                    value={scaffoldForm.id}
                    onChange={(e) => setScaffoldForm(p => ({ ...p, id: e.target.value }))}
                    placeholder={t('toolbox.plugin.scaffoldIdPlaceholder')}
                  />
                </div>
              </div>
              <div className="grid gap-1.5">
                <Label className="text-xs">{t('toolbox.plugin.scaffoldDescription')}</Label>
                <Input
                  value={scaffoldForm.description}
                  onChange={(e) => setScaffoldForm(p => ({ ...p, description: e.target.value }))}
                  placeholder={t('toolbox.plugin.scaffoldDescPlaceholder')}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="grid gap-1.5">
                  <Label className="text-xs">{t('toolbox.plugin.scaffoldAuthor')}</Label>
                  <Input
                    value={scaffoldForm.author}
                    onChange={(e) => setScaffoldForm(p => ({ ...p, author: e.target.value }))}
                    placeholder={t('toolbox.plugin.scaffoldAuthorPlaceholder')}
                  />
                </div>
                <div className="grid gap-1.5">
                  <Label className="text-xs">{t('toolbox.plugin.scaffoldLanguage')}</Label>
                  <Select
                    value={scaffoldForm.language}
                    onValueChange={(v) => setScaffoldForm(p => ({ ...p, language: v as PluginLanguage }))}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="typescript">{t('toolbox.plugin.scaffoldLanguageTs')}</SelectItem>
                      <SelectItem value="rust">{t('toolbox.plugin.scaffoldLanguageRust')}</SelectItem>
                      <SelectItem value="javascript">{t('toolbox.plugin.scaffoldLanguageJs')}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <DestinationPicker
                value={scaffoldForm.outputDir}
                onChange={(v) => setScaffoldForm(p => ({ ...p, outputDir: v }))}
                placeholder="C:\\Users\\you\\plugins"
                label={t('toolbox.plugin.scaffoldOutputDir')}
                isDesktop={isDesktop}
                browseTooltip={t('common.browse')}
              />
              <Separator />
              <div className="space-y-2">
                <Label className="text-xs font-medium">{t('toolbox.plugin.scaffoldPermissions')}</Label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { key: 'permConfigRead', label: t('toolbox.plugin.permConfigRead') },
                    { key: 'permEnvRead', label: t('toolbox.plugin.permEnvRead') },
                    { key: 'permPkgSearch', label: t('toolbox.plugin.permPkgSearch') },
                    { key: 'permClipboard', label: t('toolbox.plugin.permClipboard') },
                    { key: 'permNotification', label: t('toolbox.plugin.permNotification') },
                    { key: 'permFsRead', label: t('toolbox.plugin.permFsRead') },
                    { key: 'permFsWrite', label: t('toolbox.plugin.permFsWrite') },
                    { key: 'permProcessExec', label: t('toolbox.plugin.permProcessExec') },
                  ].map(({ key, label }) => (
                    <div key={key} className="flex items-center gap-2">
                      <Checkbox
                        id={`scaffold-${key}`}
                        checked={scaffoldForm[key as keyof typeof scaffoldForm] as boolean}
                        onCheckedChange={(checked) =>
                          setScaffoldForm(p => ({ ...p, [key]: !!checked }))
                        }
                      />
                      <Label htmlFor={`scaffold-${key}`} className="text-xs font-normal cursor-pointer">
                        {label}
                      </Label>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </ScrollArea>
          <DialogFooter>
            <Button variant="outline" onClick={() => setScaffoldOpen(false)}>
              {t('common.cancel')}
            </Button>
            <Button
              onClick={handleScaffold}
              disabled={scaffolding || !scaffoldForm.name.trim() || !scaffoldForm.id.trim() || !scaffoldForm.outputDir.trim()}
            >
              {scaffolding ? t('toolbox.plugin.scaffoldCreating') : t('toolbox.plugin.scaffoldCreate')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Detail Dialog */}
      <Dialog open={detailPlugin !== null} onOpenChange={(open) => { if (!open) setDetailPlugin(null); }}>
        <DialogContent className="sm:max-w-[520px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Info className="h-4 w-4" />
              {detailPlugin?.name}
            </DialogTitle>
            <DialogDescription>{detailPlugin?.description}</DialogDescription>
          </DialogHeader>
          {detailPlugin && (
            <ScrollArea className="max-h-[400px]">
              <div className="space-y-4 py-2">
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div><span className="text-muted-foreground">{t('toolbox.plugin.pluginId')}:</span> <span className="font-mono">{detailPlugin.id}</span></div>
                  <div><span className="text-muted-foreground">{t('toolbox.plugin.version')}:</span> {detailPlugin.version}</div>
                  <div><span className="text-muted-foreground">{t('toolbox.plugin.source')}:</span> {detailPlugin.source.type}</div>
                  <div><span className="text-muted-foreground">{t('toolbox.plugin.installedAt')}:</span> {new Date(detailPlugin.installedAt).toLocaleDateString()}</div>
                  {detailPlugin.authors.length > 0 && (
                    <div className="col-span-2"><span className="text-muted-foreground">{t('toolbox.plugin.author')}:</span> {detailPlugin.authors.join(', ')}</div>
                  )}
                </div>
                <Separator />
                <div>
                  <h4 className="text-sm font-medium mb-2">{t('toolbox.plugin.toolsList', { count: detailPlugin.toolCount })}</h4>
                  {detailPlugin.toolCount === 0 ? (
                    <p className="text-xs text-muted-foreground">{t('toolbox.plugin.noTools')}</p>
                  ) : (
                    <div className="space-y-1">
                      {pluginTools.filter(tool => tool.pluginId === detailPlugin.id).map(tool => (
                        <div key={tool.toolId} className="flex items-center justify-between text-xs p-1.5 rounded bg-muted/50">
                          <span className="font-medium">{locale === 'zh' && tool.nameZh ? tool.nameZh : tool.nameEn}</span>
                          <Badge variant="outline" className="text-[10px] font-mono">{tool.entry}</Badge>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </ScrollArea>
          )}
        </DialogContent>
      </Dialog>

      {/* Permissions Dialog */}
      <Dialog open={permDialogPlugin !== null} onOpenChange={(open) => { if (!open) setPermDialogPlugin(null); }}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Shield className="h-4 w-4" />
              {t('toolbox.plugin.permissions')}
            </DialogTitle>
            <DialogDescription>
              {permDialogPlugin}
            </DialogDescription>
          </DialogHeader>
          {permState && (
            <ScrollArea className="max-h-[400px]">
              <div className="space-y-3 py-2">
                {Object.entries(PERM_LABELS).map(([key, label]) => {
                  const isGranted = permState.granted.includes(key);
                  const isDenied = permState.denied.includes(key);
                  return (
                    <div key={key} className="flex items-center justify-between px-1">
                      <div>
                        <span className="text-sm font-medium">{label}</span>
                        <Badge
                          variant="secondary"
                          className={`ml-2 text-[10px] ${isGranted && !isDenied ? 'bg-green-500/10 text-green-600' : 'bg-red-500/10 text-red-600'}`}
                        >
                          {isGranted && !isDenied ? t('toolbox.plugin.permissionGranted') : t('toolbox.plugin.permissionDenied')}
                        </Badge>
                      </div>
                      <Switch
                        checked={isGranted && !isDenied}
                        onCheckedChange={() => handleTogglePermission(key, isGranted && !isDenied)}
                      />
                    </div>
                  );
                })}
              </div>
            </ScrollArea>
          )}
        </DialogContent>
      </Dialog>

      {/* Update Confirmation with Changelog */}
      <AlertDialog open={updateConfirmPlugin !== null} onOpenChange={(open) => { if (!open) setUpdateConfirmPlugin(null); }}>
        <AlertDialogContent className="sm:max-w-[520px]">
          <AlertDialogHeader>
            <AlertDialogTitle>{t('toolbox.plugin.updateConfirmTitle')}</AlertDialogTitle>
            <AlertDialogDescription>
              {updateConfirmPlugin && updateInfo[updateConfirmPlugin] && (
                <>
                  {t('toolbox.plugin.updateConfirmDesc', {
                    name: plugins.find(p => p.id === updateConfirmPlugin)?.name ?? updateConfirmPlugin,
                    current: updateInfo[updateConfirmPlugin]!.currentVersion,
                    latest: updateInfo[updateConfirmPlugin]!.latestVersion,
                  })}
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          {updateConfirmPlugin && updateInfo[updateConfirmPlugin]?.changelog && (
            <ScrollArea className="max-h-[200px] rounded-md border p-3">
              <pre className="text-xs whitespace-pre-wrap">{updateInfo[updateConfirmPlugin]!.changelog}</pre>
            </ScrollArea>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (updateConfirmPlugin) handleUpdate(updateConfirmPlugin);
              }}
            >
              {t('toolbox.plugin.update')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Health Dialog */}
      <Dialog open={healthDialogPlugin !== null} onOpenChange={(open) => { if (!open) setHealthDialogPlugin(null); }}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Heart className="h-4 w-4" />
              {t('toolbox.plugin.healthTitle')}
            </DialogTitle>
            <DialogDescription>{healthDialogPlugin}</DialogDescription>
          </DialogHeader>
          {healthData && (
            <div className="space-y-3 py-2">
              {healthData.autoDisabled && (
                <div className="flex items-center gap-2 rounded-md border border-destructive/50 bg-destructive/10 p-2 text-sm text-destructive">
                  <AlertTriangle className="h-4 w-4 shrink-0" />
                  {t('toolbox.plugin.healthAutoDisabledDesc')}
                </div>
              )}
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="rounded-md border p-3 text-center">
                  <div className="text-2xl font-bold">{healthData.totalCalls}</div>
                  <div className="text-xs text-muted-foreground">{t('toolbox.plugin.healthTotalCalls')}</div>
                </div>
                <div className="rounded-md border p-3 text-center">
                  <div className="text-2xl font-bold text-destructive">{healthData.failedCalls}</div>
                  <div className="text-xs text-muted-foreground">{t('toolbox.plugin.healthFailedCalls')}</div>
                </div>
                <div className="rounded-md border p-3 text-center">
                  <div className="text-2xl font-bold">
                    {healthData.totalCalls > 0 ? `${((healthData.failedCalls / healthData.totalCalls) * 100).toFixed(1)}%` : '0%'}
                  </div>
                  <div className="text-xs text-muted-foreground">{t('toolbox.plugin.healthFailureRate')}</div>
                </div>
                <div className="rounded-md border p-3 text-center">
                  <div className="text-2xl font-bold">{healthData.consecutiveFailures}</div>
                  <div className="text-xs text-muted-foreground">{t('toolbox.plugin.healthConsecutiveFailures')}</div>
                </div>
              </div>
              <div className="text-sm">
                <span className="text-muted-foreground">{t('toolbox.plugin.healthAvgDuration')}:</span>{' '}
                <span className="font-mono">
                  {healthData.totalCalls > 0 ? `${(healthData.totalDurationMs / healthData.totalCalls).toFixed(0)}ms` : '-'}
                </span>
              </div>
              {healthData.lastError && (
                <div className="text-sm">
                  <span className="text-muted-foreground">{t('toolbox.plugin.healthLastError')}:</span>
                  <code className="block mt-1 rounded bg-muted p-2 text-xs break-all">{healthData.lastError}</code>
                </div>
              )}
              <Button variant="outline" size="sm" className="gap-1.5" onClick={handleResetHealth}>
                <RefreshCw className="h-3.5 w-3.5" />
                {t('toolbox.plugin.healthReset')}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Settings Dialog */}
      <Dialog open={settingsDialogPlugin !== null} onOpenChange={(open) => { if (!open) setSettingsDialogPlugin(null); }}>
        <DialogContent className="sm:max-w-[520px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Settings2 className="h-4 w-4" />
              {t('toolbox.plugin.pluginSettings')}
            </DialogTitle>
            <DialogDescription>{t('toolbox.plugin.pluginSettingsDesc')}</DialogDescription>
          </DialogHeader>
          {settingsSchema.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">{t('toolbox.plugin.pluginSettingsEmpty')}</p>
          ) : (
            <ScrollArea className="max-h-[400px]">
              <div className="space-y-4 py-2 pr-2">
                {settingsSchema.map((setting) => (
                  <div key={setting.id} className="space-y-1.5">
                    <Label className="text-sm">
                      {locale === 'zh' && setting.labelZh ? setting.labelZh : setting.labelEn}
                    </Label>
                    {(locale === 'zh' && setting.descriptionZh ? setting.descriptionZh : setting.descriptionEn) && (
                      <p className="text-xs text-muted-foreground">
                        {locale === 'zh' && setting.descriptionZh ? setting.descriptionZh : setting.descriptionEn}
                      </p>
                    )}
                    {setting.type === 'boolean' ? (
                      <Switch
                        checked={!!settingsValues[setting.id]}
                        onCheckedChange={(checked) => handleSetSetting(setting.id, checked)}
                      />
                    ) : setting.type === 'select' ? (
                      <Select
                        value={String(settingsValues[setting.id] ?? setting.default ?? '')}
                        onValueChange={(v) => handleSetSetting(setting.id, v)}
                      >
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {setting.options.map((opt) => (
                            <SelectItem key={opt.value} value={opt.value}>
                              {locale === 'zh' && opt.labelZh ? opt.labelZh : opt.labelEn}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : setting.type === 'number' ? (
                      <Input
                        type="number"
                        min={setting.min ?? undefined}
                        max={setting.max ?? undefined}
                        value={String(settingsValues[setting.id] ?? setting.default ?? '')}
                        onChange={(e) => handleSetSetting(setting.id, Number(e.target.value))}
                      />
                    ) : (
                      <Input
                        value={String(settingsValues[setting.id] ?? setting.default ?? '')}
                        onChange={(e) => handleSetSetting(setting.id, e.target.value)}
                      />
                    )}
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function PluginCard({
  plugin,
  t,
  onToggleEnabled,
  onUninstall,
  onReload,
  onPermissions,
  onDetails,
  onCheckUpdate,
  onUpdate,
  onHealth,
  onSettings,
  onExport,
  pluginUpdateInfo,
  isUpdating,
  healthStatus,
}: {
  plugin: PluginInfo;
  t: (key: string, params?: Record<string, string | number>) => string;
  onToggleEnabled: (enabled: boolean) => void;
  onUninstall: () => void;
  onReload: () => void;
  onPermissions: () => void;
  onDetails: () => void;
  onCheckUpdate: () => void;
  onUpdate: () => void;
  onHealth: () => void;
  onSettings: () => void;
  onExport: () => void;
  pluginUpdateInfo: PluginUpdateInfo | null;
  isUpdating: boolean;
  healthStatus: 'good' | 'warning' | 'critical';
}) {
  const healthColor = healthStatus === 'good' ? 'bg-green-500' : healthStatus === 'warning' ? 'bg-yellow-500' : 'bg-red-500';
  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <CardTitle className="text-base flex items-center gap-2">
              <Plug className="h-4 w-4" />
              <span className={`h-2 w-2 rounded-full shrink-0 ${healthColor}`} />
              {plugin.name}
              <Badge variant="outline" className="text-[10px]">v{plugin.version}</Badge>
              {plugin.enabled ? (
                <Badge variant="secondary" className="text-[10px] bg-green-500/10 text-green-600 dark:text-green-400">
                  {t('toolbox.plugin.enable')}
                </Badge>
              ) : (
                <Badge variant="secondary" className="text-[10px] bg-muted text-muted-foreground">
                  {t('toolbox.plugin.disable')}
                </Badge>
              )}
              {pluginUpdateInfo && (
                <Badge variant="secondary" className="text-[10px] bg-blue-500/10 text-blue-600 dark:text-blue-400">
                  {t('toolbox.plugin.updateAvailable', { version: pluginUpdateInfo.latestVersion })}
                </Badge>
              )}
            </CardTitle>
            <CardDescription>{plugin.description}</CardDescription>
          </div>
          <Switch
            checked={plugin.enabled}
            onCheckedChange={() => onToggleEnabled(plugin.enabled)}
          />
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="flex items-center gap-4 text-xs text-muted-foreground mb-3">
          {plugin.authors.length > 0 && (
            <span>{t('toolbox.plugin.author')}: {plugin.authors.join(', ')}</span>
          )}
          <span>{t('toolbox.plugin.toolCount', { count: plugin.toolCount })}</span>
          <span>{plugin.source.type}</span>
        </div>
        <Separator className="mb-3" />
        <div className="flex items-center gap-2 flex-wrap">
          <Button variant="ghost" size="sm" className="h-7 gap-1 text-xs" onClick={onDetails}>
            <Info className="h-3 w-3" />
            {t('toolbox.plugin.details')}
          </Button>
          <Button variant="ghost" size="sm" className="h-7 gap-1 text-xs" onClick={onPermissions}>
            <Shield className="h-3 w-3" />
            {t('toolbox.plugin.permissions')}
          </Button>
          <Button variant="ghost" size="sm" className="h-7 gap-1 text-xs" onClick={onHealth}>
            <Heart className="h-3 w-3" />
            {t('toolbox.plugin.health')}
          </Button>
          <Button variant="ghost" size="sm" className="h-7 gap-1 text-xs" onClick={onSettings}>
            <Settings2 className="h-3 w-3" />
            {t('toolbox.plugin.pluginSettings')}
          </Button>
          <Button variant="ghost" size="sm" className="h-7 gap-1 text-xs" onClick={onExport}>
            <Download className="h-3 w-3" />
            {t('toolbox.plugin.export')}
          </Button>
          <Button variant="ghost" size="sm" className="h-7 gap-1 text-xs" onClick={onReload}>
            <RefreshCw className="h-3 w-3" />
            {t('toolbox.plugin.reload')}
          </Button>
          {pluginUpdateInfo ? (
            <Button variant="ghost" size="sm" className="h-7 gap-1 text-xs text-blue-600 hover:text-blue-700" onClick={onUpdate} disabled={isUpdating}>
              <ArrowUpCircle className="h-3 w-3" />
              {isUpdating ? t('toolbox.plugin.updating') : t('toolbox.plugin.update')}
            </Button>
          ) : (
            <Button variant="ghost" size="sm" className="h-7 gap-1 text-xs" onClick={onCheckUpdate}>
              <ArrowUpCircle className="h-3 w-3" />
              {t('toolbox.plugin.checkUpdate')}
            </Button>
          )}
          <Button variant="ghost" size="sm" className="h-7 gap-1 text-xs text-destructive hover:text-destructive" onClick={onUninstall}>
            <Trash2 className="h-3 w-3" />
            {t('toolbox.plugin.uninstall')}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
