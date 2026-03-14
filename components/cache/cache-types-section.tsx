'use client';

import Link from 'next/link';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { useLocale } from '@/components/providers/locale-provider';
import { Download, FileText, FolderDown, Eye, Trash2 } from 'lucide-react';
import type { CacheInfo } from '@/lib/tauri';
import type { CleanType } from '@/types/cache';

export interface CacheTypesSectionProps {
  cacheInfo: CacheInfo | null;
  loading: boolean;
  isCleaning: boolean;
  cleaningType: string | null;
  onPreview: (type: CleanType) => void;
  previewLoading: boolean;
}

interface CacheTypeCardData {
  titleKey: string;
  descKey: string;
  icon: React.ElementType;
  cleanType: CleanType;
  detailHref: string;
  getSize: (info: CacheInfo) => string;
  getCount: (info: CacheInfo) => number;
  getAvailable?: (info: CacheInfo) => boolean;
  getLocation?: (info: CacheInfo) => string | null | undefined;
}

const CACHE_TYPES: CacheTypeCardData[] = [
  {
    titleKey: 'cache.downloadCache',
    descKey: 'cache.downloadCacheDesc',
    icon: Download,
    cleanType: 'downloads',
    detailHref: '/cache/download',
    getSize: (info) => info.download_cache.size_human,
    getCount: (info) => info.download_cache.entry_count,
  },
  {
    titleKey: 'cache.metadataCache',
    descKey: 'cache.metadataCacheDesc',
    icon: FileText,
    cleanType: 'metadata',
    detailHref: '/cache/metadata',
    getSize: (info) => info.metadata_cache.size_human,
    getCount: (info) => info.metadata_cache.entry_count,
  },
  {
    titleKey: 'cache.defaultDownloads',
    descKey: 'cache.defaultDownloadsDesc',
    icon: FolderDown,
    cleanType: 'default_downloads',
    detailHref: '',
    getSize: (info) => info.default_downloads?.size_human ?? '0 B',
    getCount: (info) => info.default_downloads?.entry_count ?? 0,
    getAvailable: (info) => info.default_downloads?.is_available ?? false,
    getLocation: (info) => info.default_downloads?.location,
  },
];

export function CacheTypesSection({
  cacheInfo,
  loading,
  isCleaning,
  cleaningType,
  onPreview,
  previewLoading,
}: CacheTypesSectionProps) {
  const { t } = useLocale();

  return (
    <div className="space-y-3">
      <div>
        <h3 className="text-sm font-medium">{t('cache.cacheTypesTitle')}</h3>
        <p className="text-xs text-muted-foreground">{t('cache.cacheTypesDesc')}</p>
      </div>
      <div className="grid gap-4 grid-cols-1 md:grid-cols-3">
        {CACHE_TYPES.map((type) => {
          const Icon = type.icon;
          const isAvailable = type.getAvailable ? (cacheInfo ? type.getAvailable(cacheInfo) : true) : true;
          const count = cacheInfo ? type.getCount(cacheInfo) : 0;
          const isThisCleaning = isCleaning && cleaningType === type.cleanType;

          return (
            <Card key={type.cleanType} className="relative overflow-hidden">
              <CardContent className="pt-5 pb-4 px-5">
                {loading && !cacheInfo ? (
                  <div className="space-y-3">
                    <Skeleton className="h-5 w-32" />
                    <Skeleton className="h-8 w-20" />
                    <Skeleton className="h-4 w-24" />
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary/10">
                          <Icon className="h-4 w-4 text-primary" />
                        </div>
                        <div>
                          <p className="text-sm font-medium leading-none">{t(type.titleKey)}</p>
                        </div>
                      </div>
                      {!isAvailable && (
                        <Badge variant="secondary" className="text-xs">
                          {t('cache.detail.externalUnavailable')}
                        </Badge>
                      )}
                    </div>

                    <div>
                      <p className="text-2xl font-bold">
                        {cacheInfo ? type.getSize(cacheInfo) : '0 B'}
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {t('cache.entriesCount', { count })}
                      </p>
                      {type.getLocation && cacheInfo && (
                        <p className="text-xs text-muted-foreground truncate mt-1" title={type.getLocation(cacheInfo) ?? undefined}>
                          {type.getLocation(cacheInfo)}
                        </p>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 text-xs"
                        disabled={previewLoading || count === 0 || !isAvailable}
                        onClick={() => onPreview(type.cleanType)}
                      >
                        {isThisCleaning ? (
                          <Trash2 className="h-3 w-3 mr-1 animate-spin" />
                        ) : (
                          <Eye className="h-3 w-3 mr-1" />
                        )}
                        {isThisCleaning ? t('cache.clearing') : t('cache.quickClean')}
                      </Button>
                      {type.detailHref && (
                        <Button variant="ghost" size="sm" className="h-7 text-xs" asChild>
                          <Link href={type.detailHref}>
                            {t('cache.viewDetails')}
                          </Link>
                        </Button>
                      )}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
