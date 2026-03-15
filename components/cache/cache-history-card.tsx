'use client';

import { useEffect, useMemo, useState } from 'react';
import { useLocale } from '@/components/providers/locale-provider';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty';
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
import { writeClipboard } from '@/lib/clipboard';
import { formatCleanTypeLabel } from '@/lib/cache/scopes';
import {
  Download,
  History,
  Clock,
  Copy,
  FileText,
  Recycle,
  RefreshCw,
  Trash2,
  AlertCircle,
} from 'lucide-react';
import type { CleanupRecord, CleanupHistorySummary } from '@/lib/tauri';

export interface CacheHistoryCardProps {
  cleanupHistory: CleanupRecord[];
  historySummary: CleanupHistorySummary | null;
  historyLoading: boolean;
  historyError: string | null;
  fetchCleanupHistory: () => void;
  handleRetryHistory: () => void;
  handleClearHistory: () => void;
}

export function CacheHistoryCard({
  cleanupHistory,
  historySummary,
  historyLoading,
  historyError,
  fetchCleanupHistory,
  handleRetryHistory,
  handleClearHistory,
}: CacheHistoryCardProps) {
  const { t } = useLocale();
  const [detail, setDetail] = useState<CleanupRecord | null>(null);

  // Load data on mount
  useEffect(() => {
    if (cleanupHistory.length === 0 && !historyLoading) {
      fetchCleanupHistory();
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const hasHistory = cleanupHistory.length > 0;

  const csvText = useMemo(() => {
    if (!hasHistory) return '';
    const escape = (v: string) => `"${v.replaceAll('"', '""')}"`;
    const header = ['timestamp', 'clean_type', 'label', 'file_count', 'freed_human', 'use_trash', 'id']
      .map(escape)
      .join(',');
    const rows = cleanupHistory.map((r) => {
      const label = formatCleanTypeLabel(r.clean_type, t);
      return [r.timestamp, r.clean_type, label, String(r.file_count), r.freed_human, r.use_trash ? 'true' : 'false', r.id]
        .map(escape).join(',');
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
    <div className="space-y-4">
      {/* Error */}
      {historyError && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription className="flex items-center justify-between gap-3">
            <span>{historyError}</span>
            <Button variant="outline" size="sm" onClick={handleRetryHistory}>
              <RefreshCw className="h-3 w-3 mr-1" />
              {t('common.retry')}
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {historyLoading ? (
        <div className="space-y-3">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
          </div>
          <Skeleton className="h-48 w-full" />
        </div>
      ) : hasHistory ? (
        <>
          {/* Summary Stats Strip */}
          {historySummary && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <Card>
                <CardContent className="pt-4 pb-3 px-4 text-center">
                  <p className="text-2xl font-bold">{historySummary.total_cleanups}</p>
                  <p className="text-xs text-muted-foreground">{t('cache.totalCleanups')}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4 pb-3 px-4 text-center">
                  <p className="text-2xl font-bold">{historySummary.total_freed_human}</p>
                  <p className="text-xs text-muted-foreground">{t('cache.totalFreed')}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4 pb-3 px-4 text-center">
                  <p className="text-2xl font-bold">{historySummary.trash_cleanups}</p>
                  <p className="text-xs text-muted-foreground">{t('cache.trashCleanups')}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4 pb-3 px-4 text-center">
                  <p className="text-2xl font-bold">{historySummary.permanent_cleanups}</p>
                  <p className="text-xs text-muted-foreground">{t('cache.permanentCleanups')}</p>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Toolbar */}
          <div className="flex items-center justify-between">
            <Button variant="outline" size="sm" onClick={fetchCleanupHistory}>
              <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
              {t('common.refresh')}
            </Button>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => downloadText('cleanup-history.json', JSON.stringify(cleanupHistory, null, 2), 'application/json')}
              >
                <Download className="h-3.5 w-3.5 mr-1.5" />
                JSON
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => downloadText('cleanup-history.csv', csvText, 'text/csv')}
                disabled={!csvText}
              >
                <FileText className="h-3.5 w-3.5 mr-1.5" />
                CSV
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={async () => { await writeClipboard(JSON.stringify(cleanupHistory, null, 2)); }}
              >
                <Copy className="h-3.5 w-3.5 mr-1.5" />
                {t('cache.copyJson')}
              </Button>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="outline" size="sm">
                    <Trash2 className="h-3.5 w-3.5 mr-1.5" />
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
          </div>

          {/* History Table */}
          <Card>
            <CardContent className="p-0">
              <ScrollArea className="h-100">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t('cache.date')}</TableHead>
                      <TableHead>{t('cache.type')}</TableHead>
                      <TableHead className="text-right">{t('cache.filesCount')}</TableHead>
                      <TableHead className="text-right">{t('cache.freedSize')}</TableHead>
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
                            <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                            <span className="text-sm">{new Date(record.timestamp).toLocaleString()}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-xs" title={record.clean_type}>
                            {formatCleanTypeLabel(record.clean_type, t)}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right text-sm">{record.file_count}</TableCell>
                        <TableCell className="text-right text-sm font-medium">{record.freed_human}</TableCell>
                        <TableCell>
                          {record.use_trash ? (
                            <Badge variant="secondary" className="gap-1 text-xs">
                              <Recycle className="h-3 w-3" />
                              {t('cache.trash')}
                            </Badge>
                          ) : (
                            <Badge variant="destructive" className="gap-1 text-xs">
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
            </CardContent>
          </Card>
        </>
      ) : (
        <Empty className="border-none py-12">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <History />
            </EmptyMedia>
            <EmptyTitle className="text-sm font-normal text-muted-foreground">
              {t('cache.noHistory')}
            </EmptyTitle>
            <EmptyDescription>{t('cache.noHistoryExplain')}</EmptyDescription>
          </EmptyHeader>
        </Empty>
      )}

      {/* Detail Dialog */}
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
                <div className="rounded-md border p-3">
                  <p className="text-xs text-muted-foreground">{t('cache.freedSize')}</p>
                  <p className="font-medium text-lg">{detail.freed_human}</p>
                </div>
                <div className="rounded-md border p-3">
                  <p className="text-xs text-muted-foreground">{t('cache.filesCount')}</p>
                  <p className="font-medium text-lg">{detail.file_count}</p>
                </div>
              </div>

              {detail.files_truncated && (
                <p className="text-xs text-muted-foreground">{t('cache.cleanupFilesTruncated')}</p>
              )}

              <ScrollArea className="h-64 rounded-md border">
                <div className="p-2 space-y-1">
                  {detail.files.map((f, idx) => (
                    <div key={idx} className="flex items-center justify-between text-sm p-2 rounded hover:bg-muted/30">
                      <span className="font-mono text-xs break-all flex-1">{f.path}</span>
                      <span className="text-xs text-muted-foreground shrink-0 ml-2">{f.size_human}</span>
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
    </div>
  );
}
