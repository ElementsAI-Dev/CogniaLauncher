'use client';

import Link from 'next/link';
import { useLocale } from '@/components/providers/locale-provider';
import { PageHeader } from '@/components/layout/page-header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Copy,
  Database,
  Download,
  FileText,
  FolderOpen,
  HardDrive,
  Package,
  RefreshCw,
  Search,
  Shield,
  ShieldCheck,
  Trash2,
  Zap,
} from 'lucide-react';
import { useCacheDetail } from '@/hooks/use-cache-detail';
import { ENTRIES_PER_PAGE } from '@/lib/constants/cache';
import type { CacheDetailPageClientProps } from '@/types/cache';

import { CacheDetailExternalView } from './cache-detail-external';

export function CacheDetailPageClient({ cacheType }: CacheDetailPageClientProps) {
  const { t } = useLocale();

  // Validate cache type
  const validTypes = ['download', 'metadata', 'external'];
  const isValidType = validTypes.includes(cacheType);

  if (!isValidType) {
    return (
      <div className="p-4 md:p-6 space-y-6">
        <PageHeader
          title={t('cache.title')}
          description={`Unknown cache type: ${cacheType}`}
          actions={
            <Button variant="outline" asChild>
              <Link href="/cache">
                <ArrowLeft className="h-4 w-4 mr-2" />
                {t('cache.detail.backToCache')}
              </Link>
            </Button>
          }
        />
      </div>
    );
  }

  if (cacheType === 'external') {
    return <CacheDetailExternalView />;
  }

  return <InternalCacheDetailView cacheType={cacheType as 'download' | 'metadata'} />;
}

// =============================================================================
// Internal Cache Detail View (download / metadata)
// =============================================================================

