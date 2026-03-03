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
import { Download, FolderOpen, Loader2 } from 'lucide-react';
import type { WslInstallLocationDialogProps } from '@/types/wsl';

export function WslInstallLocationDialog({
  open,
  distroName,
  onOpenChange,
  onConfirm,
  t,
}: WslInstallLocationDialogProps) {
  const [location, setLocation] = useState('');
  const [installing, setInstalling] = useState(false);

  useEffect(() => {
    if (!open) {
      setLocation('');
      setInstalling(false);
    }
  }, [open]);

  const handleBrowseLocation = async () => {
    try {
      const { open: openDialog } = await import('@tauri-apps/plugin-dialog');
      const selected = await openDialog({ directory: true });
      if (selected) {
        setLocation(selected as string);
      }
    } catch {
      // Dialog cancelled or unavailable
    }
  };

  const handleInstall = async () => {
    if (!distroName || !location.trim()) return;
    setInstalling(true);
    try {
      await onConfirm(distroName, location.trim());
      onOpenChange(false);
      setLocation('');
    } catch {
      // Error handled by parent
    } finally {
      setInstalling(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Download className="h-5 w-5" />
            {t('wsl.installWithLocation')} — {distroName}
          </DialogTitle>
          <DialogDescription>{t('wsl.installWithLocationDesc')}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="wsl-install-location">{t('wsl.importLocation')}</Label>
            <div className="flex gap-2">
              <Input
                id="wsl-install-location"
                placeholder="D:\\WSL\\Distros"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                className="flex-1"
                autoFocus
              />
              <Button variant="outline" size="sm" onClick={handleBrowseLocation}>
                <FolderOpen className="h-4 w-4 mr-1" />
                {t('common.browse')}
              </Button>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t('common.cancel')}
          </Button>
          <Button onClick={handleInstall} disabled={!location.trim() || installing} className="gap-2">
            {installing && <Loader2 className="h-4 w-4 animate-spin" />}
            {t('wsl.installWithLocation')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
