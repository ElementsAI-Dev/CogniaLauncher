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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { History, ChevronDown, Clock, Recycle, Trash2 } from 'lucide-react';
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
                        <TableRow key={record.id}>
                          <TableCell className="whitespace-nowrap">
                            <div className="flex items-center gap-2">
                              <Clock className="h-4 w-4 text-muted-foreground" />
                              {new Date(record.timestamp).toLocaleString()}
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline">{record.clean_type}</Badge>
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
                  <Button variant="outline" size="sm" onClick={handleClearHistory}>
                    <Trash2 className="h-4 w-4 mr-2" />
                    {t('cache.clearHistory')}
                  </Button>
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
    </Card>
  );
}
