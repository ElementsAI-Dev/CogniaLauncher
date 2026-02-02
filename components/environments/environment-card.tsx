'use client';

import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
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
import type { EnvironmentInfo, DetectedEnvironment } from '@/lib/tauri';
import { useEnvironmentStore } from '@/lib/stores/environment';
import { Download, Trash2, Check, FolderOpen, Scan, ChevronDown, List, Settings2 } from 'lucide-react';
import { toast } from 'sonner';
import { useLocale } from '@/components/providers/locale-provider';
import { formatSize } from '@/lib/utils';

interface EnvironmentCardProps {
  env: EnvironmentInfo;
  detectedVersion?: DetectedEnvironment | null;
  onInstall?: (version: string) => Promise<void>;
  onUninstall?: (version: string) => Promise<void>;
  onSetGlobal?: (version: string) => Promise<void>;
  onSetLocal?: (version: string, projectPath: string) => Promise<void>;
  loading?: boolean;
  availableProviders?: { id: string; name: string }[];
  onProviderChange?: (providerId: string) => void;
}

export function EnvironmentCard({ 
  env, 
  detectedVersion,
  onInstall, 
  onUninstall, 
  onSetGlobal,
  onSetLocal,
  loading,
  availableProviders = [],
  onProviderChange,
}: EnvironmentCardProps) {
  const { t } = useLocale();
  const { openVersionBrowser, openDetailsPanel } = useEnvironmentStore();
  const [customVersion, setCustomVersion] = useState('');
  const [localProjectPath, setLocalProjectPath] = useState('');
  const [isInstalling, setIsInstalling] = useState(false);
  const [selectedUninstall, setSelectedUninstall] = useState<string | null>(null);

  const handleInstall = async (version: string) => {
    if (!onInstall) return;
    setIsInstalling(true);
    try {
      await onInstall(version);
      toast.success(t('environments.toast.installing', { type: env.env_type, version }));
    } catch (err) {
      toast.error(t('environments.toast.installFailed', { error: String(err) }));
    } finally {
      setIsInstalling(false);
    }
  };

  const handleUninstall = async (version: string) => {
    if (!onUninstall) return;
    try {
      await onUninstall(version);
      toast.success(t('environments.toast.uninstalled', { type: env.env_type, version }));
    } catch (err) {
      toast.error(t('environments.toast.uninstallFailed', { error: String(err) }));
    }
    setSelectedUninstall(null);
  };

  const handleSetGlobal = async (version: string) => {
    if (!onSetGlobal) return;
    try {
      await onSetGlobal(version);
      toast.success(t('environments.toast.globalSet', { type: env.env_type, version }));
    } catch (err) {
      toast.error(t('environments.toast.globalFailed', { error: String(err) }));
    }
  };

  const handleSetLocal = async () => {
    if (!onSetLocal || !localProjectPath || !env.current_version) return;
    try {
      await onSetLocal(env.current_version, localProjectPath);
      toast.success(t('environments.toast.localSet', { path: localProjectPath }));
      setLocalProjectPath('');
    } catch (err) {
      toast.error(t('environments.toast.localFailed', { error: String(err) }));
    }
  };

  return (
    <TooltipProvider>
      <Card className={loading ? 'opacity-70' : ''}>
        {/* Card Header with detected version badge */}
        <div className="p-5 space-y-3">
          {/* Detected Version Badge */}
          {detectedVersion && (
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800">
              <Scan className="h-3.5 w-3.5 text-green-600 dark:text-green-400" />
              <span className="text-xs font-medium text-green-700 dark:text-green-300">
                {t('environments.detected')}: {detectedVersion.version} ({detectedVersion.source.replace('_', ' ')})
              </span>
            </div>
          )}
          
          {/* Title Row */}
          <div className="flex items-start justify-between">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-semibold">{env.env_type}</h3>
                {env.available ? (
                  <Badge variant="default" className="text-xs">{t('environments.available')}</Badge>
                ) : (
                  <Badge variant="secondary" className="text-xs">{t('environments.notInstalled')}</Badge>
                )}
              </div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <span>{t('environments.provider')}:</span>
                {availableProviders.length > 1 && onProviderChange ? (
                  <Select value={env.provider} onValueChange={onProviderChange}>
                    <SelectTrigger className="h-6 w-auto gap-1 px-2 py-0 text-xs font-medium bg-muted border-0">
                      <SelectValue />
                      <ChevronDown className="h-3 w-3" />
                    </SelectTrigger>
                    <SelectContent>
                      {availableProviders.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <span className="px-2 py-0.5 rounded bg-muted text-xs font-medium">{env.provider}</span>
                )}
              </div>
            </div>
            
            {/* Current Version Badge */}
            {env.current_version && (
              <div className="text-right">
                <div className="inline-flex items-center px-3 py-1.5 rounded-md border bg-background">
                  <span className="font-mono text-base font-medium">{env.current_version}</span>
                </div>
                <p className="text-xs text-muted-foreground mt-1">{t('environments.currentVersion')}</p>
              </div>
            )}
          </div>
        </div>
        
        <CardContent className="pt-0 space-y-4">
          {env.installed_versions.length > 0 && (
            <div className="space-y-2">
              <Label className="text-sm font-medium">{t('environments.installedVersions')}</Label>
              <div className="flex flex-wrap gap-2">
                {env.installed_versions.map((v) => (
                  <Tooltip key={v.version}>
                    <TooltipTrigger asChild>
                      <Badge
                        variant={v.is_current ? 'default' : 'secondary'}
                        className="cursor-pointer hover:opacity-80 transition-opacity"
                        onClick={() => handleSetGlobal(v.version)}
                      >
                        {v.is_current && <Check className="h-3 w-3 mr-1" />}
                        {v.version}
                      </Badge>
                    </TooltipTrigger>
                    <TooltipContent>
                      <div className="text-xs">
                        <p>Size: {formatSize(v.size)}</p>
                        {v.installed_at && <p>Installed: {new Date(v.installed_at).toLocaleDateString()}</p>}
                        <p className="text-muted-foreground">{t('environments.setGlobal')}</p>
                      </div>
                    </TooltipContent>
                  </Tooltip>
                ))}
              </div>
            </div>
          )}
          
          <div className="space-y-3">
            <Label className="text-sm font-medium">{t('environments.installNewVersion')}</Label>
            <div className="flex gap-2">
              <Select 
                onValueChange={handleInstall}
                disabled={isInstalling || loading}
              >
                <SelectTrigger className="w-[140px]">
                  <SelectValue placeholder={t('environments.quickInstall')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="latest">{t('environments.latest')}</SelectItem>
                  <SelectItem value="lts">{t('environments.lts')}</SelectItem>
                </SelectContent>
              </Select>
              
              <div className="flex gap-1 flex-1">
                <Input
                  placeholder={t('environments.versionPlaceholder')}
                  value={customVersion}
                  onChange={(e) => setCustomVersion(e.target.value)}
                  className="flex-1"
                  disabled={isInstalling || loading}
                />
                <Button
                  size="icon"
                  variant="outline"
                  onClick={() => {
                    if (customVersion) handleInstall(customVersion);
                  }}
                  disabled={!customVersion || isInstalling || loading}
                >
                  <Download className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>

          {env.installed_versions.length > 0 && (
            <div className="space-y-3">
              <Label className="text-sm font-medium">{t('environments.uninstallVersion')}</Label>
              <div className="flex gap-2">
                <Select 
                  value={selectedUninstall || ''}
                  onValueChange={setSelectedUninstall}
                  disabled={loading}
                >
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder={t('environments.selectVersion')} />
                  </SelectTrigger>
                  <SelectContent>
                    {env.installed_versions.map((v) => (
                      <SelectItem key={v.version} value={v.version}>
                        {v.version} {v.is_current && `(${t('environments.currentVersion').toLowerCase()})`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button 
                      variant="destructive" 
                      size="icon"
                      disabled={!selectedUninstall || loading}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>{t('common.confirm')}</AlertDialogTitle>
                      <AlertDialogDescription>
                        {t('common.uninstall')} {env.env_type} {selectedUninstall}?
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={() => selectedUninstall && handleUninstall(selectedUninstall)}
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      >
                        {t('common.uninstall')}
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </div>
          )}

          {onSetLocal && env.installed_versions.length > 0 && (
            <div className="space-y-3 pt-3 border-t">
              <Label className="text-sm font-medium">{t('environments.setLocalVersion')}</Label>
              <div className="flex gap-2">
                <Input
                  placeholder={t('environments.projectPath')}
                  value={localProjectPath}
                  onChange={(e) => setLocalProjectPath(e.target.value)}
                  className="flex-1"
                  disabled={loading}
                />
                <Button
                  variant="outline"
                  onClick={handleSetLocal}
                  disabled={!localProjectPath || !env.current_version || loading}
                >
                  <FolderOpen className="h-4 w-4 mr-2" />
                  {t('environments.setLocal')}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                {t('environments.createVersionFile').replace('{type}', env.env_type.toLowerCase())}
              </p>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-2 pt-3 border-t">
            <Button
              variant="outline"
              size="sm"
              className="flex-1 gap-2"
              onClick={() => openVersionBrowser(env.env_type)}
            >
              <List className="h-4 w-4" />
              {t('environments.browseVersions')}
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="flex-1 gap-2"
              onClick={() => openDetailsPanel(env.env_type)}
            >
              <Settings2 className="h-4 w-4" />
              {t('environments.viewDetails')}
            </Button>
          </div>
        </CardContent>
      </Card>
    </TooltipProvider>
  );
}
