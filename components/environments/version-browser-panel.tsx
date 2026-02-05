'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { Checkbox } from '@/components/ui/checkbox';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { useLocale } from '@/components/providers/locale-provider';
import { useEnvironmentStore } from '@/lib/stores/environment';
import type { VersionInfo } from '@/lib/tauri';
import * as tauri from '@/lib/tauri';
import { Search, Download, Calendar, AlertTriangle, X, Filter, RefreshCw, AlertCircle, Trash2, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface VersionBrowserPanelProps {
  envType: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onInstall: (version: string, providerId?: string) => Promise<void>;
  onUninstall?: (version: string) => Promise<void>;
  installedVersions: string[];
  providerId?: string;
}

type VersionFilter = 'all' | 'stable' | 'lts' | 'latest';

export function VersionBrowserPanel({
  envType,
  open,
  onOpenChange,
  onInstall,
  onUninstall,
  installedVersions,
  providerId,
}: VersionBrowserPanelProps) {
  const { t } = useLocale();
  const { availableVersions, setAvailableVersions, selectedVersions, toggleVersionSelection, clearVersionSelection } = useEnvironmentStore();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filter, setFilter] = useState<VersionFilter>('all');
  const [installingVersion, setInstallingVersion] = useState<string | null>(null);
  const [batchProcessing, setBatchProcessing] = useState(false);

  // Get selected versions for this environment type
  const selectedForEnv = useMemo(() => 
    selectedVersions.filter(sv => sv.envType === envType).map(sv => sv.version),
    [selectedVersions, envType]
  );

  const isVersionSelected = useCallback((version: string) => 
    selectedForEnv.includes(version),
    [selectedForEnv]
  );

  const handleToggleSelection = useCallback((version: string) => {
    toggleVersionSelection(envType, version);
  }, [envType, toggleVersionSelection]);

  // Batch install selected versions
  const handleBatchInstall = useCallback(async () => {
    const toInstall = selectedForEnv.filter(v => !installedVersions.includes(v));
    if (toInstall.length === 0) return;

    setBatchProcessing(true);
    const successful: string[] = [];
    const failed: string[] = [];

    try {
      for (const version of toInstall) {
        setInstallingVersion(version);
        try {
          await onInstall(version, providerId);
          successful.push(version);
        } catch {
          failed.push(version);
        }
      }

      if (successful.length > 0) {
        toast.success(t('environments.batchInstallSuccess', { count: successful.length }));
      }
      if (failed.length > 0) {
        toast.error(t('environments.batchInstallError', { count: failed.length }));
      }

      if (failed.length === 0) {
        clearVersionSelection();
      } else {
        successful.forEach((version) => {
          toggleVersionSelection(envType, version);
        });
      }
    } finally {
      setBatchProcessing(false);
      setInstallingVersion(null);
    }
  }, [selectedForEnv, installedVersions, onInstall, clearVersionSelection, t, providerId, toggleVersionSelection, envType]);

  // Batch uninstall selected versions
  const handleBatchUninstall = useCallback(async () => {
    if (!onUninstall) return;
    const toUninstall = selectedForEnv.filter(v => installedVersions.includes(v));
    if (toUninstall.length === 0) return;

    setBatchProcessing(true);
    const successful: string[] = [];
    const failed: string[] = [];

    try {
      for (const version of toUninstall) {
        try {
          await onUninstall(version);
          successful.push(version);
        } catch {
          failed.push(version);
        }
      }

      if (successful.length > 0) {
        toast.success(t('environments.batchUninstallSuccess', { count: successful.length }));
      }
      if (failed.length > 0) {
        toast.error(t('environments.batchUninstallError', { count: failed.length }));
      }

      if (failed.length === 0) {
        clearVersionSelection();
      } else {
        successful.forEach((version) => {
          toggleVersionSelection(envType, version);
        });
      }
    } finally {
      setBatchProcessing(false);
    }
  }, [selectedForEnv, installedVersions, onUninstall, clearVersionSelection, t, toggleVersionSelection, envType]);

  // Count installable and uninstallable selected versions
  const installableCount = useMemo(() => 
    selectedForEnv.filter(v => !installedVersions.includes(v)).length,
    [selectedForEnv, installedVersions]
  );
  const uninstallableCount = useMemo(() => 
    selectedForEnv.filter(v => installedVersions.includes(v)).length,
    [selectedForEnv, installedVersions]
  );

  const versions = useMemo(() => availableVersions[envType] || [], [availableVersions, envType]);

  const fetchVersions = useCallback(async (force = false) => {
    if (versions.length > 0 && !force) return;
    setLoading(true);
    setError(null);
    try {
      const result = await tauri.envAvailableVersions(envType);
      setAvailableVersions(envType, result);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      setError(errorMsg);
      toast.error(t('environments.versionBrowser.fetchError'));
    } finally {
      setLoading(false);
    }
  }, [envType, versions.length, setAvailableVersions, t]);

  const handleRefresh = () => {
    fetchVersions(true);
  };

  useEffect(() => {
    if (open) {
      fetchVersions();
    }
  }, [open, fetchVersions]);

  const handleInstall = async (version: string) => {
    setInstallingVersion(version);
    try {
      await onInstall(version, providerId);
    } finally {
      setInstallingVersion(null);
    }
  };

  // Helper to check if a Node.js version is LTS (even major versions)
  const isNodeLtsVersion = useCallback((version: string): boolean => {
    const match = version.match(/^v?(\d+)/);
    if (!match) return false;
    const majorVersion = parseInt(match[1], 10);
    // Node.js LTS versions are even-numbered major versions >= 4
    return majorVersion >= 4 && majorVersion % 2 === 0;
  }, []);

  // Helper to check if version is LTS for any environment type
  const isLtsVersion = useCallback((version: string): boolean => {
    // Check if version string explicitly contains 'lts'
    if (version.toLowerCase().includes('lts')) return true;
    
    // For Node.js, LTS versions are even major versions
    if (envType.toLowerCase() === 'node') {
      return isNodeLtsVersion(version);
    }
    
    // For Python, LTS-like versions are typically x.x.0 releases with extended support
    // For now, treat all stable versions as potentially LTS for other languages
    return true;
  }, [envType, isNodeLtsVersion]);

  // Memoized filtered versions with clear logic for each filter type
  const displayVersions = useMemo(() => {
    // Handle 'latest' filter - return only the first non-deprecated/yanked version
    if (filter === 'latest') {
      const latest = versions.find(v => !v.deprecated && !v.yanked);
      return latest ? [latest] : [];
    }

    // Filter versions based on search query and filter type
    return versions.filter((v) => {
      // Apply search query filter
      if (searchQuery && !v.version.toLowerCase().includes(searchQuery.toLowerCase())) {
        return false;
      }

      // Apply status-based filters
      switch (filter) {
        case 'stable':
          return !v.deprecated && !v.yanked;
        case 'lts':
          return !v.deprecated && !v.yanked && isLtsVersion(v.version);
        case 'all':
        default:
          return true;
      }
    });
  }, [versions, searchQuery, filter, isLtsVersion]);

  const isInstalled = (version: string) => installedVersions.includes(version);

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return null;
    try {
      return new Date(dateStr).toLocaleDateString();
    } catch {
      return dateStr;
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-[400px] sm:w-[480px] p-0 flex flex-col">
        <SheetHeader className="p-6 pb-4 border-b">
          <div className="flex items-center justify-between">
            <div>
              <SheetTitle className="text-lg">
                {t('environments.versionBrowser.title').replace('{type}', envType)}
              </SheetTitle>
              <SheetDescription>
                {t('environments.versionBrowser.description')}
              </SheetDescription>
            </div>
            <Button
              variant="outline"
              size="icon"
              onClick={handleRefresh}
              disabled={loading}
              className="h-8 w-8"
            >
              <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
            </Button>
          </div>
        </SheetHeader>

        <div className="p-4 border-b space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder={t('environments.versionBrowser.searchPlaceholder')}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 pr-9"
            />
            {searchQuery && (
              <Button
                variant="ghost"
                size="icon"
                className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7"
                onClick={() => setSearchQuery('')}
              >
                <X className="h-3 w-3" />
              </Button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <ToggleGroup
              type="single"
              value={filter}
              onValueChange={(value) => value && setFilter(value as VersionFilter)}
              className="flex gap-1"
            >
              {(['all', 'stable', 'lts', 'latest'] as VersionFilter[]).map((f) => (
                <ToggleGroupItem
                  key={f}
                  value={f}
                  size="sm"
                  className="h-7 text-xs px-3"
                >
                  {t(`environments.versionBrowser.filter.${f}`)}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          </div>
        </div>

        <ScrollArea className="flex-1">
          <div className="p-4 space-y-2">
            {error ? (
              <div className="text-center py-8 space-y-3">
                <AlertCircle className="h-10 w-10 text-destructive mx-auto" />
                <p className="text-destructive">{error}</p>
                <Button variant="outline" size="sm" onClick={handleRefresh}>
                  <RefreshCw className="h-4 w-4 mr-2" />
                  {t('common.refresh')}
                </Button>
              </div>
            ) : loading ? (
              // Dynamic skeleton count based on estimated visible items
              // Each item is approximately 72px, viewport estimate ~400px
              Array.from({ length: Math.max(4, Math.min(10, Math.floor(400 / 72))) }).map((_, i) => (
                <div key={i} className="flex items-center justify-between p-3 rounded-lg border animate-pulse">
                  <div className="space-y-2">
                    <Skeleton className="h-5 w-24" />
                    <Skeleton className="h-3 w-32" />
                  </div>
                  <Skeleton className="h-8 w-20" />
                </div>
              ))
            ) : displayVersions.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <p>{t('environments.versionBrowser.noVersions')}</p>
              </div>
            ) : (
              displayVersions.map((version) => (
                <VersionItem
                  key={version.version}
                  version={version}
                  installed={isInstalled(version.version)}
                  installing={installingVersion === version.version}
                  selected={isVersionSelected(version.version)}
                  onInstall={() => handleInstall(version.version)}
                  onToggleSelect={() => handleToggleSelection(version.version)}
                  formatDate={formatDate}
                  t={t}
                />
              ))
            )}
          </div>
        </ScrollArea>

        <div className="p-4 border-t bg-muted/30">
          <p className="text-xs text-muted-foreground text-center">
            {t('environments.versionBrowser.totalVersions').replace('{count}', String(displayVersions.length))}
          </p>
        </div>

        {/* Batch Operations Floating Bar */}
        {selectedForEnv.length > 0 && (
          <div className="absolute bottom-20 left-1/2 -translate-x-1/2 bg-card border rounded-lg shadow-lg p-3 flex items-center gap-3 z-50">
            <span className="text-sm font-medium">
              {t('environments.selectedVersions').replace('{count}', String(selectedForEnv.length))}
            </span>
            <div className="h-4 w-px bg-border" />
            {installableCount > 0 && (
              <Button
                size="sm"
                disabled={batchProcessing}
                onClick={handleBatchInstall}
              >
                {batchProcessing ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-1" />
                ) : (
                  <Download className="h-4 w-4 mr-1" />
                )}
                {t('common.install')} ({installableCount})
              </Button>
            )}
            {uninstallableCount > 0 && onUninstall && (
              <Button
                size="sm"
                variant="destructive"
                disabled={batchProcessing}
                onClick={handleBatchUninstall}
              >
                <Trash2 className="h-4 w-4 mr-1" />
                {t('common.uninstall')} ({uninstallableCount})
              </Button>
            )}
            <Button
              size="sm"
              variant="ghost"
              onClick={clearVersionSelection}
              disabled={batchProcessing}
            >
              {t('common.clear')}
            </Button>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

interface VersionItemProps {
  version: VersionInfo;
  installed: boolean;
  installing: boolean;
  selected: boolean;
  onInstall: () => void;
  onToggleSelect: () => void;
  formatDate: (date: string | null) => string | null;
  t: (key: string) => string;
}

function VersionItem({ version, installed, installing, selected, onInstall, onToggleSelect, formatDate, t }: VersionItemProps) {
  return (
    <div
      className={cn(
        'flex items-center justify-between p-3 rounded-lg border transition-colors',
        installed && 'bg-green-50 dark:bg-green-950 border-green-200 dark:border-green-800',
        selected && 'border-primary bg-primary/5',
        version.deprecated && 'opacity-60',
        version.yanked && 'opacity-40'
      )}
    >
      <div className="flex items-center gap-3">
        <Checkbox
          checked={selected}
          onCheckedChange={onToggleSelect}
          disabled={version.yanked}
        />
        <div className="space-y-1">
        <div className="flex items-center gap-2">
          <span className="font-mono font-medium">{version.version}</span>
          {installed && (
            <Badge variant="default" className="text-xs h-5">
              {t('environments.versionBrowser.installed')}
            </Badge>
          )}
          {version.deprecated && (
            <Badge variant="secondary" className="text-xs h-5 gap-1">
              <AlertTriangle className="h-3 w-3" />
              {t('environments.versionBrowser.deprecated')}
            </Badge>
          )}
          {version.yanked && (
            <Badge variant="destructive" className="text-xs h-5">
              {t('environments.versionBrowser.yanked')}
            </Badge>
          )}
        </div>
          {version.release_date && (
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <Calendar className="h-3 w-3" />
              <span>{formatDate(version.release_date)}</span>
            </div>
          )}
        </div>
      </div>

      <Button
        size="sm"
        variant={installed ? 'outline' : 'default'}
        disabled={installed || installing || version.yanked}
        onClick={onInstall}
        className="gap-1"
      >
        {installing ? (
          <span className="animate-pulse">{t('environments.installing')}</span>
        ) : installed ? (
          t('environments.versionBrowser.installed')
        ) : (
          <>
            <Download className="h-3 w-3" />
            {t('common.install')}
          </>
        )}
      </Button>
    </div>
  );
}
