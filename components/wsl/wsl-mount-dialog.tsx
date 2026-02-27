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
import { HardDrive, Loader2 } from 'lucide-react';
import type { WslMountDialogProps } from '@/types/wsl';
import type { WslMountOptions } from '@/types/tauri';

export function WslMountDialog({
  open,
  onOpenChange,
  capabilities,
  onConfirm,
  t,
}: WslMountDialogProps) {
  const [diskPath, setDiskPath] = useState('');
  const [isVhd, setIsVhd] = useState(false);
  const [fsType, setFsType] = useState('');
  const [partition, setPartition] = useState('');
  const [mountName, setMountName] = useState('');
  const [mountOptions, setMountOptions] = useState('');
  const [bare, setBare] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const handleBrowse = async () => {
    try {
      const { open: openDialog } = await import('@tauri-apps/plugin-dialog');
      const selected = await openDialog({
        multiple: false,
        filters: isVhd
          ? [{ name: 'VHD', extensions: ['vhd', 'vhdx'] }]
          : [{ name: 'All Files', extensions: ['*'] }],
      });
      if (selected) {
        setDiskPath(typeof selected === 'string' ? selected : String(selected));
      }
    } catch {
      // Dialog cancelled or not in Tauri
    }
  };

  const resetForm = () => {
    setDiskPath('');
    setIsVhd(false);
    setFsType('');
    setPartition('');
    setMountName('');
    setMountOptions('');
    setBare(false);
  };

  const handleSubmit = async () => {
    if (!diskPath.trim()) return;
    setSubmitting(true);
    try {
      const parsedPartition = partition.trim()
        ? parseInt(partition.trim(), 10)
        : undefined;
      const options: WslMountOptions = {
        diskPath: diskPath.trim(),
        isVhd,
        fsType: fsType.trim() || undefined,
        partition: Number.isNaN(parsedPartition) ? undefined : parsedPartition,
        mountName: mountName.trim() || undefined,
        mountOptions: mountOptions.trim() || undefined,
        bare,
      };
      await onConfirm(options);
      onOpenChange(false);
      resetForm();
    } catch {
      // Error handled by parent
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <HardDrive className="h-5 w-5" />
            {t('wsl.dialog.mount')}
          </DialogTitle>
          <DialogDescription>{t('wsl.dialog.mountDesc')}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="wsl-mount-disk">{t('wsl.dialog.mountDiskPath')} *</Label>
            <div className="flex gap-2">
              <Input
                id="wsl-mount-disk"
                placeholder="\\\\.\\PhysicalDrive0 or C:\\path\\to\\disk.vhdx"
                value={diskPath}
                onChange={(e) => setDiskPath(e.target.value)}
                className="flex-1"
              />
              <Button variant="outline" size="sm" onClick={handleBrowse}>
                {t('common.browse')}
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="flex items-center justify-between">
              <Label htmlFor="wsl-mount-vhd">{t('wsl.dialog.mountIsVhd')}</Label>
              <Switch id="wsl-mount-vhd" checked={isVhd} onCheckedChange={setIsVhd} />
            </div>
            <div className="flex items-center justify-between">
              <Label htmlFor="wsl-mount-bare">{t('wsl.dialog.mountBare')}</Label>
              <Switch id="wsl-mount-bare" checked={bare} onCheckedChange={setBare} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="wsl-mount-fs">{t('wsl.dialog.mountFsType')}</Label>
              <Input
                id="wsl-mount-fs"
                placeholder="ext4"
                value={fsType}
                onChange={(e) => setFsType(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="wsl-mount-partition">{t('wsl.dialog.mountPartition')}</Label>
              <Input
                id="wsl-mount-partition"
                type="number"
                placeholder="0"
                value={partition}
                onChange={(e) => setPartition(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="wsl-mount-name">{t('wsl.dialog.mountName')}</Label>
            <Input
              id="wsl-mount-name"
              placeholder={t('wsl.mountNameOptional')}
              value={mountName}
              onChange={(e) => setMountName(e.target.value)}
            />
          </div>

          {capabilities?.mountOptions !== false && (
            <div className="space-y-2">
              <Label htmlFor="wsl-mount-options">{t('wsl.dialog.mountOptions')}</Label>
              <Input
                id="wsl-mount-options"
                placeholder="ro,noatime"
                value={mountOptions}
                onChange={(e) => setMountOptions(e.target.value)}
              />
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t('common.cancel')}
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!diskPath.trim() || submitting}
            className="gap-2"
          >
            {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
            {t('wsl.dialog.mount')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
