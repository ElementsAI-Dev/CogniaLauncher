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
import { Switch } from '@/components/ui/switch';
import { Download, Loader2 } from 'lucide-react';
import type { WslExportDialogProps } from '@/types/wsl';

export function WslExportDialog({
  open,
  distroName,
  onOpenChange,
  onExport,
  t,
}: WslExportDialogProps) {
  const [filePath, setFilePath] = useState('');
  const [asVhd, setAsVhd] = useState(false);
  const [exporting, setExporting] = useState(false);

  const handleBrowse = async () => {
    try {
      const { save } = await import('@tauri-apps/plugin-dialog');
      const selected = await save({
        defaultPath: `${distroName}.${asVhd ? 'vhdx' : 'tar'}`,
        filters: asVhd
          ? [{ name: 'VHD', extensions: ['vhdx'] }]
          : [{ name: 'Tar Archive', extensions: ['tar'] }],
      });
      if (selected) {
        setFilePath(selected);
      }
    } catch {
      // Dialog cancelled or not in Tauri
    }
  };

  const handleExport = async () => {
    if (!filePath.trim()) return;
    setExporting(true);
    try {
      await onExport(distroName, filePath.trim(), asVhd);
      onOpenChange(false);
      setFilePath('');
      setAsVhd(false);
    } catch {
      // Error handled by parent
    } finally {
      setExporting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[440px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Download className="h-5 w-5" />
            {t('wsl.export')} — {distroName}
          </DialogTitle>
          <DialogDescription>{t('wsl.exportDesc')}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label>{t('wsl.exportAsVhd')}</Label>
            <div className="flex items-center gap-3">
              <Switch checked={asVhd} onCheckedChange={setAsVhd} />
              <span className="text-sm text-muted-foreground">
                {asVhd ? '.vhdx' : '.tar'}
              </span>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="wsl-export-path">
              {t('common.save')} {t('common.path')}
            </Label>
            <div className="flex gap-2">
              <Input
                id="wsl-export-path"
                placeholder={`C:\\Backup\\${distroName}.${asVhd ? 'vhdx' : 'tar'}`}
                value={filePath}
                onChange={(e) => setFilePath(e.target.value)}
                className="flex-1"
              />
              <Button variant="outline" size="sm" onClick={handleBrowse}>
                {t('common.browse')}
              </Button>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t('common.cancel')}
          </Button>
          <Button
            onClick={handleExport}
            disabled={!filePath.trim() || exporting}
            className="gap-2"
          >
            {exporting && <Loader2 className="h-4 w-4 animate-spin" />}
            {t('wsl.export')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
