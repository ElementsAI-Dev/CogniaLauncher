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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Upload, Loader2 } from 'lucide-react';
import type { WslImportDialogProps } from '@/types/wsl';

export function WslImportDialog({
  open,
  onOpenChange,
  onImport,
  t,
}: WslImportDialogProps) {
  const [name, setName] = useState('');
  const [installLocation, setInstallLocation] = useState('');
  const [filePath, setFilePath] = useState('');
  const [wslVersion, setWslVersion] = useState<string>('2');
  const [asVhd, setAsVhd] = useState(false);
  const [importing, setImporting] = useState(false);

  const handleBrowseFile = async () => {
    try {
      const { open: openDialog } = await import('@tauri-apps/plugin-dialog');
      const selected = await openDialog({
        multiple: false,
        filters: [
          { name: 'Archive', extensions: ['tar', 'tar.gz', 'vhdx'] },
          { name: 'All Files', extensions: ['*'] },
        ],
      });
      if (selected) {
        setFilePath(selected as string);
      }
    } catch {
      // Dialog cancelled or not in Tauri
    }
  };

  const handleBrowseLocation = async () => {
    try {
      const { open: openDialog } = await import('@tauri-apps/plugin-dialog');
      const selected = await openDialog({
        directory: true,
      });
      if (selected) {
        setInstallLocation(selected as string);
      }
    } catch {
      // Dialog cancelled or not in Tauri
    }
  };

  const handleImport = async () => {
    if (!name.trim() || !installLocation.trim() || !filePath.trim()) return;
    setImporting(true);
    try {
      await onImport({
        name: name.trim(),
        installLocation: installLocation.trim(),
        filePath: filePath.trim(),
        wslVersion: parseInt(wslVersion, 10),
        asVhd: asVhd,
      });
      onOpenChange(false);
      resetForm();
    } catch {
      // Error handled by parent
    } finally {
      setImporting(false);
    }
  };

  const resetForm = () => {
    setName('');
    setInstallLocation('');
    setFilePath('');
    setWslVersion('2');
    setAsVhd(false);
  };

  const isValid = name.trim() && installLocation.trim() && filePath.trim();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            {t('wsl.import')}
          </DialogTitle>
          <DialogDescription>{t('wsl.importDesc')}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="wsl-import-name">{t('wsl.importName')}</Label>
            <Input
              id="wsl-import-name"
              placeholder="MyDistro"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="wsl-import-file">{t('wsl.importFile')}</Label>
            <div className="flex gap-2">
              <Input
                id="wsl-import-file"
                placeholder="/path/to/distro.tar"
                value={filePath}
                onChange={(e) => setFilePath(e.target.value)}
                className="flex-1"
              />
              <Button variant="outline" size="sm" onClick={handleBrowseFile}>
                {t('common.browse')}
              </Button>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="wsl-import-location">{t('wsl.importLocation')}</Label>
            <div className="flex gap-2">
              <Input
                id="wsl-import-location"
                placeholder="C:\\WSL\\MyDistro"
                value={installLocation}
                onChange={(e) => setInstallLocation(e.target.value)}
                className="flex-1"
              />
              <Button variant="outline" size="sm" onClick={handleBrowseLocation}>
                {t('common.browse')}
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>{t('wsl.wslVersion')}</Label>
              <Select value={wslVersion} onValueChange={setWslVersion}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="2">{t('wsl.wslVersion2')}</SelectItem>
                  <SelectItem value="1">{t('wsl.wslVersion1')}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>{t('wsl.importAsVhd')}</Label>
              <div className="flex items-center h-10">
                <Switch checked={asVhd} onCheckedChange={setAsVhd} />
              </div>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t('common.cancel')}
          </Button>
          <Button onClick={handleImport} disabled={!isValid || importing} className="gap-2">
            {importing && <Loader2 className="h-4 w-4 animate-spin" />}
            {t('wsl.import')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
