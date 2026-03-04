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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
import { FolderOpen, RefreshCw, Trash2 } from 'lucide-react';
import type { CacheEntryItem } from '@/lib/tauri';
import { ENTRIES_PER_PAGE } from '@/lib/constants/cache';

export interface CacheBrowserDialogProps {
  browserOpen: boolean;
  setBrowserOpen: (open: boolean) => void;
  browserEntries: CacheEntryItem[];
  browserTotalCount: number;
  browserLoading: boolean;
  browserSearch: string;
  setBrowserSearch: (value: string) => void;
  browserTypeFilter: string;
  setBrowserTypeFilter: (value: string) => void;
  browserSortBy: string;
  setBrowserSortBy: (value: string) => void;
  browserPage: number;
  setBrowserPage: (value: number) => void;
  browserSelectedKeys: Set<string>;
  setBrowserSelectedKeys: (value: Set<string>) => void;
  useTrash: boolean;
  setUseTrash: (value: boolean) => void;
  fetchBrowserEntries: (reset?: boolean, page?: number) => void;
  handleDeleteSelectedEntries: () => void;
}

export function CacheBrowserDialog({
  browserOpen,
  setBrowserOpen,
  browserEntries,
  browserTotalCount,
  browserLoading,
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
  useTrash,
  setUseTrash,
  fetchBrowserEntries,
  handleDeleteSelectedEntries,
}: CacheBrowserDialogProps) {
  const { t } = useLocale();

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
          />
          <Select value={browserTypeFilter} onValueChange={setBrowserTypeFilter}>
            <SelectTrigger className="w-[140px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">{t('cache.allTypes')}</SelectItem>
              <SelectItem value="download">{t('cache.typeDownload')}</SelectItem>
              <SelectItem value="metadata">{t('cache.typeMetadata')}</SelectItem>
              <SelectItem value="partial">{t('cache.typePartial')}</SelectItem>
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
            disabled={browserLoading}
          >
            <RefreshCw className={`h-4 w-4 ${browserLoading ? 'animate-spin' : ''}`} />
          </Button>
        </div>

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
                      checked={browserSelectedKeys.size === browserEntries.length && browserEntries.length > 0}
                      onCheckedChange={(checked) => {
                        if (checked) {
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
                        onCheckedChange={(checked) => {
                          const newSet = new Set(browserSelectedKeys);
                          if (checked) {
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
              from: browserPage * ENTRIES_PER_PAGE + 1,
              to: Math.min((browserPage + 1) * ENTRIES_PER_PAGE, browserTotalCount),
              total: browserTotalCount,
            })}
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={browserPage === 0}
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
              disabled={(browserPage + 1) * ENTRIES_PER_PAGE >= browserTotalCount}
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
            />
            <Label htmlFor="browser-trash" className="text-sm">
              {t('cache.moveToTrash')}
            </Label>
          </div>
          <Button
            variant="destructive"
            disabled={browserSelectedKeys.size === 0}
            onClick={handleDeleteSelectedEntries}
          >
            <Trash2 className="h-4 w-4 mr-2" />
            {t('cache.deleteSelected', { count: browserSelectedKeys.size })}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
