'use client';

import { useState, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  Download,
  RotateCcw,
  Calendar,
  Search,
  Layers,
  Loader2,
} from 'lucide-react';
import { useLocale } from '@/components/providers/locale-provider';
import type { VersionInfo } from '@/lib/tauri';

interface PackageVersionListProps {
  versions: VersionInfo[];
  currentVersion: string | null;
  isInstalled: boolean;
  isInstalling: boolean;
  onInstall: (version: string) => Promise<void>;
  onRollback: (version: string) => Promise<void>;
}

const VERSIONS_PER_PAGE = 30;

export function PackageVersionList({
  versions,
  currentVersion,
  isInstalled,
  isInstalling,
  onInstall,
  onRollback,
}: PackageVersionListProps) {
  const { t } = useLocale();
  const [search, setSearch] = useState('');
  const [displayCount, setDisplayCount] = useState(VERSIONS_PER_PAGE);
  const [actionVersion, setActionVersion] = useState<string | null>(null);

  const filteredVersions = useMemo(() => {
    if (!search.trim()) return versions;
    const term = search.toLowerCase();
    return versions.filter((v) => v.version.toLowerCase().includes(term));
  }, [versions, search]);

  const displayedVersions = useMemo(
    () => filteredVersions.slice(0, displayCount),
    [filteredVersions, displayCount]
  );

  const hasMore = displayCount < filteredVersions.length;
  const latestVersion = versions[0]?.version ?? null;

  const handleInstall = async (version: string) => {
    setActionVersion(version);
    try {
      await onInstall(version);
    } finally {
      setActionVersion(null);
    }
  };

  const handleRollback = async (version: string) => {
    setActionVersion(version);
    try {
      await onRollback(version);
    } finally {
      setActionVersion(null);
    }
  };

  if (versions.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <Layers className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
          <h3 className="font-medium mb-1">{t('packages.detail.noVersionsAvailable')}</h3>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Layers className="h-5 w-5" />
              {t('packages.detail.availableVersions')}
            </CardTitle>
            <CardDescription>
              {t('packages.detail.showingVersions', {
                count: displayedVersions.length,
                total: filteredVersions.length,
              })}
            </CardDescription>
          </div>
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder={t('packages.detail.allVersions')}
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setDisplayCount(VERSIONS_PER_PAGE);
              }}
              className="pl-8"
            />
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[500px]">
          <div className="space-y-1 pr-4">
            {displayedVersions.map((v) => {
              const isCurrent = v.version === currentVersion;
              const isLatest = v.version === latestVersion;
              const isActioning = actionVersion === v.version || (isInstalling && actionVersion === v.version);

              return (
                <div
                  key={v.version}
                  className={`
                    flex items-center justify-between py-2.5 px-3 rounded-lg
                    hover:bg-muted/50 transition-colors
                    ${isCurrent ? 'bg-primary/5 border border-primary/20' : ''}
                  `}
                >
                  {/* Version info */}
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="font-mono text-sm font-medium">{v.version}</span>
                    {isCurrent && (
                      <Badge variant="default" className="text-xs shrink-0">
                        {t('packages.detail.versionCurrent')}
                      </Badge>
                    )}
                    {isLatest && !isCurrent && (
                      <Badge variant="secondary" className="text-xs shrink-0">
                        {t('packages.detail.versionLatest')}
                      </Badge>
                    )}
                    {v.deprecated && (
                      <Badge variant="destructive" className="text-xs shrink-0">
                        {t('packages.detail.versionDeprecated')}
                      </Badge>
                    )}
                    {v.yanked && (
                      <Badge variant="outline" className="text-xs shrink-0 text-yellow-600 border-yellow-600/30">
                        {t('packages.detail.versionYanked')}
                      </Badge>
                    )}
                  </div>

                  {/* Date + Actions */}
                  <div className="flex items-center gap-2 shrink-0 ml-2">
                    {v.release_date && (
                      <span className="text-xs text-muted-foreground flex items-center gap-1 mr-2">
                        <Calendar className="h-3 w-3" />
                        {new Date(v.release_date).toLocaleDateString()}
                      </span>
                    )}

                    {/* Install or Rollback action */}
                    {!isCurrent && (
                      <>
                        {isInstalled && currentVersion ? (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-7 px-2"
                                disabled={isActioning || v.yanked}
                                onClick={() => handleRollback(v.version)}
                              >
                                {isActioning ? (
                                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                ) : (
                                  <RotateCcw className="h-3.5 w-3.5" />
                                )}
                                <span className="ml-1 text-xs">{t('packages.detail.rollbackToVersion')}</span>
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>{t('packages.detail.rollbackToVersion')}</TooltipContent>
                          </Tooltip>
                        ) : (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-7 px-2"
                                disabled={isActioning || v.yanked}
                                onClick={() => handleInstall(v.version)}
                              >
                                {isActioning ? (
                                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                ) : (
                                  <Download className="h-3.5 w-3.5" />
                                )}
                                <span className="ml-1 text-xs">{t('packages.detail.installThisVersion')}</span>
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>{t('packages.detail.installThisVersion')}</TooltipContent>
                          </Tooltip>
                        )}
                      </>
                    )}
                  </div>
                </div>
              );
            })}

            {hasMore && (
              <div className="pt-4 text-center">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setDisplayCount((prev) => prev + VERSIONS_PER_PAGE)}
                >
                  {t('packages.detail.loadMoreVersions')}
                </Button>
              </div>
            )}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
