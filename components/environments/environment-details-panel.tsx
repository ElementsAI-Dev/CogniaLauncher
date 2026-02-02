'use client';

import { useState, useEffect } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useLocale } from '@/components/providers/locale-provider';
import type { EnvironmentInfo, DetectedEnvironment } from '@/lib/tauri';
import { useEnvironmentStore } from '@/lib/stores/environment';
import { 
  Check, 
  Globe, 
  FolderOpen, 
  Plus, 
  X, 
  FileCode, 
  Settings2,
  Cpu,
  HardDrive,
  Trash2,
  Download,
  RefreshCw
} from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { isTauri } from '@/lib/tauri';
import { toast } from 'sonner';
import { formatSize } from '@/lib/utils';

interface EnvironmentDetailsPanelProps {
  env: EnvironmentInfo | null;
  detectedVersion: DetectedEnvironment | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSetGlobal: (version: string) => Promise<void>;
  onSetLocal: (version: string, projectPath: string) => Promise<void>;
  onUninstall?: (version: string) => Promise<void>;
  onRefresh?: () => Promise<void>;
}


const DETECTION_FILES: Record<string, string[]> = {
  node: ['.nvmrc', '.node-version', 'package.json (engines.node)', '.tool-versions'],
  python: ['.python-version', 'pyproject.toml', '.tool-versions', 'runtime.txt'],
  go: ['.go-version', 'go.mod', '.tool-versions'],
  rust: ['rust-toolchain.toml', 'rust-toolchain', '.tool-versions'],
  ruby: ['.ruby-version', 'Gemfile', '.tool-versions'],
  java: ['.java-version', 'pom.xml', '.tool-versions', '.sdkmanrc'],
};

