'use client';

import { useState } from 'react';
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
import { Import, Loader2 } from 'lucide-react';
import type { WslImportInPlaceDialogProps } from '@/types/wsl';

function suggestNameFromPath(vhdxPath: string): string {
  const filename = vhdxPath.split(/[\\/]/).pop() ?? '';
  return filename.replace(/\.vhdx$/i, '').replace(/[^a-zA-Z0-9_-]/g, '') || '';
}

export function WslImportInPlaceDialog({
  open,
  onOpenChange,
  onConfirm,
  t,
}: WslImportInPlaceDialogProps) {
  const [name, setName] = useState('');
  const [vhdxPath, setVhdxPath] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [nameManuallyEdited, setNameManuallyEdited] = useState(false);

  const handleBrowse = async () => {
    try {
      const { open: openDialog } = await import('@tauri-apps/plugin-dialog');
      const selected = await openDialog({
        multiple: false,
        filters: [{ name: 'VHD', extensions: ['vhdx'] }],
      });
      if (selected) {
        const path = typeof selected === 'string' ? selected : String(selected);
        setVhdxPath(path);
        if (!nameManuallyEdited) {
          const suggested = suggestNameFromPath(path);
          if (suggested) setName(suggested);
        }
      }
    } catch {
      // Dialog cancelled or not in Tauri
    }
  };

  const handleSubmit = async () => {
    if (!name.trim() || !vhdxPath.trim()) return;
    setSubmitting(true);
    try {
      await onConfirm(name.trim(), vhdxPath.trim());
      onOpenChange(false);
      setName('');
      setVhdxPath('');
      setNameManuallyEdited(false);
    } catch {
      // Error handled by parent
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-110">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Import className="h-5 w-5" />
            {t('wsl.dialog.importInPlace')}
          </DialogTitle>
          <DialogDescription>{t('wsl.dialog.importInPlaceDesc')}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="wsl-import-vhdx">{t('wsl.vhdxFile')}</Label>
            <div className="flex gap-2">
              <Input
                id="wsl-import-vhdx"
                placeholder="C:\\WSL\\ext4.vhdx"
                value={vhdxPath}
                onChange={(e) => setVhdxPath(e.target.value)}
                className="h-9 flex-1"
              />
              <Button variant="outline" size="sm" onClick={handleBrowse}>
                {t('common.browse')}
              </Button>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="wsl-import-name">{t('wsl.name')}</Label>
            <Input
              id="wsl-import-name"
              placeholder="MyDistro"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                setNameManuallyEdited(true);
              }}
              className="h-9"
              autoFocus
            />
            {!nameManuallyEdited && name && (
              <p className="text-xs text-muted-foreground">
                {t('wsl.dialog.autoSuggestedName')}
              </p>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t('common.cancel')}
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!name.trim() || !vhdxPath.trim() || submitting}
            className="gap-2"
          >
            {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
            {t('wsl.importInPlace')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
