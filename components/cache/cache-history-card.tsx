'use client';

import { useLocale } from '@/components/providers/locale-provider';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
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
import { useMemo, useState } from 'react';
import { writeClipboard } from '@/lib/clipboard';
import { formatCleanTypeLabel } from '@/lib/cache/scopes';
import { Download, History, ChevronDown, Clock, Copy, FileText, Recycle, Trash2 } from 'lucide-react';
import type { CleanupRecord, CleanupHistorySummary } from '@/lib/tauri';

export interface CacheHistoryCardProps {
  historyOpen: boolean;
  setHistoryOpen: (open: boolean) => void;
  cleanupHistory: CleanupRecord[];
  historySummary: CleanupHistorySummary | null;
  historyLoading: boolean;
  fetchCleanupHistory: () => void;
  handleClearHistory: () => void;
}

export function CacheHistoryCard({
  historyOpen,
  setHistoryOpen,
  cleanupHistory,
  historySummary,
  historyLoading,
  fetchCleanupHistory,
  handleClearHistory,
}: CacheHistoryCardProps) {
  const { t } = useLocale();
  const [detail, setDetail] = useState<CleanupRecord | null>(null);

  const hasHistory = cleanupHistory.length > 0;

  const csvText = useMemo(() => {
    if (!hasHistory) return '';

    const escape = (v: string) => `"${v.replaceAll('"', '""')}"`;
    const header = ['timestamp', 'clean_type', 'label', 'file_count', 'freed_human', 'use_trash', 'id']
      .map(escape)
      .join(',');
    const rows = cleanupHistory.map((r) => {
      const label = formatCleanTypeLabel(r.clean_type, t);
      return [
        r.timestamp,
        r.clean_type,
        label,
        String(r.file_count),
        r.freed_human,
        r.use_trash ? 'true' : 'false',
        r.id,
      ].map(escape).join(',');
    });
    return [header, ...rows].join('\n');
  }, [cleanupHistory, hasHistory, t]);

  const downloadText = (filename: string, text: string, mime: string) => {
    const blob = new Blob([text], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 0);
  };

  return (
    <Card>
      <Collapsible open={historyOpen} onOpenChange={(open) => {
        setHistoryOpen(open);
        if (open && cleanupHistory.length === 0) {
          fetchCleanupHistory();
        }
      }}>
        <CardHeader className="pb-2">
          <CollapsibleTrigger asChild>
            <div className="flex items-center justify-between cursor-pointer">
              <div className="flex items-center gap-2">
                <History className="h-5 w-5" />
                <CardTitle className="text-base">{t('cache.cleanupHistory')}</CardTitle>
                {historySummary && historySummary.total_cleanups > 0 && (
                  <Badge variant="secondary" className="ml-2">
                    {historySummary.total_cleanups} {t('cache.cleanups')}
                  </Badge>
                )}
              </div>
              <ChevronDown className={`h-4 w-4 transition-transform ${historyOpen ? 'rotate-180' : ''}`} />
            </div>
          </CollapsibleTrigger>
          <CardDescription>{t('cache.cleanupHistoryDesc')}</CardDescription>
        </CardHeader>
        <CollapsibleContent>
          <CardContent className="space-y-4">
            <Separator />

            {historyLoading ? (
              <div className="space-y-2">
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
              </div>
            ) : cleanupHistory.length > 0 ? (
              <>
                {historySummary && (
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 bg-muted/50 rounded-lg">
                    <div className="text-center">
                      <p className="text-2xl font-bold">{historySummary.total_cleanups}</p>
                      <p className="text-xs text-muted-foreground">{t('cache.totalCleanups')}</p>
                    </div>
                    <div className="text-center">
                      <p className="text-2xl font-bold">{historySummary.total_freed_human}</p>
                      <p className="text-xs text-muted-foreground">{t('cache.totalFreed')}</p>
                    </div>
                    <div className="text-center">
                      <p className="text-2xl font-bold">{historySummary.trash_cleanups}</p>
                      <p className="text-xs text-muted-foreground">{t('cache.trashCleanups')}</p>
                    </div>
                    <div className="text-center">
                      <p className="text-2xl font-bold">{historySummary.permanent_cleanups}</p>
                      <p className="text-xs text-muted-foreground">{t('cache.permanentCleanups')}</p>
                    </div>
                  </div>
                )}

                <div className="flex items-center justify-end gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => downloadText('cleanup-history.json', JSON.stringify(cleanupHistory, null, 2), 'application/json')}
                  >
                    <Download className="h-4 w-4 mr-2" />
                    {t('cache.exportJson')}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => downloadText('cleanup-history.csv', csvText, 'text/csv')}
                    disabled={!csvText}
                  >
                    <FileText className="h-4 w-4 mr-2" />
                    {t('cache.exportCsv')}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={async () => {
                      await writeClipboard(JSON.stringify(cleanupHistory, null, 2));
                    }}
                  >
                    <Copy className="h-4 w-4 mr-2" />
                    {t('cache.copyJson')}
                  </Button>
                </div>

                <ScrollArea className="h-64">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{t('cache.date')}</TableHead>
                        <TableHead>{t('cache.type')}</TableHead>
                        <TableHead>{t('cache.filesCount')}</TableHead>
                        <TableHead>{t('cache.freedSize')}</TableHead>
                        <TableHead>{t('cache.method')}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {cleanupHistory.map((record) => (
                        <TableRow
                          key={record.id}
                          className="cursor-pointer"
                          onClick={() => setDetail(record)}
                          data-testid={`cleanup-record-${record.id}`}
                        >
                          <TableCell className="whitespace-nowrap">
                            <div className="flex items-center gap-2">
                              <Clock className="h-4 w-4 text-muted-foreground" />
                              {new Date(record.timestamp).toLocaleString()}
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" title={record.clean_type}>
                              {formatCleanTypeLabel(record.clean_type, t)}
                            </Badge>
                          </TableCell>
                          <TableCell>{record.file_count}</TableCell>
                          <TableCell>{record.freed_human}</TableCell>
                          <TableCell>
                            {record.use_trash ? (
                              <Badge variant="secondary" className="gap-1">
                                <Recycle className="h-3 w-3" />
                                {t('cache.trash')}
                              </Badge>
                            ) : (
                              <Badge variant="destructive" className="gap-1">
                                <Trash2 className="h-3 w-3" />
                                {t('cache.permanent')}
                              </Badge>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </ScrollArea>

                <div className="flex justify-end">
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="outline" size="sm">
                        <Trash2 className="h-4 w-4 mr-2" />
                        {t('cache.clearHistory')}
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>{t('cache.clearHistoryConfirmTitle')}</AlertDialogTitle>
                        <AlertDialogDescription>{t('cache.clearHistoryConfirmDesc')}</AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={handleClearHistory}
                          className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                          {t('cache.clearHistory')}
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-8">
                {t('cache.noHistory')}
              </p>
            )}
          </CardContent>
        </CollapsibleContent>
      </Collapsible>

      <Dialog open={!!detail} onOpenChange={(open) => { if (!open) setDetail(null); }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{t('cache.cleanupDetailsTitle')}</DialogTitle>
            <DialogDescription>
              {detail ? `${formatCleanTypeLabel(detail.clean_type, t)} • ${new Date(detail.timestamp).toLocaleString()}` : ''}
            </DialogDescription>
          </DialogHeader>

          {detail && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="rounded-md border p-2">
                  <p className="text-xs text-muted-foreground">{t('cache.freedSize')}</p>
                  <p className="font-medium">{detail.freed_human}</p>
                </div>
                <div className="rounded-md border p-2">
                  <p className="text-xs text-muted-foreground">{t('cache.filesCount')}</p>
                  <p className="font-medium">{detail.file_count}</p>
                </div>
              </div>

              {detail.files_truncated && (
                <p className="text-xs text-muted-foreground">
                  {t('cache.cleanupFilesTruncated')}
                </p>
              )}

              <ScrollArea className="h-64 rounded-md border">
                <div className="p-2 space-y-1">
                  {detail.files.map((f, idx) => (
                    <div key={idx} className="flex items-center justify-between text-sm p-2 rounded hover:bg-muted/30">
                      <span className="font-mono text-xs break-all flex-1">{f.path}</span>
                      <span className="text-xs text-muted-foreground shrink-0">{f.size_human}</span>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setDetail(null)}>{t('common.close')}</Button>
            <Button
              variant="outline"
              onClick={async () => {
                if (!detail) return;
                await writeClipboard(JSON.stringify(detail, null, 2));
              }}
            >
              <Copy className="h-4 w-4 mr-2" />
              {t('cache.copyJson')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
