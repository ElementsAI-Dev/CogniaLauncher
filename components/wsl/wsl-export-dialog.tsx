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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Download, Loader2 } from 'lucide-react';
import type { WslExportDialogProps } from '@/types/wsl';

type ExportFormat = 'tar' | 'vhd';

function normalizeExportPath(filePath: string, format: ExportFormat): string {
  const trimmed = filePath.trim();
  if (!trimmed) return '';

  if (format === 'vhd') {
    if (/\.vhdx$/i.test(trimmed)) return trimmed;
    if (/\.vhd$/i.test(trimmed)) return `${trimmed}x`;
    const replaced = trimmed.replace(/\.(tar|tar\.gz|tgz)$/i, '.vhdx');
    return /\.vhdx$/i.test(replaced) ? replaced : `${trimmed}.vhdx`;
  }

  if (/\.tar$/i.test(trimmed)) return trimmed;
  const replaced = trimmed.replace(/\.(tar\.gz|tgz|vhdx|vhd)$/i, '.tar');
  return replaced.endsWith('.tar') ? replaced : `${trimmed}.tar`;
}

export function WslExportDialog({
  open,
  distroName,
  onOpenChange,
  onExport,
  capabilities,
  t,
}: WslExportDialogProps) {
  const [filePath, setFilePath] = useState('');
  const [format, setFormat] = useState<ExportFormat>('tar');
  const [exporting, setExporting] = useState(false);
  const supportsVhd = capabilities?.exportFormat !== false;

  useEffect(() => {
    if (!supportsVhd && format === 'vhd') {
      setFormat('tar');
    }
  }, [format, supportsVhd]);

  const ext = format === 'vhd' ? 'vhdx' : 'tar';

  const handleBrowse = async () => {
    try {
      const { save } = await import('@tauri-apps/plugin-dialog');
      const filters = format === 'vhd'
        ? [{ name: 'VHD', extensions: ['vhdx'] }]
        : [{ name: 'Tar Archive', extensions: ['tar'] }];
      const selected = await save({
        defaultPath: `${distroName}.${ext}`,
        filters,
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
      const normalizedPath = normalizeExportPath(filePath, format);
      await onExport(distroName, normalizedPath, format === 'vhd');
      onOpenChange(false);
      setFilePath('');
      setFormat('tar');
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
            <Label>{t('wsl.exportFormat')}</Label>
            <Select value={format} onValueChange={(v) => setFormat(v as ExportFormat)}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="tar">TAR (.tar)</SelectItem>
                {supportsVhd && <SelectItem value="vhd">VHD (.vhdx)</SelectItem>}
              </SelectContent>
            </Select>
            {!supportsVhd && (
              <p className="text-xs text-muted-foreground">
                {t('wsl.capabilityUnsupported')
                  .replace('{feature}', t('wsl.exportAsVhd'))
                  .replace('{version}', capabilities?.version ?? 'Unknown')}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="wsl-export-path">
              {t('common.save')} {t('common.path')}
            </Label>
            <div className="flex gap-2">
              <Input
                id="wsl-export-path"
                placeholder={`C:\\Backup\\${distroName}.${ext}`}
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
