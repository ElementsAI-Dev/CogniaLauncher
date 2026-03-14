'use client';

import { useLocale } from '@/components/providers/locale-provider';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Alert, AlertDescription } from '@/components/ui/alert';
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
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
import { AlertCircle, FolderOpen, RefreshCw, Trash2 } from 'lucide-react';
import type { CacheEntryItem } from '@/lib/tauri';
import { ENTRIES_PER_PAGE } from '@/lib/constants/cache';
import type { CacheBrowserTypeFilter } from '@/types/cache';

export interface CacheBrowserDialogProps {
  browserOpen: boolean;
  setBrowserOpen: (open: boolean) => void;
  browserEntries: CacheEntryItem[];
  browserTotalCount: number;
  browserLoading: boolean;
  browserDeleting: boolean;
  browserSearch: string;
  setBrowserSearch: (value: string) => void;
  browserTypeFilter: CacheBrowserTypeFilter;
  setBrowserTypeFilter: (value: CacheBrowserTypeFilter) => void;
  browserSortBy: string;
  setBrowserSortBy: (value: string) => void;
  browserPage: number;
  setBrowserPage: (value: number) => void;
  browserSelectedKeys: Set<string>;
  setBrowserSelectedKeys: (value: Set<string>) => void;
  browserError: string | null;
  useTrash: boolean;
  setUseTrash: (value: boolean) => void;
  fetchBrowserEntries: (reset?: boolean, page?: number) => void;
  handleRetryBrowser: () => void;
  handleDeleteSelectedEntries: () => void;
}

