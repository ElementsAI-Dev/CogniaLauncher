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

export interface CachePreviewDialogProps {
  previewOpen: boolean;
  setPreviewOpen: (open: boolean) => void;
  previewData: CleanPreview | null;
  previewType: CleanType;
  previewLoading: boolean;
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
  useTrash,
  setUseTrash,
  operationLoading,
  handleEnhancedClean,
}: CachePreviewDialogProps) {
  const { t } = useLocale();
  const previewTypeLabel = previewType === 'downloads'
    ? t('cache.typeDownload')
    : previewType === 'metadata'
      ? t('cache.typeMetadata')
      : previewType === 'default_downloads'
        ? t('cache.typeDefaultDownloads')
      : previewType === 'expired'
        ? t('cache.typeExpired')
        : t('cache.allTypes');

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
