'use client';

import { useLocale } from '@/components/providers/locale-provider';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Eye, FileText, HardDrive, Inbox, Recycle, RefreshCw, Trash2 } from 'lucide-react';
import type { CleanPreview } from '@/lib/tauri';
import type { CleanType } from '@/types/cache';
import { cleanTypeLabelKey } from '@/lib/cache/scopes';

export interface CachePreviewDialogProps {
  previewOpen: boolean;
  setPreviewOpen: (open: boolean) => void;
  previewData: CleanPreview | null;
  previewType: CleanType;
  previewLoading: boolean;
  defaultDownloadsRoot?: string | null;
  useTrash: boolean;
  setUseTrash: (value: boolean) => void;
  operationLoading: string | null;
  handleEnhancedClean: () => void;
}

export function CachePreviewDialog({
  previewOpen,
  setPreviewOpen,
  previewData,
  previewType,
  previewLoading,
  defaultDownloadsRoot,
  useTrash,
  setUseTrash,
  operationLoading,
  handleEnhancedClean,
}: CachePreviewDialogProps) {
  const { t } = useLocale();
  const previewTypeLabel = t(cleanTypeLabelKey(previewType));
  const isDefaultDownloads = previewType === 'default_downloads';

  return (
    <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Eye className="h-5 w-5" />
            {t('cache.previewTitle')}
          </DialogTitle>
          <DialogDescription>
            {t('cache.previewDesc', { type: previewTypeLabel })}
          </DialogDescription>
        </DialogHeader>

        {previewLoading ? (
          <div className="space-y-4 py-4">
            {/* Summary skeleton */}
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-lg border p-4 space-y-2">
                <Skeleton className="h-3 w-20" />
                <Skeleton className="h-7 w-16" />
              </div>
              <div className="rounded-lg border p-4 space-y-2">
                <Skeleton className="h-3 w-24" />
                <Skeleton className="h-7 w-20" />
              </div>
            </div>
            {/* File list skeleton */}
            <div className="rounded-md border overflow-hidden">
              <div className="px-3 py-2 border-b bg-muted/30">
                <Skeleton className="h-3 w-16" />
              </div>
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="flex items-center justify-between px-3 py-2.5">
                  <div className="flex items-center gap-2">
                    <Skeleton className="h-4 w-4 rounded" />
                    <Skeleton className="h-3.5 w-32" />
                  </div>
                  <div className="flex items-center gap-2">
                    <Skeleton className="h-5 w-12 rounded-full" />
                    <Skeleton className="h-3.5 w-14" />
                  </div>
                </div>
              ))}
            </div>
            {/* Trash toggle skeleton */}
            <div className="flex items-center justify-between rounded-lg border p-3">
              <div className="flex items-center gap-2">
                <Skeleton className="h-4 w-4 rounded" />
                <Skeleton className="h-3.5 w-28" />
              </div>
              <Skeleton className="h-5 w-9 rounded-full" />
            </div>
          </div>
        ) : previewData ? (
          <div className="space-y-4">
            {isDefaultDownloads && (
              <div className="rounded-lg border bg-muted/20 p-3 space-y-1">
                {defaultDownloadsRoot && (
                  <p className="text-xs text-muted-foreground">
                    {t('cache.defaultDownloadsRoot')}:{' '}
                    <span className="font-mono break-all">{defaultDownloadsRoot}</span>
                  </p>
                )}
                <p className="text-xs text-muted-foreground">
                  {t('cache.defaultDownloadsSafetyNote')}
                </p>
              </div>
            )}

            {/* Summary stats */}
            <div className="grid grid-cols-2 gap-3">
              <div className="flex items-center gap-3 rounded-lg border p-4">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                  <FileText className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">{t('cache.filesToClean')}</p>
                  <p className="text-2xl font-bold tabular-nums">{previewData.total_count}</p>
                </div>
              </div>
              <div className="flex items-center gap-3 rounded-lg border p-4">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-destructive/10">
                  <HardDrive className="h-5 w-5 text-destructive" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">{t('cache.spaceToFree')}</p>
                  <p className="text-2xl font-bold tabular-nums">{previewData.total_size_human}</p>
                </div>
              </div>
            </div>

            {/* File list */}
            {previewData.files.length > 0 ? (
              <div className="rounded-md border overflow-hidden">
                <div className="flex items-center justify-between px-3 py-1.5 bg-muted/40 border-b">
                  <span className="text-xs font-medium text-muted-foreground">
                    {t('cache.filesToClean')}
                  </span>
                  <span className="text-xs font-medium text-muted-foreground">
                    {t('cache.spaceToFree')}
                  </span>
                </div>
                <ScrollArea className="h-48">
                  <div>
                    {previewData.files.slice(0, 20).map((file, index) => (
                      <div
                        key={index}
                        className={`flex items-center justify-between px-3 py-2 text-sm transition-colors hover:bg-muted/50 ${
                          index % 2 === 0 ? 'bg-transparent' : 'bg-muted/20'
                        }`}
                      >
                        <div className="flex items-center gap-2 min-w-0 flex-1 mr-3">
                          <FileText className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                          <span className="truncate" title={file.path}>
                            {file.path.split(/[/\\]/).pop()}
                          </span>
                          <Badge variant="outline" className="text-[10px] px-1.5 py-0 shrink-0">
                            {file.entry_type}
                          </Badge>
                        </div>
                        <span className="font-mono text-xs text-muted-foreground tabular-nums shrink-0">
                          {file.size_human}
                        </span>
                      </div>
                    ))}
                    {previewData.files.length > 20 && (
                      <>
                        <Separator />
                        <p className="text-center text-xs text-muted-foreground py-2">
                          ... {t('cache.andMore', { count: previewData.files.length - 20 })}
                        </p>
                      </>
                    )}
                  </div>
                </ScrollArea>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-8 text-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted mb-3">
                  <Inbox className="h-6 w-6 text-muted-foreground" />
                </div>
                <p className="text-sm font-medium">{t('cache.noFilesToClean')}</p>
                <p className="text-xs text-muted-foreground mt-1 max-w-60">
                  {t('cache.previewDesc', { type: previewTypeLabel })}
                </p>
              </div>
            )}

            {/* Skipped files */}
            {isDefaultDownloads && (previewData.skipped_count ?? 0) > 0 && previewData.skipped && (
              <div className="rounded-md border overflow-hidden">
                <div className="px-3 py-1.5 bg-muted/40 border-b">
                  <span className="text-xs font-medium text-muted-foreground">
                    {t('cache.skippedFiles', { count: previewData.skipped_count ?? previewData.skipped.length })}
                  </span>
                </div>
                <div className="divide-y">
                  {previewData.skipped.slice(0, 8).map((item, idx) => (
                    <div
                      key={idx}
                      className="flex items-start justify-between gap-3 px-3 py-2 text-xs text-muted-foreground"
                    >
                      <span className="font-mono break-all flex-1">{item.path}</span>
                      <Badge variant="secondary" className="text-[10px] shrink-0">
                        {item.reason}
                      </Badge>
                    </div>
                  ))}
                  {previewData.skipped.length > 8 && (
                    <>
                      <Separator />
                      <p className="text-center text-xs text-muted-foreground py-2">
                        ... {t('cache.andMore', { count: previewData.skipped.length - 8 })}
                      </p>
                    </>
                  )}
                </div>
              </div>
            )}

            {/* Trash toggle */}
            <div className="flex items-center justify-between rounded-lg border p-3">
              <div className="flex items-center gap-2">
                <Recycle className="h-4 w-4 text-muted-foreground" />
                <div>
                  <Label htmlFor="useTrash" className="text-sm">{t('cache.useTrash')}</Label>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {useTrash ? t('cache.useTrashDesc') : t('cache.permanentDeleteDesc')}
                  </p>
                </div>
              </div>
              <Switch
                id="useTrash"
                checked={useTrash}
                onCheckedChange={setUseTrash}
              />
            </div>
          </div>
        ) : null}

        <DialogFooter>
          <Button variant="outline" onClick={() => setPreviewOpen(false)}>
            {t('common.cancel')}
          </Button>
          <Button
            variant="destructive"
            onClick={handleEnhancedClean}
            disabled={!previewData || previewData.total_count === 0 || operationLoading === 'clean'}
          >
            {operationLoading === 'clean' ? (
              <>
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                {t('cache.clearing')}
              </>
            ) : (
              <>
                <Trash2 className="h-4 w-4 mr-2" />
                {t('cache.confirmClean')}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
