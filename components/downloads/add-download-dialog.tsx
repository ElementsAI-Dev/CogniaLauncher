'use client';

import { useEffect, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useLocale } from '@/components/providers/locale-provider';
import type { DownloadRequest } from '@/lib/stores/download';
import { isTauri } from '@/lib/tauri';
import { X, FolderOpen } from 'lucide-react';
import { toast } from 'sonner';

interface AddDownloadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (request: DownloadRequest) => Promise<void>;
}

const DEFAULT_FORM = {
  url: '',
  destination: '',
  name: '',
  checksum: '',
  priority: '',
  provider: '',
};

function inferNameFromUrl(url: string) {
  try {
    const parsed = new URL(url);
    const lastSegment = parsed.pathname.split('/').filter(Boolean).pop();
    return lastSegment || 'download';
  } catch {
    const parts = url.split('/').filter(Boolean);
    return parts[parts.length - 1] || 'download';
  }
}

export function AddDownloadDialog({ open, onOpenChange, onSubmit }: AddDownloadDialogProps) {
  const { t } = useLocale();
  const [form, setForm] = useState(DEFAULT_FORM);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!open) {
      setForm(DEFAULT_FORM);
    }
  }, [open]);

  useEffect(() => {
    if (!form.name.trim() && form.url.trim()) {
      setForm((prev) => ({
        ...prev,
        name: inferNameFromUrl(prev.url),
      }));
    }
  }, [form.url, form.name]);

  const isValid = form.url.trim() && form.destination.trim() && form.name.trim();

  const handleBrowseDestination = async () => {
    if (!isTauri()) {
      toast.info(t('downloads.manualPathRequired'));
      return;
    }

    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const dialogModule = await import('@tauri-apps/plugin-dialog' as any).catch(() => null);
      if (dialogModule?.save) {
        const selected = await dialogModule.save({
          defaultPath: form.name || 'download',
          title: t('downloads.selectDestination'),
        });
        if (selected && typeof selected === 'string') {
          setForm((prev) => ({ ...prev, destination: selected }));
        }
      } else {
        toast.info(t('downloads.manualPathRequired'));
      }
    } catch {
      toast.info(t('downloads.manualPathRequired'));
    }
  };

  const handleSubmit = async () => {
    if (!isValid) return;

    setIsSubmitting(true);
    try {
      await onSubmit({
        url: form.url.trim(),
        destination: form.destination.trim(),
        name: form.name.trim(),
        checksum: form.checksum.trim() || undefined,
        priority: form.priority ? Number(form.priority) : undefined,
        provider: form.provider.trim() || undefined,
      });
      onOpenChange(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[520px]">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <div>
              <DialogTitle className="text-xl">{t('downloads.addDownload')}</DialogTitle>
              <DialogDescription>{t('downloads.description')}</DialogDescription>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => onOpenChange(false)}
              className="h-8 w-8"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="download-url">{t('downloads.url')}</Label>
            <Input
              id="download-url"
              value={form.url}
              onChange={(event) => setForm((prev) => ({ ...prev, url: event.target.value }))}
              placeholder="https://example.com/file.zip"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="download-destination">{t('downloads.destination')}</Label>
            <div className="flex gap-2">
              <Input
                id="download-destination"
                value={form.destination}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, destination: event.target.value }))
                }
                placeholder="/path/to/file.zip"
                className="flex-1"
              />
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={handleBrowseDestination}
                title={t('downloads.browseFolder')}
              >
                <FolderOpen className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="download-name">{t('downloads.name')}</Label>
            <Input
              id="download-name"
              value={form.name}
              onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="download-provider">{t('downloads.provider')}</Label>
            <Input
              id="download-provider"
              value={form.provider}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, provider: event.target.value }))
              }
              placeholder={t('downloads.providerPlaceholder')}
            />
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="download-priority">{t('downloads.priority')}</Label>
              <Input
                id="download-priority"
                type="number"
                min={0}
                value={form.priority}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, priority: event.target.value }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="download-checksum">{t('downloads.checksum')}</Label>
              <Input
                id="download-checksum"
                value={form.checksum}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, checksum: event.target.value }))
                }
              />
            </div>
          </div>
        </div>

        <DialogFooter className="pt-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t('common.cancel')}
          </Button>
          <Button onClick={handleSubmit} disabled={!isValid || isSubmitting}>
            {isSubmitting ? t('common.loading') : t('common.add')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
