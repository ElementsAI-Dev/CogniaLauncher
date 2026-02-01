'use client';

import { useState, useEffect, useCallback } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { useLocale } from '@/components/providers/locale-provider';
import { useEnvironmentStore } from '@/lib/stores/environment';
import type { VersionInfo } from '@/lib/tauri';
import * as tauri from '@/lib/tauri';
import { Search, Download, Calendar, AlertTriangle, X, Filter, RefreshCw, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface VersionBrowserPanelProps {
  envType: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onInstall: (version: string) => Promise<void>;
  installedVersions: string[];
}

type VersionFilter = 'all' | 'stable' | 'lts' | 'latest';

export function VersionBrowserPanel({
  envType,
  open,
  onOpenChange,
  onInstall,
  installedVersions,
}: VersionBrowserPanelProps) {
  const { t } = useLocale();
  const { availableVersions, setAvailableVersions } = useEnvironmentStore();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filter, setFilter] = useState<VersionFilter>('all');
  const [installingVersion, setInstallingVersion] = useState<string | null>(null);

  const versions = availableVersions[envType] || [];

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
      await onInstall(version);
    } finally {
      setInstallingVersion(null);
    }
  };

  const filteredVersions = versions.filter((v) => {
    if (searchQuery && !v.version.toLowerCase().includes(searchQuery.toLowerCase())) {
      return false;
    }
    switch (filter) {
      case 'stable':
        if (v.deprecated || v.yanked) return false;
        break;
      case 'lts':
        if (v.deprecated || v.yanked) return false;
        if (!v.version.includes('lts') && !v.version.match(/^\d+\.\d+\.\d+$/)) return false;
        break;
      case 'latest':
        return false;
    }
    return true;
  });

  const latestVersion = filter === 'latest' 
    ? versions.find(v => !v.deprecated && !v.yanked) 
    : null;

  const displayVersions = filter === 'latest' && latestVersion 
    ? [latestVersion] 
    : filteredVersions;

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
            <div className="flex gap-1">
              {(['all', 'stable', 'lts', 'latest'] as VersionFilter[]).map((f) => (
                <Button
                  key={f}
                  variant={filter === f ? 'default' : 'outline'}
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => setFilter(f)}
                >
                  {t(`environments.versionBrowser.filter.${f}`)}
                </Button>
              ))}
            </div>
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
              Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="flex items-center justify-between p-3 rounded-lg border">
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
                  onInstall={() => handleInstall(version.version)}
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
      </SheetContent>
    </Sheet>
  );
}

interface VersionItemProps {
  version: VersionInfo;
  installed: boolean;
  installing: boolean;
  onInstall: () => void;
  formatDate: (date: string | null) => string | null;
  t: (key: string) => string;
}

function VersionItem({ version, installed, installing, onInstall, formatDate, t }: VersionItemProps) {
  return (
    <div
      className={cn(
        'flex items-center justify-between p-3 rounded-lg border transition-colors',
        installed && 'bg-green-50 dark:bg-green-950 border-green-200 dark:border-green-800',
        version.deprecated && 'opacity-60',
        version.yanked && 'opacity-40'
      )}
    >
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
