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
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
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
} from 'lucide-react';
import Link from 'next/link';
import type { PluginInfo, PluginPermissionState, PluginLanguage, ScaffoldConfig } from '@/types/plugin';

export default function PluginsPage() {
  const { t } = useLocale();
  const isDesktop = isTauri();
  const {
    plugins,
    pluginTools,
    loading,
    fetchPlugins,
    installPlugin,
    uninstallPlugin,
    enablePlugin,
    disablePlugin,
    reloadPlugin,
    getPermissions,
    grantPermission,
    revokePermission,
    scaffoldPlugin,
  } = usePlugins();

  const [installDialogOpen, setInstallDialogOpen] = useState(false);
  const [installSource, setInstallSource] = useState('');
  const [installing, setInstalling] = useState(false);
  const [permDialogPlugin, setPermDialogPlugin] = useState<string | null>(null);
  const [permState, setPermState] = useState<PluginPermissionState | null>(null);
  const [detailPlugin, setDetailPlugin] = useState<PluginInfo | null>(null);
  const [scaffoldOpen, setScaffoldOpen] = useState(false);
  const [scaffolding, setScaffolding] = useState(false);
  const [scaffoldForm, setScaffoldForm] = useState({
    name: '', id: '', description: '', author: '', outputDir: '',
    language: 'rust' as PluginLanguage,
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
            <Button size="sm" className="gap-1.5" onClick={() => setInstallDialogOpen(true)}>
              <Plus className="h-3.5 w-3.5" />
              {t('toolbox.plugin.install')}
            </Button>
          </div>
        }
      />

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
              onUninstall={() => uninstallPlugin(plugin.id)}
              onReload={() => reloadPlugin(plugin.id)}
              onPermissions={() => handleOpenPermissions(plugin.id)}
              onDetails={() => setDetailPlugin(plugin)}
            />
          ))}
        </div>
      )}

      {/* Install Dialog */}
      <Dialog open={installDialogOpen} onOpenChange={setInstallDialogOpen}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle>{t('toolbox.plugin.installDialog')}</DialogTitle>
            <DialogDescription>{t('toolbox.plugin.installDialogDesc')}</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="plugin-source">{t('toolbox.plugin.sourceLabel')}</Label>
              <Input
                id="plugin-source"
                value={installSource}
                onChange={(e) => setInstallSource(e.target.value)}
                placeholder={t('toolbox.plugin.sourcePlaceholder')}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setInstallDialogOpen(false)}>
              {t('common.cancel')}
            </Button>
            <Button onClick={handleInstall} disabled={installing || !installSource.trim()}>
              {installing ? t('toolbox.plugin.running') : t('toolbox.plugin.install')}
            </Button>
          </DialogFooter>
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
                      <SelectItem value="rust">{t('toolbox.plugin.scaffoldLanguageRust')}</SelectItem>
                      <SelectItem value="javascript">{t('toolbox.plugin.scaffoldLanguageJs')}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid gap-1.5">
                <Label className="text-xs">{t('toolbox.plugin.scaffoldOutputDir')}</Label>
                <Input
                  value={scaffoldForm.outputDir}
                  onChange={(e) => setScaffoldForm(p => ({ ...p, outputDir: e.target.value }))}
                  placeholder="C:\\Users\\you\\plugins"
                />
              </div>
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
                          <span className="font-medium">{tool.nameEn}</span>
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
}: {
  plugin: PluginInfo;
  t: (key: string, params?: Record<string, string | number>) => string;
  onToggleEnabled: (enabled: boolean) => void;
  onUninstall: () => void;
  onReload: () => void;
  onPermissions: () => void;
  onDetails: () => void;
}) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <CardTitle className="text-base flex items-center gap-2">
              <Plug className="h-4 w-4" />
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
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" className="h-7 gap-1 text-xs" onClick={onDetails}>
            <Info className="h-3 w-3" />
            {t('toolbox.plugin.details')}
          </Button>
          <Button variant="ghost" size="sm" className="h-7 gap-1 text-xs" onClick={onPermissions}>
            <Shield className="h-3 w-3" />
            {t('toolbox.plugin.permissions')}
          </Button>
          <Button variant="ghost" size="sm" className="h-7 gap-1 text-xs" onClick={onReload}>
            <RefreshCw className="h-3 w-3" />
            {t('toolbox.plugin.reload')}
          </Button>
          <Button variant="ghost" size="sm" className="h-7 gap-1 text-xs text-destructive hover:text-destructive" onClick={onUninstall}>
            <Trash2 className="h-3 w-3" />
            {t('toolbox.plugin.uninstall')}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
