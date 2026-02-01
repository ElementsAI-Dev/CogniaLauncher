'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
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
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { useSettings } from '@/lib/hooks/use-settings';
import { useLocale } from '@/components/providers/locale-provider';
import {
  HardDrive,
  Trash2,
  AlertCircle,
  FolderOpen,
  RefreshCw,
  Shield,
  ShieldCheck,
  ShieldAlert,
  Wrench,
  Settings,
  ChevronDown,
  CheckCircle2,
  XCircle,
  AlertTriangle,
} from 'lucide-react';
import { toast } from 'sonner';
import type { CacheSettings } from '@/lib/tauri';

type CleanType = 'downloads' | 'metadata' | 'all';
type OperationType = 'clean' | 'verify' | 'repair' | 'settings';

export default function CachePage() {
  const {
    cacheInfo,
    cacheSettings,
    cacheVerification,
    loading,
    error,
    cogniaDir,
    fetchCacheInfo,
    fetchPlatformInfo,
    fetchCacheSettings,
    cleanCache,
    verifyCacheIntegrity,
    repairCache,
    updateCacheSettings,
  } = useSettings();
  const { t } = useLocale();

  const [operationLoading, setOperationLoading] = useState<OperationType | null>(null);
  const [cleaningType, setCleaningType] = useState<CleanType | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [localSettings, setLocalSettings] = useState<CacheSettings | null>(null);
  const [settingsDirty, setSettingsDirty] = useState(false);

  useEffect(() => {
    fetchCacheInfo();
    fetchPlatformInfo();
    fetchCacheSettings();
  }, [fetchCacheInfo, fetchPlatformInfo, fetchCacheSettings]);

  useEffect(() => {
    if (cacheSettings && !localSettings) {
      setLocalSettings(cacheSettings);
    }
  }, [cacheSettings, localSettings]);

  const handleClean = async (type: CleanType) => {
    setCleaningType(type);
    setOperationLoading('clean');
    try {
      const result = await cleanCache(type);
      toast.success(t('cache.freed', { size: result.freed_human }));
    } catch (err) {
      toast.error(`${t('cache.clearing')} ${err}`);
    } finally {
      setCleaningType(null);
      setOperationLoading(null);
    }
  };

  const handleRefresh = async () => {
    try {
      await fetchCacheInfo();
      toast.success(t('cache.refreshSuccess'));
    } catch {
      toast.error(t('cache.refreshFailed'));
    }
  };

  const handleVerify = async () => {
    setOperationLoading('verify');
    try {
      const result = await verifyCacheIntegrity();
      if (result.is_healthy) {
        toast.success(t('cache.verifySuccess'));
      } else {
        const issueCount = result.missing_files + result.corrupted_files + result.size_mismatches;
        toast.warning(t('cache.verifyIssues', { count: issueCount }));
      }
    } catch (err) {
      toast.error(`${t('cache.verify')}: ${err}`);
    } finally {
      setOperationLoading(null);
    }
  };

  const handleRepair = async () => {
    setOperationLoading('repair');
    try {
      const result = await repairCache();
      const repairedCount = result.removed_entries + result.recovered_entries;
      toast.success(t('cache.repairSuccess', { count: repairedCount, size: result.freed_human }));
    } catch (err) {
      toast.error(`${t('cache.repairFailed')}: ${err}`);
    } finally {
      setOperationLoading(null);
    }
  };

  const handleSettingsChange = (key: keyof CacheSettings, value: number | boolean) => {
    if (localSettings) {
      setLocalSettings({ ...localSettings, [key]: value });
      setSettingsDirty(true);
    }
  };

  const handleSaveSettings = async () => {
    if (!localSettings) return;
    setOperationLoading('settings');
    try {
      await updateCacheSettings(localSettings);
      setSettingsDirty(false);
      toast.success(t('cache.settingsSaved'));
    } catch (err) {
      toast.error(`${t('cache.settingsFailed')}: ${err}`);
    } finally {
      setOperationLoading(null);
    }
  };

  const maxSize = cacheSettings?.max_size || 10 * 1024 * 1024 * 1024;
  const usagePercent = cacheInfo ? Math.min(100, (cacheInfo.total_size / maxSize) * 100) : 0;

  const isLoading = loading || operationLoading !== null;
  const isCleaning = operationLoading === 'clean';
  const isVerifying = operationLoading === 'verify';
  const isRepairing = operationLoading === 'repair';
  const isSavingSettings = operationLoading === 'settings';

  const totalIssues = cacheVerification
    ? cacheVerification.missing_files + cacheVerification.corrupted_files + cacheVerification.size_mismatches
    : 0;

  return (
    <div className="p-4 md:p-6 space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold">{t('cache.title')}</h1>
          <p className="text-muted-foreground">{t('cache.description')}</p>
        </div>
        <div className="flex items-center gap-2">
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" size="sm" disabled={isLoading}>
                <Trash2 className="h-4 w-4 mr-2" />
                {isCleaning && cleaningType === 'all' ? t('cache.clearing') : t('cache.clearAll')}
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>{t('cache.clearConfirmTitle')}</AlertDialogTitle>
                <AlertDialogDescription>
                  {t('cache.clearAllConfirmDesc')}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
                <AlertDialogAction
                  onClick={() => handleClean('all')}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  {t('cache.clearAll')}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
          <Button variant="outline" size="sm" onClick={handleRefresh} disabled={isLoading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            {t('common.refresh')}
          </Button>
        </div>
      </div>

      {/* Error Alert */}
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Row 1: Total Size + Cache Location */}
      <div className="grid gap-4 grid-cols-1 md:grid-cols-2">
        {/* Total Size Card */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <HardDrive className="h-5 w-5" />
              {t('cache.totalSize')}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {loading && !cacheInfo ? (
              <>
                <Skeleton className="h-10 w-32" />
                <Skeleton className="h-2 w-full" />
                <Skeleton className="h-4 w-48" />
              </>
            ) : (
              <>
                <div className="text-3xl font-bold">{cacheInfo?.total_size_human || '0 B'}</div>
                <Progress value={usagePercent} className="h-2" />
                <p className="text-sm text-muted-foreground">
                  {t('cache.entries', { count: cacheInfo?.download_cache.entry_count || 0 }).replace('{count}', String(cacheInfo?.download_cache.entry_count || 0))} {t('cache.downloadCache').toLowerCase()}, {t('cache.entries', { count: cacheInfo?.metadata_cache.entry_count || 0 }).replace('{count}', String(cacheInfo?.metadata_cache.entry_count || 0))} {t('cache.metadataCache').toLowerCase()}
                </p>
              </>
            )}
          </CardContent>
        </Card>

        {/* Cache Location Card */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <FolderOpen className="h-5 w-5" />
              {t('cache.location')}
            </CardTitle>
            <CardDescription>{t('cache.locationDesc')}</CardDescription>
          </CardHeader>
          <CardContent>
            {loading && !cogniaDir ? (
              <Skeleton className="h-8 w-full" />
            ) : (
              <code className="text-sm bg-muted px-3 py-2 rounded block overflow-x-auto whitespace-nowrap">
                {cogniaDir || t('common.loading')}
              </code>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Row 2: Download Cache + Metadata Cache */}
      <div className="grid gap-4 grid-cols-1 md:grid-cols-2">
        {/* Download Cache Card */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">{t('cache.downloadCache')}</CardTitle>
            <CardDescription>{t('cache.downloadCacheDesc')}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex justify-between items-center">
              <div>
                {loading && !cacheInfo ? (
                  <>
                    <Skeleton className="h-6 w-20 mb-1" />
                    <Skeleton className="h-4 w-24" />
                  </>
                ) : (
                  <>
                    <p className="text-lg font-semibold">{cacheInfo?.download_cache.size_human || '0 B'}</p>
                    <p className="text-sm text-muted-foreground">
                      {t('cache.entries', { count: cacheInfo?.download_cache.entry_count || 0 }).replace('{count}', String(cacheInfo?.download_cache.entry_count || 0))}
                    </p>
                  </>
                )}
              </div>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={isLoading || (cacheInfo?.download_cache.entry_count || 0) === 0}
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    {isCleaning && cleaningType === 'downloads' ? t('cache.clearing') : t('cache.clearCache')}
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>{t('cache.clearDownload')}</AlertDialogTitle>
                    <AlertDialogDescription>
                      {t('cache.clearDownloadConfirmDesc')}
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={() => handleClean('downloads')}
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    >
                      {t('cache.clearCache')}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </CardContent>
        </Card>

        {/* Metadata Cache Card */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">{t('cache.metadataCache')}</CardTitle>
            <CardDescription>{t('cache.metadataCacheDesc')}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex justify-between items-center">
              <div>
                {loading && !cacheInfo ? (
                  <>
                    <Skeleton className="h-6 w-20 mb-1" />
                    <Skeleton className="h-4 w-24" />
                  </>
                ) : (
                  <>
                    <p className="text-lg font-semibold">{cacheInfo?.metadata_cache.size_human || '0 B'}</p>
                    <p className="text-sm text-muted-foreground">
                      {t('cache.entries', { count: cacheInfo?.metadata_cache.entry_count || 0 }).replace('{count}', String(cacheInfo?.metadata_cache.entry_count || 0))}
                    </p>
                  </>
                )}
              </div>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={isLoading || (cacheInfo?.metadata_cache.entry_count || 0) === 0}
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    {isCleaning && cleaningType === 'metadata' ? t('cache.clearing') : t('cache.clearCache')}
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>{t('cache.clearMetadata')}</AlertDialogTitle>
                    <AlertDialogDescription>
                      {t('cache.clearMetadataConfirmDesc')}
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={() => handleClean('metadata')}
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    >
                      {t('cache.clearCache')}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Row 3: Cache Health */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              <CardTitle className="text-base">{t('cache.cacheHealth')}</CardTitle>
              {cacheVerification && (
                <Badge variant={cacheVerification.is_healthy ? 'default' : 'destructive'} className="ml-2">
                  {cacheVerification.is_healthy ? (
                    <>
                      <ShieldCheck className="h-3 w-3 mr-1" />
                      {t('cache.healthy')}
                    </>
                  ) : (
                    <>
                      <ShieldAlert className="h-3 w-3 mr-1" />
                      {t('cache.unhealthy')}
                    </>
                  )}
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleVerify}
                disabled={isLoading}
              >
                <Shield className={`h-4 w-4 mr-2 ${isVerifying ? 'animate-pulse' : ''}`} />
                {isVerifying ? t('cache.verifying') : t('cache.verify')}
              </Button>
              {cacheVerification && !cacheVerification.is_healthy && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleRepair}
                  disabled={isLoading}
                >
                  <Wrench className={`h-4 w-4 mr-2 ${isRepairing ? 'animate-spin' : ''}`} />
                  {isRepairing ? t('cache.repairing') : t('cache.repair')}
                </Button>
              )}
            </div>
          </div>
          <CardDescription>{t('cache.cacheHealthDesc')}</CardDescription>
        </CardHeader>
        <CardContent>
          {cacheVerification ? (
            <div className="space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                  <div>
                    <p className="text-sm font-medium">{cacheVerification.valid_entries}</p>
                    <p className="text-xs text-muted-foreground">{t('cache.validEntries')}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <XCircle className={`h-4 w-4 ${cacheVerification.missing_files > 0 ? 'text-red-500' : 'text-muted-foreground'}`} />
                  <div>
                    <p className="text-sm font-medium">{cacheVerification.missing_files}</p>
                    <p className="text-xs text-muted-foreground">{t('cache.missingFiles')}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <AlertTriangle className={`h-4 w-4 ${cacheVerification.corrupted_files > 0 ? 'text-orange-500' : 'text-muted-foreground'}`} />
                  <div>
                    <p className="text-sm font-medium">{cacheVerification.corrupted_files}</p>
                    <p className="text-xs text-muted-foreground">{t('cache.corruptedFiles')}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <AlertCircle className={`h-4 w-4 ${cacheVerification.size_mismatches > 0 ? 'text-yellow-500' : 'text-muted-foreground'}`} />
                  <div>
                    <p className="text-sm font-medium">{cacheVerification.size_mismatches}</p>
                    <p className="text-xs text-muted-foreground">{t('cache.sizeMismatches')}</p>
                  </div>
                </div>
              </div>

              {cacheVerification.details.length > 0 && (
                <Collapsible>
                  <CollapsibleTrigger asChild>
                    <Button variant="ghost" size="sm" className="w-full justify-between">
                      {t('cache.issueDetails')} ({totalIssues})
                      <ChevronDown className="h-4 w-4" />
                    </Button>
                  </CollapsibleTrigger>
                  <CollapsibleContent className="mt-2">
                    <div className="rounded-md border max-h-48 overflow-y-auto">
                      {cacheVerification.details.map((issue, index) => (
                        <div key={index} className="flex items-start gap-2 p-2 text-sm border-b last:border-b-0">
                          <AlertTriangle className="h-4 w-4 text-orange-500 mt-0.5 flex-shrink-0" />
                          <div className="min-w-0">
                            <p className="font-medium truncate">{issue.entry_key}</p>
                            <p className="text-muted-foreground text-xs">{issue.description}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              )}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">{t('cache.noIssues')}</p>
          )}
        </CardContent>
      </Card>

      {/* Row 4: Cache Settings */}
      <Card>
        <Collapsible open={settingsOpen} onOpenChange={setSettingsOpen}>
          <CardHeader className="pb-2">
            <CollapsibleTrigger asChild>
              <div className="flex items-center justify-between cursor-pointer">
                <div className="flex items-center gap-2">
                  <Settings className="h-5 w-5" />
                  <CardTitle className="text-base">{t('cache.settings')}</CardTitle>
                </div>
                <ChevronDown className={`h-4 w-4 transition-transform ${settingsOpen ? 'rotate-180' : ''}`} />
              </div>
            </CollapsibleTrigger>
            <CardDescription>{t('cache.settingsDesc')}</CardDescription>
          </CardHeader>
          <CollapsibleContent>
            <CardContent className="space-y-6">
              <Separator />
              
              {loading && !localSettings ? (
                <div className="space-y-4">
                  <Skeleton className="h-10 w-full" />
                  <Skeleton className="h-10 w-full" />
                  <Skeleton className="h-6 w-32" />
                </div>
              ) : localSettings ? (
                <>
                  <div className="grid gap-6 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="maxSize">{t('cache.maxSize')}</Label>
                      <div className="flex items-center gap-2">
                        <Input
                          id="maxSize"
                          type="number"
                          min={100}
                          max={100000}
                          value={Math.round(localSettings.max_size / (1024 * 1024))}
                          onChange={(e) => {
                          const val = parseInt(e.target.value);
                          if (!isNaN(val) && val >= 100) {
                            handleSettingsChange('max_size', val * 1024 * 1024);
                          }
                        }}
                          className="w-32"
                        />
                        <span className="text-sm text-muted-foreground">MB</span>
                      </div>
                      <p className="text-xs text-muted-foreground">{t('cache.maxSizeDesc')}</p>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="maxAge">{t('cache.maxAge')}</Label>
                      <div className="flex items-center gap-2">
                        <Input
                          id="maxAge"
                          type="number"
                          min={1}
                          max={365}
                          value={localSettings.max_age_days}
                          onChange={(e) => {
                          const val = parseInt(e.target.value);
                          if (!isNaN(val) && val >= 1) {
                            handleSettingsChange('max_age_days', val);
                          }
                        }}
                          className="w-32"
                        />
                        <span className="text-sm text-muted-foreground">days</span>
                      </div>
                      <p className="text-xs text-muted-foreground">{t('cache.maxAgeDesc')}</p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label htmlFor="autoClean">{t('cache.autoClean')}</Label>
                      <p className="text-xs text-muted-foreground">{t('cache.autoCleanDesc')}</p>
                    </div>
                    <Switch
                      id="autoClean"
                      checked={localSettings.auto_clean}
                      onCheckedChange={(checked) => handleSettingsChange('auto_clean', checked)}
                    />
                  </div>

                  {settingsDirty && (
                    <div className="flex justify-end">
                      <Button
                        onClick={handleSaveSettings}
                        disabled={isSavingSettings}
                      >
                        {isSavingSettings ? t('common.loading') : t('common.save')}
                      </Button>
                    </div>
                  )}
                </>
              ) : null}
            </CardContent>
          </CollapsibleContent>
        </Collapsible>
      </Card>
    </div>
  );
}