export function EnvironmentDetailsPanel({
  env,
  detectedVersion,
  open,
  onOpenChange,
  onSetGlobal,
  onSetLocal,
  onUninstall,
  onRefresh,
}: EnvironmentDetailsPanelProps) {
  const { t } = useLocale();
  const [localProjectPath, setLocalProjectPath] = useState('');
  const [selectedLocalVersion, setSelectedLocalVersion] = useState('');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [uninstallingVersion, setUninstallingVersion] = useState<string | null>(null);
  // Get persisted environment settings from store
  const { getEnvSettings, addEnvVariable, removeEnvVariable, toggleDetectionFile } = useEnvironmentStore();
  const envSettings = env ? getEnvSettings(env.env_type) : null;
  const envVariables = envSettings?.envVariables || [];
  const detectionFileSettings = envSettings?.detectionFiles || [];
  const [newVarKey, setNewVarKey] = useState('');
  const [newVarValue, setNewVarValue] = useState('');

  // Reset state when panel closes
  useEffect(() => {
    if (!open) {
      setLocalProjectPath('');
      setSelectedLocalVersion('');
    }
  }, [open]);

  if (!env) return null;

  // Fallback to constant if store doesn't have settings yet
  const detectionFilesFromConstant = DETECTION_FILES[env.env_type.toLowerCase()] || [];
  // Use store settings if available, otherwise create from constant
  // Always normalize to { fileName, enabled } format
  const detectionFiles: { fileName: string; enabled: boolean }[] = detectionFileSettings.length > 0 
    ? detectionFileSettings 
    : detectionFilesFromConstant.map((fileName, idx) => ({
        fileName,
        enabled: idx < 2, // Enable first two by default
      }));

  const handleSetGlobal = async (version: string) => {
    try {
      await onSetGlobal(version);
      toast.success(t('environments.details.globalVersionSet').replace('{version}', version));
    } catch (err) {
      toast.error(String(err));
    }
  };

  const handleSetLocal = async () => {
    if (!localProjectPath || !selectedLocalVersion) return;
    try {
      await onSetLocal(selectedLocalVersion, localProjectPath);
      toast.success(t('environments.details.localVersionSet'));
      setLocalProjectPath('');
    } catch (err) {
      toast.error(String(err));
    }
  };

  const handleAddEnvVariable = () => {
    if (!newVarKey.trim() || !env) return;
    addEnvVariable(env.env_type, { key: newVarKey, value: newVarValue, enabled: true });
    setNewVarKey('');
    setNewVarValue('');
    toast.success(t('environments.details.envVarAdded'));
  };

  const handleRemoveEnvVariable = (key: string) => {
    if (!env) return;
    removeEnvVariable(env.env_type, key);
  };

  const totalSize = env.installed_versions.reduce((acc, v) => acc + (v.size || 0), 0);

  const handleRefresh = async () => {
    if (!onRefresh) return;
    setIsRefreshing(true);
    try {
      await onRefresh();
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleUninstall = async (version: string) => {
    if (!onUninstall) return;
    setUninstallingVersion(version);
    try {
      await onUninstall(version);
      toast.success(t('environments.details.versionUninstalled').replace('{version}', version));
    } catch (err) {
      toast.error(String(err));
    } finally {
      setUninstallingVersion(null);
    }
  };

  const handleBrowseFolder = async () => {
    if (!isTauri()) {
      toast.info(t('environments.details.manualPathRequired'));
      return;
    }
    
    try {
      // Try to import the dialog plugin dynamically
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const dialogModule = await import('@tauri-apps/plugin-dialog' as any).catch(() => null);
      if (dialogModule?.open) {
        const selected = await dialogModule.open({
          directory: true,
          multiple: false,
          title: t('environments.details.selectProjectFolder'),
        });
        if (selected && typeof selected === 'string') {
          setLocalProjectPath(selected);
        }
      } else {
        toast.info(t('environments.details.manualPathRequired'));
      }
    } catch {
      // Dialog plugin not available, prompt for manual input
      toast.info(t('environments.details.manualPathRequired'));
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-[480px] sm:w-[540px] p-0 flex flex-col">
        <SheetHeader className="p-6 pb-4 border-b">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
                <Settings2 className="h-6 w-6 text-primary" />
              </div>
              <div>
                <SheetTitle className="text-xl">{env.env_type}</SheetTitle>
                <SheetDescription>
                  {t('environments.details.subtitle').replace('{provider}', env.provider)}
                </SheetDescription>
              </div>
            </div>
            {onRefresh && (
              <Button
                variant="outline"
                size="icon"
                onClick={handleRefresh}
                disabled={isRefreshing}
                className="h-8 w-8"
              >
                <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
              </Button>
            )}
          </div>
        </SheetHeader>

        <ScrollArea className="flex-1">
          <div className="p-6 space-y-6">
            {/* Status Section */}
            <section className="space-y-3">
              <h3 className="text-sm font-medium flex items-center gap-2">
                <Cpu className="h-4 w-4" />
                {t('environments.details.status')}
              </h3>
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 rounded-lg bg-muted/50 space-y-1">
                  <p className="text-xs text-muted-foreground">{t('environments.details.currentVersion')}</p>
                  <p className="font-mono font-medium">{env.current_version || t('common.none')}</p>
                </div>
                <div className="p-3 rounded-lg bg-muted/50 space-y-1">
                  <p className="text-xs text-muted-foreground">{t('environments.details.installedCount')}</p>
                  <p className="font-medium">{env.installed_versions.length} {t('environments.details.versions')}</p>
                </div>
                <div className="p-3 rounded-lg bg-muted/50 space-y-1">
                  <p className="text-xs text-muted-foreground">{t('environments.details.totalSize')}</p>
                  <div className="flex items-center gap-1">
                    <HardDrive className="h-3 w-3" />
                    <p className="font-medium">{formatSize(totalSize)}</p>
                  </div>
                </div>
                <div className="p-3 rounded-lg bg-muted/50 space-y-1">
                  <p className="text-xs text-muted-foreground">{t('environments.details.provider')}</p>
                  <p className="font-medium">{env.provider}</p>
                </div>
              </div>

              {detectedVersion && (
                <div className="flex items-center gap-2 p-3 rounded-lg bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800">
                  <Check className="h-4 w-4 text-green-600" />
                  <div className="text-sm">
                    <span className="text-green-700 dark:text-green-300 font-medium">
                      {t('environments.detected')}: {detectedVersion.version}
                    </span>
                    <span className="text-green-600 dark:text-green-400 ml-2">
                      ({detectedVersion.source.replace('_', ' ')})
                    </span>
                  </div>
                </div>
              )}
            </section>

            <Separator />

            {/* Installed Versions Section */}
            <section className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-medium flex items-center gap-2">
                  <Download className="h-4 w-4" />
                  {t('environments.installedVersions')}
                </h3>
                <Badge variant="secondary">{env.installed_versions.length}</Badge>
              </div>

              {env.installed_versions.length === 0 ? (
                <div className="p-4 rounded-lg bg-muted/30 text-center text-muted-foreground text-sm">
                  {t('environments.details.noVersionsInstalled')}
                </div>
              ) : (
                <div className="space-y-2">
                  {env.installed_versions.map((v) => (
                    <div
                      key={v.version}
                      className={`flex items-center justify-between p-3 rounded-lg border ${
                        v.is_current ? 'bg-primary/5 border-primary/20' : 'bg-muted/30'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-medium">{v.version}</span>
                        {v.is_current && (
                          <Badge variant="default" className="text-xs">
                            {t('environments.currentVersion')}
                          </Badge>
                        )}
                        <span className="text-xs text-muted-foreground">
                          {formatSize(v.size)}
                        </span>
                      </div>
                      <div className="flex items-center gap-1">
                        {!v.is_current && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleSetGlobal(v.version)}
                            className="h-7 text-xs"
                          >
                            {t('environments.setGlobal')}
                          </Button>
                        )}
                        {onUninstall && (
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 text-destructive hover:text-destructive"
                                disabled={uninstallingVersion === v.version}
                              >
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>{t('common.confirm')}</AlertDialogTitle>
                                <AlertDialogDescription>
                                  {t('environments.details.confirmUninstall')
                                    .replace('{type}', env.env_type)
                                    .replace('{version}', v.version)}
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => handleUninstall(v.version)}
                                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                >
                                  {t('common.uninstall')}
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>

            <Separator />

            {/* Version Pinning Section */}
            <section className="space-y-3">
              <div>
                <h3 className="text-sm font-medium flex items-center gap-2">
                  <Globe className="h-4 w-4" />
                  {t('environments.details.versionPinning')}
                </h3>
                <p className="text-xs text-muted-foreground mt-1">
                  {t('environments.details.versionPinningDesc')}
                </p>
              </div>

              {/* Global Version */}
              <div className="p-4 rounded-lg bg-muted/30 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">{t('environments.details.globalVersion')}</p>
                    <p className="text-xs text-muted-foreground">
                      {t('environments.details.globalVersionDesc')}
                    </p>
                  </div>
                  <Select
                    value={env.current_version || ''}
                    onValueChange={handleSetGlobal}
                  >
                    <SelectTrigger className="w-[140px] h-9">
                      <SelectValue placeholder={t('environments.selectVersion')} />
                    </SelectTrigger>
                    <SelectContent>
                      {env.installed_versions.map((v) => (
                        <SelectItem key={v.version} value={v.version}>
                          <div className="flex items-center gap-2">
                            {v.is_current && <Check className="h-3 w-3" />}
                            <span className="font-mono">{v.version}</span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Local Version */}
              <div className="p-4 rounded-lg bg-muted/30 space-y-3">
                <div>
                  <p className="text-sm font-medium">{t('environments.details.localVersion')}</p>
                  <p className="text-xs text-muted-foreground">
                    {t('environments.details.localVersionDesc')}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Select
                    value={selectedLocalVersion}
                    onValueChange={setSelectedLocalVersion}
                  >
                    <SelectTrigger className="w-[140px] h-9">
                      <SelectValue placeholder={t('environments.selectVersion')} />
                    </SelectTrigger>
                    <SelectContent>
                      {env.installed_versions.map((v) => (
                        <SelectItem key={v.version} value={v.version}>
                          <span className="font-mono">{v.version}</span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <div className="flex-1 flex gap-1">
                    <Input
                      placeholder={t('environments.projectPath')}
                      value={localProjectPath}
                      onChange={(e) => setLocalProjectPath(e.target.value)}
                      className="flex-1 h-9"
                    />
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-9 w-9 shrink-0"
                      onClick={handleBrowseFolder}
                      title={t('environments.details.browseFolder')}
                    >
                      <FolderOpen className="h-4 w-4" />
                    </Button>
                  </div>
                  <Button
                    size="sm"
                    onClick={handleSetLocal}
                    disabled={!localProjectPath || !selectedLocalVersion}
                  >
                    {t('environments.setLocal')}
                  </Button>
                </div>
              </div>
            </section>

            <Separator />

            {/* Environment Variables Section */}
            <section className="space-y-3">
              <div>
                <h3 className="text-sm font-medium">{t('environments.details.envVariables')}</h3>
                <p className="text-xs text-muted-foreground mt-1">
                  {t('environments.details.envVariablesDesc')}
                </p>
              </div>

              <div className="space-y-2">
                {envVariables.map((envVar, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between p-3 rounded-lg bg-muted/50"
                  >
                    <div className="flex items-center gap-2 text-sm">
                      <code className="px-2 py-0.5 rounded bg-background font-mono text-xs">
                        {envVar.key}
                      </code>
                      <span className="text-muted-foreground">=</span>
                      <span className="text-muted-foreground truncate max-w-[200px]">
                        {envVar.value}
                      </span>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => handleRemoveEnvVariable(envVar.key)}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                ))}

                <div className="flex gap-2">
                  <Input
                    placeholder={t('environments.details.varKey')}
                    value={newVarKey}
                    onChange={(e) => setNewVarKey(e.target.value)}
                    className="w-[120px] h-9 font-mono text-xs"
                  />
                  <Input
                    placeholder={t('environments.details.varValue')}
                    value={newVarValue}
                    onChange={(e) => setNewVarValue(e.target.value)}
                    className="flex-1 h-9"
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleAddEnvVariable}
                    disabled={!newVarKey.trim()}
                    className="gap-1"
                  >
                    <Plus className="h-3 w-3" />
                    {t('common.add')}
                  </Button>
                </div>
              </div>
            </section>

            <Separator />

            {/* Project Detection Section */}
            <section className="space-y-3">
              <div>
                <h3 className="text-sm font-medium flex items-center gap-2">
                  <FileCode className="h-4 w-4" />
                  {t('environments.details.projectDetection')}
                </h3>
                <p className="text-xs text-muted-foreground mt-1">
                  {t('environments.details.projectDetectionDesc')}
                </p>
              </div>

              <div className="space-y-2">
                {detectionFiles.map((file, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between p-3 rounded-lg bg-muted/30"
                  >
                    <div className="flex items-center gap-2">
                      <FileCode className="h-4 w-4 text-muted-foreground" />
                      <code className="font-mono text-sm">{file.fileName}</code>
                    </div>
                    <Switch 
                      checked={file.enabled}
                      onCheckedChange={(checked) => toggleDetectionFile(env.env_type, file.fileName, checked)}
                    />
                  </div>
                ))}
              </div>
            </section>
          </div>
        </ScrollArea>

        <div className="p-4 border-t">
          <Button variant="outline" className="w-full" onClick={() => onOpenChange(false)}>
            {t('common.close')}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