function InternalCacheDetailView({ cacheType }: { cacheType: 'download' | 'metadata' }) {
  const { t } = useLocale();

  const {
    cacheInfo,
    accessStats,
    entries,
    totalCount,
    loading,
    searchQuery,
    setSearchQuery,
    sortBy,
    setSortBy,
    page,
    setPage,
    selectedKeys,
    detailEntry,
    setDetailEntry,
    cleaning,
    verifying,
    useTrash,
    setUseTrash,
    cleanConfirmOpen,
    setCleanConfirmOpen,
    deleteConfirmOpen,
    setDeleteConfirmOpen,
    titleKey,
    descKey,
    cacheStats,
    totalPages,
    handleRefresh,
    handleClean,
    handleVerify,
    handleDeleteSelected,
    handleDeleteSingle,
    handleCopyChecksum,
    toggleSelectAll,
    toggleSelectKey,
    formatDate,
  } = useCacheDetail({ cacheType, t });

  const TypeIcon = cacheType === 'download' ? Download : FileText;

  return (
    <div className="p-4 md:p-6 space-y-6">
      {/* Header */}
      <PageHeader
        title={
          <span className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
              <TypeIcon className="h-5 w-5 text-primary" />
            </div>
            {t(titleKey)}
          </span>
        }
        description={t(descKey)}
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" asChild>
              <Link href="/cache">
                <ArrowLeft className="h-4 w-4 mr-2" />
                {t('cache.detail.backToCache')}
              </Link>
            </Button>
            <Button variant="outline" onClick={handleRefresh}>
              <RefreshCw className="h-4 w-4 mr-2" />
              {t('cache.refreshSuccess').split(' ')[0]}
            </Button>
          </div>
        }
      />

      {/* Stats Cards */}
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        {cacheInfo ? (
          <>
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                  <Database className="h-4 w-4" />
                  {t('cache.detail.entryCount', { count: cacheStats?.entry_count ?? 0 })}
                </div>
                <p className="text-2xl font-bold">{cacheStats?.entry_count ?? 0}</p>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                  <HardDrive className="h-4 w-4" />
                  {t('cache.detail.totalSize')}
                </div>
                <p className="text-2xl font-bold">{cacheStats?.size_human ?? '0 B'}</p>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                  <Zap className="h-4 w-4" />
                  {t('cache.hitRate')}
                </div>
                <p className="text-2xl font-bold">
                  {accessStats ? `${(accessStats.hit_rate * 100).toFixed(1)}%` : '—'}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {accessStats ? `${accessStats.hits} ${t('cache.hits')} / ${accessStats.misses} ${t('cache.misses')}` : ''}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                  <FolderOpen className="h-4 w-4" />
                  {t('cache.detail.storageLocation')}
                </div>
                <p className="text-sm font-mono truncate" title={cacheStats?.location ?? ''}>
                  {cacheStats?.location ?? '—'}
                </p>
              </CardContent>
            </Card>
          </>
        ) : (
          <>
            {[1, 2, 3, 4].map((i) => (
              <Card key={i}>
                <CardContent className="pt-6 space-y-2">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-8 w-20" />
                </CardContent>
              </Card>
            ))}
          </>
        )}
      </div>

      {/* Action Bar */}
      <div className="flex flex-wrap items-center gap-2">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="outline"
              onClick={() => setCleanConfirmOpen(true)}
              disabled={cleaning}
            >
              <Trash2 className="h-4 w-4 mr-2" />
              {cleaning ? t('cache.clearing') : t('cache.detail.cleanThisCache')}
            </Button>
          </TooltipTrigger>
          <TooltipContent>{t('cache.detail.cleanThisCache')}</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="outline"
              onClick={handleVerify}
              disabled={verifying}
            >
              {verifying ? (
                <Shield className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <ShieldCheck className="h-4 w-4 mr-2" />
              )}
              {verifying ? t('cache.detail.verifyingCache') : t('cache.detail.verifyThisCache')}
            </Button>
          </TooltipTrigger>
          <TooltipContent>{t('cache.detail.verifyThisCache')}</TooltipContent>
        </Tooltip>
        <div className="flex-1" />
        <div className="flex items-center gap-2 text-sm">
          <Switch id="detail-use-trash" checked={useTrash} onCheckedChange={setUseTrash} />
          <Label htmlFor="detail-use-trash" className="text-muted-foreground">{t('cache.useTrash')}</Label>
        </div>
      </div>

      {/* Entry Browser */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            {t('cache.detail.entryBrowser')}
          </CardTitle>
          <CardDescription>{t('cache.detail.entryBrowserDesc')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Search & Filter Bar */}
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder={t('cache.searchPlaceholder')}
                className="pl-9"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <Select value={sortBy} onValueChange={setSortBy}>
              <SelectTrigger className="w-[180px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="created_desc">{t('cache.sortNewest')}</SelectItem>
                <SelectItem value="created_asc">{t('cache.sortOldest')}</SelectItem>
                <SelectItem value="size_desc">{t('cache.sortLargest')}</SelectItem>
                <SelectItem value="size_asc">{t('cache.sortSmallest')}</SelectItem>
                <SelectItem value="hit_count_desc">{t('cache.sortMostAccessed')}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Batch Actions */}
          {selectedKeys.size > 0 && (
            <div className="flex items-center gap-3 p-2 bg-muted/50 rounded-lg">
              <Button variant="ghost" size="sm" onClick={toggleSelectAll}>
                {selectedKeys.size === entries.length
                  ? t('cache.detail.deselectAll')
                  : t('cache.detail.selectAll')}
              </Button>
              <Separator orientation="vertical" className="h-6" />
              <Button
                variant="destructive"
                size="sm"
                onClick={() => setDeleteConfirmOpen(true)}
              >
                <Trash2 className="h-4 w-4 mr-1" />
                {t('cache.detail.batchDelete', { count: selectedKeys.size })}
              </Button>
            </div>
          )}

          {/* Entry Table */}
          <ScrollArea className="max-h-[600px]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">
                    <Checkbox
                      checked={entries.length > 0 && selectedKeys.size === entries.length}
                      onCheckedChange={toggleSelectAll}
                    />
                  </TableHead>
                  <TableHead>{t('cache.detail.entryKey')}</TableHead>
                  <TableHead className="w-20">{t('cache.detail.entryType')}</TableHead>
                  <TableHead className="w-24 text-right">{t('cache.detail.entrySize')}</TableHead>
                  <TableHead className="w-16 text-right">{t('cache.detail.entryHitCount')}</TableHead>
                  <TableHead className="w-44">{t('cache.detail.entryCreated')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <>
                    {[1, 2, 3, 4, 5].map((i) => (
                      <TableRow key={i}>
                        <TableCell><Skeleton className="h-4 w-4" /></TableCell>
                        <TableCell><Skeleton className="h-4 w-48" /></TableCell>
                        <TableCell><Skeleton className="h-5 w-16" /></TableCell>
                        <TableCell><Skeleton className="h-4 w-14 ml-auto" /></TableCell>
                        <TableCell><Skeleton className="h-4 w-8 ml-auto" /></TableCell>
                        <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                      </TableRow>
                    ))}
                  </>
                ) : entries.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                      {t('cache.detail.noEntriesForType')}
                    </TableCell>
                  </TableRow>
                ) : (
                  entries.map((entry) => (
                    <TableRow
                      key={entry.key}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => setDetailEntry(entry)}
                    >
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <Checkbox
                          checked={selectedKeys.has(entry.key)}
                          onCheckedChange={() => toggleSelectKey(entry.key)}
                        />
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="font-mono text-xs truncate max-w-[300px]" title={entry.key}>
                            {entry.key}
                          </span>
                          <span className="text-xs text-muted-foreground truncate max-w-[300px]" title={entry.file_path}>
                            {entry.file_path}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs">
                          {entry.entry_type}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm">
                        {entry.size_human}
                      </TableCell>
                      <TableCell className="text-right text-sm">
                        {entry.hit_count}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {formatDate(entry.created_at)}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </ScrollArea>

          {/* Pagination */}
          {totalCount > 0 && (
            <div className="flex items-center justify-between pt-2">
              <p className="text-sm text-muted-foreground">
                {t('cache.showingEntries', {
                  from: page * ENTRIES_PER_PAGE + 1,
                  to: Math.min((page + 1) * ENTRIES_PER_PAGE, totalCount),
                  total: totalCount,
                })}
              </p>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page === 0}
                  onClick={() => setPage((p) => Math.max(0, p - 1))}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="text-sm text-muted-foreground">
                  {t('cache.detail.pageInfo', { current: page + 1, total: totalPages || 1 })}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page >= totalPages - 1}
                  onClick={() => setPage((p) => p + 1)}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Entry Detail Dialog */}
      <Dialog open={!!detailEntry} onOpenChange={(open) => { if (!open) setDetailEntry(null); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <TypeIcon className="h-5 w-5" />
              {t('cache.detail.entryDetails')}
            </DialogTitle>
            <DialogDescription className="font-mono text-xs break-all">
              {detailEntry?.key}
            </DialogDescription>
          </DialogHeader>
          {detailEntry && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-muted-foreground">{t('cache.detail.entryType')}</p>
                  <Badge variant="outline">{detailEntry.entry_type}</Badge>
                </div>
                <div>
                  <p className="text-muted-foreground">{t('cache.detail.entrySize')}</p>
                  <p className="font-mono">{detailEntry.size_human}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">{t('cache.detail.entryHitCount')}</p>
                  <p>{detailEntry.hit_count}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">{t('cache.detail.entryCreated')}</p>
                  <p className="text-xs">{formatDate(detailEntry.created_at)}</p>
                </div>
                <div className="col-span-2">
                  <p className="text-muted-foreground">{t('cache.detail.entryLastAccessed')}</p>
                  <p className="text-xs">{formatDate(detailEntry.last_accessed)}</p>
                </div>
              </div>

              <Separator />

              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">{t('cache.detail.entryPath')}</p>
                <p className="text-xs font-mono bg-muted/50 p-2 rounded break-all">
                  {detailEntry.file_path}
                </p>
              </div>

              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">{t('cache.detail.entryChecksum')}</p>
                <div className="flex items-center gap-2">
                  <p className="text-xs font-mono bg-muted/50 p-2 rounded break-all flex-1">
                    {detailEntry.checksum}
                  </p>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="shrink-0"
                    onClick={() => handleCopyChecksum(detailEntry.checksum)}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              <Separator />

              <div className="flex gap-2">
                <Button
                  variant="destructive"
                  size="sm"
                  className="flex-1"
                  onClick={() => handleDeleteSingle(detailEntry.key)}
                >
                  <Trash2 className="h-4 w-4 mr-1" />
                  {t('cache.detail.deleteEntry')}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Clean Confirm Dialog */}
      <AlertDialog open={cleanConfirmOpen} onOpenChange={setCleanConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t('cache.detail.cleanConfirmTitle', { type: cacheType })}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t('cache.detail.cleanConfirmDesc', { type: cacheType })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={handleClean} disabled={cleaning}>
              {cleaning ? t('cache.clearing') : t('cache.confirmClean')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Batch Delete Confirm Dialog */}
      <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t('cache.detail.batchDeleteConfirm', { count: selectedKeys.size })}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {useTrash ? t('cache.useTrashDesc') : t('cache.permanentDeleteDesc')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteSelected}>
              {t('common.confirm')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