export function CacheBrowserDialog({
  browserOpen,
  setBrowserOpen,
  browserEntries,
  browserTotalCount,
  browserLoading,
  browserDeleting,
  browserSearch,
  setBrowserSearch,
  browserTypeFilter,
  setBrowserTypeFilter,
  browserSortBy,
  setBrowserSortBy,
  browserPage,
  setBrowserPage,
  browserSelectedKeys,
  setBrowserSelectedKeys,
  browserError,
  useTrash,
  setUseTrash,
  fetchBrowserEntries,
  handleRetryBrowser,
  handleDeleteSelectedEntries,
}: CacheBrowserDialogProps) {
  const { t } = useLocale();

  const selectedOnPage = browserEntries.reduce((acc, e) => acc + (browserSelectedKeys.has(e.key) ? 1 : 0), 0);
  const isAllSelected = browserEntries.length > 0 && selectedOnPage === browserEntries.length;
  const isIndeterminate = selectedOnPage > 0 && selectedOnPage < browserEntries.length;
  const headerChecked: boolean | 'indeterminate' = isAllSelected ? true : isIndeterminate ? 'indeterminate' : false;
  const disableInteractions = browserLoading || browserDeleting;

  const from = browserTotalCount === 0 ? 0 : browserPage * ENTRIES_PER_PAGE + 1;
  const to = browserTotalCount === 0 ? 0 : Math.min((browserPage + 1) * ENTRIES_PER_PAGE, browserTotalCount);

  return (
    <Dialog open={browserOpen} onOpenChange={setBrowserOpen}>
      <DialogContent className="max-w-4xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FolderOpen className="h-5 w-5" />
            {t('cache.browseEntries')}
          </DialogTitle>
          <DialogDescription>
            {t('cache.browseEntriesDesc')}
          </DialogDescription>
        </DialogHeader>

        {/* Filters */}
        <div className="flex flex-wrap gap-2 items-center">
          <Input
            placeholder={t('cache.searchPlaceholder')}
            value={browserSearch}
            onChange={(e) => setBrowserSearch(e.target.value)}
            className="max-w-xs"
            disabled={disableInteractions}
          />
          <Select value={browserTypeFilter} onValueChange={setBrowserTypeFilter}>
            <SelectTrigger className="w-[140px]">
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
          <Select value={browserSortBy} onValueChange={setBrowserSortBy}>
            <SelectTrigger className="w-[160px]">
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
            size="sm"
            onClick={() => fetchBrowserEntries(true)}
            disabled={disableInteractions}
          >
            <RefreshCw className={`h-4 w-4 ${browserLoading ? 'animate-spin' : ''}`} />
          </Button>
        </div>

        {browserError && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription className="flex items-center justify-between gap-3">
              <span>{browserError}</span>
              <Button variant="outline" size="sm" onClick={handleRetryBrowser}>
                <RefreshCw className="h-3 w-3 mr-1" />
                {t('common.retry')}
              </Button>
            </AlertDescription>
          </Alert>
        )}

        {/* Entry List */}
        <ScrollArea className="h-[400px] rounded-md border">
          {browserLoading ? (
            <div className="p-4 space-y-2">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : browserEntries.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              {t('cache.noEntries')}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">
                    <Checkbox
                      checked={headerChecked}
                      disabled={disableInteractions || browserEntries.length === 0}
                      onCheckedChange={(checked) => {
                        if (checked === true) {
                          setBrowserSelectedKeys(new Set(browserEntries.map(e => e.key)));
                        } else {
                          setBrowserSelectedKeys(new Set());
                        }
                      }}
                    />
                  </TableHead>
                  <TableHead>{t('cache.entryKey')}</TableHead>
                  <TableHead>{t('cache.entryType')}</TableHead>
                  <TableHead>{t('cache.entrySize')}</TableHead>
                  <TableHead>{t('cache.entryHits')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {browserEntries.map((entry) => (
                  <TableRow key={entry.key}>
                    <TableCell>
                      <Checkbox
                        checked={browserSelectedKeys.has(entry.key)}
                        disabled={disableInteractions}
                        onCheckedChange={(checked) => {
                          const newSet = new Set(browserSelectedKeys);
                          if (checked === true) {
                            newSet.add(entry.key);
                          } else {
                            newSet.delete(entry.key);
                          }
                          setBrowserSelectedKeys(newSet);
                        }}
                      />
                    </TableCell>
                    <TableCell className="max-w-xs truncate" title={entry.key}>
                      {entry.key.split('/').pop() || entry.key}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{entry.entry_type}</Badge>
                    </TableCell>
                    <TableCell>{entry.size_human}</TableCell>
                    <TableCell>{entry.hit_count}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </ScrollArea>

        {/* Pagination & Actions */}
        <div className="flex items-center justify-between">
          <div className="text-sm text-muted-foreground">
            {t('cache.showingEntries', {
              from,
              to,
              total: browserTotalCount,
            })}
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={disableInteractions || browserPage === 0}
              onClick={() => {
                const newPage = browserPage - 1;
                setBrowserPage(newPage);
                fetchBrowserEntries(false, newPage);
              }}
            >
              {t('common.previous')}
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={disableInteractions || (browserPage + 1) * ENTRIES_PER_PAGE >= browserTotalCount}
              onClick={() => {
                const newPage = browserPage + 1;
                setBrowserPage(newPage);
                fetchBrowserEntries(false, newPage);
              }}
            >
              {t('common.next')}
            </Button>
          </div>
        </div>

        <DialogFooter>
          <div className="flex items-center gap-2">
            <Switch
              id="browser-trash"
              checked={useTrash}
              onCheckedChange={setUseTrash}
              disabled={disableInteractions}
            />
            <Label htmlFor="browser-trash" className="text-sm">
              {t('cache.moveToTrash')}
            </Label>
          </div>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                variant="destructive"
                disabled={disableInteractions || browserSelectedKeys.size === 0}
              >
                <Trash2 className="h-4 w-4 mr-2" />
                {t('cache.deleteSelected', { count: browserSelectedKeys.size })}
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>{t('cache.deleteEntriesConfirmTitle')}</AlertDialogTitle>
                <AlertDialogDescription>
                  {t('cache.deleteEntriesConfirmDesc', { count: browserSelectedKeys.size })}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleDeleteSelectedEntries}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  {t('cache.deleteSelected', { count: browserSelectedKeys.size })}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
