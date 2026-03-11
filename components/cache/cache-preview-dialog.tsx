'use client';

import { useLocale } from '@/components/providers/locale-provider';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Eye, FileText, Recycle, RefreshCw, Trash2 } from 'lucide-react';
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
          <div className="space-y-2 py-4">
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
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
            <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
              <div>
                <p className="text-sm text-muted-foreground">{t('cache.filesToClean')}</p>
                <p className="text-2xl font-bold">{previewData.total_count}</p>
              </div>
              <div className="text-right">
                <p className="text-sm text-muted-foreground">{t('cache.spaceToFree')}</p>
                <p className="text-2xl font-bold">{previewData.total_size_human}</p>
              </div>
            </div>

            {previewData.files.length > 0 && (
              <ScrollArea className="h-48 rounded-md border">
                <div className="p-2 space-y-1">
                  {previewData.files.slice(0, 20).map((file, index) => (
                    <div key={index} className="flex items-center justify-between text-sm p-2 hover:bg-muted/50 rounded">
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        <FileText className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                        <span className="truncate" title={file.path}>
                          {file.path.split(/[/\\]/).pop()}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <Badge variant="outline" className="text-xs">{file.entry_type}</Badge>
                        <span className="text-muted-foreground">{file.size_human}</span>
                      </div>
                    </div>
                  ))}
                  {previewData.files.length > 20 && (
                    <p className="text-center text-sm text-muted-foreground py-2">
                      ... {t('cache.andMore', { count: previewData.files.length - 20 })}
                    </p>
                  )}
                </div>
              </ScrollArea>
            )}

            {isDefaultDownloads && (previewData.skipped_count ?? 0) > 0 && previewData.skipped && (
              <div className="rounded-md border p-3 space-y-2">
                <p className="text-sm font-medium">
                  {t('cache.skippedFiles', { count: previewData.skipped_count ?? previewData.skipped.length })}
                </p>
                <div className="space-y-1 text-xs text-muted-foreground">
                  {previewData.skipped.slice(0, 8).map((item, idx) => (
                    <div key={idx} className="flex items-start justify-between gap-3">
                      <span className="font-mono break-all flex-1">{item.path}</span>
                      <span className="shrink-0">{item.reason}</span>
                    </div>
                  ))}
                  {previewData.skipped.length > 8 && (
                    <p className="pt-1">
                      ... {t('cache.andMore', { count: previewData.skipped.length - 8 })}
                    </p>
                  )}
                </div>
              </div>
            )}

            <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
              <div className="flex items-center gap-2">
                <Recycle className="h-4 w-4" />
                <Label htmlFor="useTrash">{t('cache.useTrash')}</Label>
              </div>
              <Switch
                id="useTrash"
                checked={useTrash}
                onCheckedChange={setUseTrash}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              {useTrash ? t('cache.useTrashDesc') : t('cache.permanentDeleteDesc')}
            </p>
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
