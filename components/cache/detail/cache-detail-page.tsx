'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
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
import { Switch } from '@/components/ui/switch';
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
import { toast } from 'sonner';
import { isTauri } from '@/lib/tauri';
import type {
  CacheEntryItem,
  CacheInfo,
  CacheAccessStats,
} from '@/lib/tauri';

import { CacheDetailExternalView } from './cache-detail-external';

interface CacheDetailPageClientProps {
  cacheType: string;
}

const ENTRIES_PER_PAGE = 20;

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
  const initializedRef = useRef(false);

  // Cache info state
  const [cacheInfo, setCacheInfo] = useState<CacheInfo | null>(null);
  const [accessStats, setAccessStats] = useState<CacheAccessStats | null>(null);

  // Entry browser state
  const [entries, setEntries] = useState<CacheEntryItem[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('created_desc');
  const [page, setPage] = useState(0);
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set());

  // Detail dialog state
  const [detailEntry, setDetailEntry] = useState<CacheEntryItem | null>(null);

  // Clean/verify state
  const [cleaning, setCleaning] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [useTrash, setUseTrash] = useState(true);
  const [cleanConfirmOpen, setCleanConfirmOpen] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);

  const titleKey = cacheType === 'download' ? 'cache.detail.downloadTitle' : 'cache.detail.metadataTitle';
  const descKey = cacheType === 'download' ? 'cache.detail.downloadDescription' : 'cache.detail.metadataDescription';
  const entryTypeFilter = cacheType === 'download' ? 'download' : 'metadata';

  // Fetch cache info
  const fetchInfo = useCallback(async () => {
    if (!isTauri()) return;
    try {
      const { cacheInfo: fetchCacheInfo, getCacheAccessStats } = await import('@/lib/tauri');
      const [info, stats] = await Promise.all([
        fetchCacheInfo(),
        getCacheAccessStats(),
      ]);
      setCacheInfo(info);
      setAccessStats(stats);
    } catch (err) {
      console.error('Failed to fetch cache info:', err);
    }
  }, []);

  // Fetch entries
  const fetchEntries = useCallback(async (resetPage = false) => {
    if (!isTauri()) return;
    setLoading(true);
    const currentPage = resetPage ? 0 : page;
    if (resetPage) setPage(0);

    try {
      const { listCacheEntries } = await import('@/lib/tauri');
      const result = await listCacheEntries({
        entryType: entryTypeFilter,
        search: searchQuery || undefined,
        sortBy,
        limit: ENTRIES_PER_PAGE,
        offset: currentPage * ENTRIES_PER_PAGE,
      });
      setEntries(result.entries);
      setTotalCount(result.total_count);
    } catch (err) {
      console.error('Failed to fetch cache entries:', err);
    } finally {
      setLoading(false);
    }
  }, [entryTypeFilter, searchQuery, sortBy, page]);

  // Initialize
  useEffect(() => {
    if (!initializedRef.current) {
      initializedRef.current = true;
      fetchInfo();
      fetchEntries();
    }
  }, [fetchInfo, fetchEntries]);

  // Refetch when filters change
  useEffect(() => {
    if (initializedRef.current) {
      fetchEntries(true);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchQuery, sortBy, entryTypeFilter]);

  // Refetch when page changes
  useEffect(() => {
    if (initializedRef.current) {
      fetchEntries();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);

  // Computed stats
  const cacheStats = cacheInfo
    ? cacheType === 'download'
      ? cacheInfo.download_cache
      : cacheInfo.metadata_cache
    : null;

  const totalPages = Math.ceil(totalCount / ENTRIES_PER_PAGE);

  // Actions
  const handleRefresh = async () => {
    await Promise.all([fetchInfo(), fetchEntries()]);
    toast.success(t('cache.refreshSuccess'));
  };

  const handleClean = async () => {
    if (!isTauri()) return;
    setCleaning(true);
    try {
      const { cacheCleanEnhanced } = await import('@/lib/tauri');
      const cleanType = cacheType === 'download' ? 'downloads' : 'metadata';
      const result = await cacheCleanEnhanced(cleanType, useTrash);
      toast.success(t('cache.freed', { size: result.freed_human }));
      setSelectedKeys(new Set());
      await Promise.all([fetchInfo(), fetchEntries(true)]);
    } catch (err) {
      toast.error(`${t('cache.clearCache')}: ${err}`);
    } finally {
      setCleaning(false);
      setCleanConfirmOpen(false);
    }
  };

  const handleVerify = async () => {
    if (!isTauri()) return;
    setVerifying(true);
    try {
      const { cacheVerify } = await import('@/lib/tauri');
      const result = await cacheVerify();
      if (result.is_healthy) {
        toast.success(t('cache.verifySuccess'));
      } else {
        const issueCount = result.missing_files + result.corrupted_files + result.size_mismatches;
        toast.warning(t('cache.verifyIssues', { count: issueCount }));
      }
    } catch (err) {
      toast.error(`Verification failed: ${err}`);
    } finally {
      setVerifying(false);
    }
  };

  const handleDeleteSelected = async () => {
    if (!isTauri() || selectedKeys.size === 0) return;
    try {
      const { deleteCacheEntries } = await import('@/lib/tauri');
      const keys = Array.from(selectedKeys);
      const deleted = await deleteCacheEntries(keys, useTrash);
      toast.success(t('cache.detail.batchDeleteSuccess', { count: deleted }));
      setSelectedKeys(new Set());
      await Promise.all([fetchInfo(), fetchEntries()]);
    } catch (err) {
      toast.error(`${t('cache.deleteEntriesFailed')}: ${err}`);
    } finally {
      setDeleteConfirmOpen(false);
    }
  };

  const handleDeleteSingle = async (key: string) => {
    if (!isTauri()) return;
    try {
      const { deleteCacheEntry } = await import('@/lib/tauri');
      await deleteCacheEntry(key, useTrash);
      toast.success(t('cache.detail.deleteEntrySuccess'));
      setDetailEntry(null);
      await Promise.all([fetchInfo(), fetchEntries()]);
    } catch (err) {
      toast.error(`${t('cache.detail.deleteEntryFailed')}: ${err}`);
    }
  };

  const handleCopyChecksum = (checksum: string) => {
    navigator.clipboard.writeText(checksum);
    toast.success(t('cache.detail.checksumCopied'));
  };

  const toggleSelectAll = () => {
    if (selectedKeys.size === entries.length) {
      setSelectedKeys(new Set());
    } else {
      setSelectedKeys(new Set(entries.map((e) => e.key)));
    }
  };

  const toggleSelectKey = (key: string) => {
    const next = new Set(selectedKeys);
    if (next.has(key)) {
      next.delete(key);
    } else {
      next.add(key);
    }
    setSelectedKeys(next);
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return t('cache.detail.neverAccessed');
    try {
      return new Date(dateStr).toLocaleString();
    } catch {
      return dateStr;
    }
  };

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
      </div>

      {/* Action Bar */}
      <div className="flex flex-wrap items-center gap-2">
        <Button
          variant="outline"
          onClick={() => setCleanConfirmOpen(true)}
          disabled={cleaning}
        >
          <Trash2 className="h-4 w-4 mr-2" />
          {cleaning ? t('cache.clearing') : t('cache.detail.cleanThisCache')}
        </Button>
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
        <div className="flex-1" />
        <div className="flex items-center gap-2 text-sm">
          <Switch checked={useTrash} onCheckedChange={setUseTrash} />
          <span className="text-muted-foreground">{t('cache.useTrash')}</span>
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
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                      <RefreshCw className="h-5 w-5 animate-spin inline-block mr-2" />
                      Loading...
                    </TableCell>
                  </TableRow>
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
