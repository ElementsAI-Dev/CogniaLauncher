'use client';

import { useLocale } from '@/components/providers/locale-provider';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty';
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
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  Database,
  RefreshCw,
  Search,
  Trash2,
} from 'lucide-react';
import type { CacheEntryItem } from '@/lib/tauri';
import { ENTRIES_PER_PAGE } from '@/lib/constants/cache';
import type { CacheBrowserTypeFilter } from '@/types/cache';

export interface CacheBrowserPanelProps {
  entries: CacheEntryItem[];
  totalCount: number;
  loading: boolean;
  deleting: boolean;
  search: string;
  onSearchChange: (value: string) => void;
  typeFilter: CacheBrowserTypeFilter;
  onTypeFilterChange: (value: CacheBrowserTypeFilter) => void;
  sortBy: string;
  onSortByChange: (value: string) => void;
  page: number;
  onPageChange: (value: number) => void;
  selectedKeys: Set<string>;
  onSelectedKeysChange: (value: Set<string>) => void;
  error: string | null;
  useTrash: boolean;
  onUseTrashChange: (value: boolean) => void;
  onFetchEntries: (reset?: boolean, page?: number) => void;
  onRetry: () => void;
  onDeleteSelected: () => void;
}

export function CacheBrowserPanel({
  entries,
  totalCount,
  loading,
  deleting,
  search,
  onSearchChange,
  typeFilter,
  onTypeFilterChange,
  sortBy,
  onSortByChange,
  page,
  onPageChange,
  selectedKeys,
  onSelectedKeysChange,
  error,
  useTrash,
  onUseTrashChange,
  onFetchEntries,
  onRetry,
  onDeleteSelected,
}: CacheBrowserPanelProps) {
  const { t } = useLocale();

  const selectedOnPage = entries.reduce(
    (acc, e) => acc + (selectedKeys.has(e.key) ? 1 : 0),
    0,
  );
  const isAllSelected = entries.length > 0 && selectedOnPage === entries.length;
  const isIndeterminate = selectedOnPage > 0 && selectedOnPage < entries.length;
  const headerChecked: boolean | 'indeterminate' = isAllSelected
    ? true
    : isIndeterminate
      ? 'indeterminate'
      : false;
  const disableInteractions = loading || deleting;
  const totalPages = Math.max(1, Math.ceil(totalCount / ENTRIES_PER_PAGE));
  const from = totalCount === 0 ? 0 : page * ENTRIES_PER_PAGE + 1;
  const to = totalCount === 0 ? 0 : Math.min((page + 1) * ENTRIES_PER_PAGE, totalCount);

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-50">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder={t('cache.searchPlaceholder')}
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            className="pl-9"
            disabled={disableInteractions}
          />
        </div>
        <Select value={typeFilter} onValueChange={onTypeFilterChange}>
          <SelectTrigger className="w-35">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('cache.allTypes')}</SelectItem>
            <SelectItem value="download">{t('cache.typeDownload')}</SelectItem>
            <SelectItem value="metadata">{t('cache.typeMetadata')}</SelectItem>
            <SelectItem value="partial">{t('cache.typePartial')}</SelectItem>
            <SelectItem value="index">{t('cache.typeIndex')}</SelectItem>
          </SelectContent>
        </Select>
        <Select value={sortBy} onValueChange={onSortByChange}>
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="created_desc">{t('cache.sortNewest')}</SelectItem>
            <SelectItem value="created_asc">{t('cache.sortOldest')}</SelectItem>
            <SelectItem value="size_desc">{t('cache.sortLargest')}</SelectItem>
            <SelectItem value="size_asc">{t('cache.sortSmallest')}</SelectItem>
            <SelectItem value="hits_desc">{t('cache.sortMostAccessed')}</SelectItem>
          </SelectContent>
        </Select>
        <Button
          variant="outline"
          size="icon"
          onClick={() => onFetchEntries(true)}
          disabled={disableInteractions}
        >
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
        </Button>
        <div className="flex items-center gap-2 ml-auto">
          <Switch
            id="browser-panel-trash"
            checked={useTrash}
            onCheckedChange={onUseTrashChange}
          />
          <Label htmlFor="browser-panel-trash" className="text-sm text-muted-foreground">
            {t('cache.useTrash')}
          </Label>
        </div>
      </div>

      {/* Batch actions bar */}
      {selectedKeys.size > 0 && (
        <div className="flex items-center gap-3 p-2.5 bg-muted/50 rounded-lg border">
          <span className="text-sm text-muted-foreground">
            {t('cache.detail.batchDelete', { count: selectedKeys.size })}
          </span>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" size="sm" disabled={deleting}>
                <Trash2 className="h-3.5 w-3.5 mr-1.5" />
                {deleting ? t('cache.clearing') : t('common.delete')}
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>{t('cache.deleteConfirmTitle')}</AlertDialogTitle>
                <AlertDialogDescription>
                  {t('cache.deleteConfirmDesc', { count: selectedKeys.size })}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
                <AlertDialogAction
                  onClick={onDeleteSelected}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  {t('common.delete')}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onSelectedKeysChange(new Set())}
          >
            {t('cache.detail.deselectAll')}
          </Button>
        </div>
      )}

      {/* Error */}
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription className="flex items-center justify-between gap-3">
            <span>{error}</span>
            <Button variant="outline" size="sm" onClick={onRetry}>
              <RefreshCw className="h-3 w-3 mr-1" />
              {t('common.retry')}
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          <ScrollArea className="h-130">
            {loading ? (
              <div className="p-4 space-y-3">
                {Array.from({ length: 8 }).map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : entries.length === 0 ? (
              <div className="py-12">
                <Empty className="border-none">
                  <EmptyHeader>
                    <EmptyMedia variant="icon">
                      <Database />
                    </EmptyMedia>
                    <EmptyTitle className="text-sm font-normal text-muted-foreground">
                      {t('cache.noEntries')}
                    </EmptyTitle>
                  </EmptyHeader>
                </Empty>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">
                      <Checkbox
                        checked={headerChecked}
                        disabled={disableInteractions || entries.length === 0}
                        onCheckedChange={(checked) => {
                          if (checked === true) {
                            onSelectedKeysChange(new Set(entries.map((e) => e.key)));
                          } else {
                            onSelectedKeysChange(new Set());
                          }
                        }}
                      />
                    </TableHead>
                    <TableHead>{t('cache.entryKey')}</TableHead>
                    <TableHead className="w-24">{t('cache.entryType')}</TableHead>
                    <TableHead className="w-24 text-right">{t('cache.entrySize')}</TableHead>
                    <TableHead className="w-16 text-right">{t('cache.entryHits')}</TableHead>
                    <TableHead className="w-44">{t('cache.detail.entryCreated')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {entries.map((entry) => (
                    <TableRow key={entry.key} className="hover:bg-muted/50">
                      <TableCell>
                        <Checkbox
                          checked={selectedKeys.has(entry.key)}
                          disabled={disableInteractions}
                          onCheckedChange={(checked) => {
                            const next = new Set(selectedKeys);
                            if (checked) {
                              next.add(entry.key);
                            } else {
                              next.delete(entry.key);
                            }
                            onSelectedKeysChange(next);
                          }}
                        />
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="font-mono text-xs truncate max-w-100" title={entry.key}>
                            {entry.key}
                          </span>
                          {entry.file_path && (
                            <span className="text-xs text-muted-foreground truncate max-w-100" title={entry.file_path}>
                              {entry.file_path}
                            </span>
                          )}
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
                        {entry.created_at ? new Date(entry.created_at).toLocaleString() : '—'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </ScrollArea>
        </CardContent>
      </Card>

      {/* Pagination */}
      {totalCount > 0 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            {t('cache.showingEntries', { from, to, total: totalCount })}
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              aria-label={t('common.previous')}
              disabled={page === 0}
              onClick={() => onPageChange(Math.max(0, page - 1))}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-sm text-muted-foreground">
              {page + 1} / {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              aria-label={t('common.next')}
              disabled={page >= totalPages - 1}
              onClick={() => onPageChange(page + 1)}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
