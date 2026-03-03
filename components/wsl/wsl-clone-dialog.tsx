'use client';

import { useEffect, useMemo, useState } from 'react';
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
import { Copy, FolderOpen, Loader2 } from 'lucide-react';
import type { WslCloneDialogProps } from '@/types/wsl';

export function WslCloneDialog({
  open,
  distroName,
  onOpenChange,
  onConfirm,
  t,
}: WslCloneDialogProps) {
  const [newName, setNewName] = useState('');
  const [location, setLocation] = useState('');
  const [cloning, setCloning] = useState(false);

  useEffect(() => {
    if (!open) {
      setNewName('');
      setLocation('');
      setCloning(false);
    }
  }, [open]);

  const normalizedSource = useMemo(() => distroName.trim().toLowerCase(), [distroName]);
  const normalizedTarget = useMemo(() => newName.trim().toLowerCase(), [newName]);
  const invalidTarget = normalizedTarget.length > 0 && normalizedTarget === normalizedSource;

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

  const handleClone = async () => {
    if (!distroName || !newName.trim() || !location.trim() || invalidTarget) return;
    setCloning(true);
    try {
      await onConfirm(distroName, newName.trim(), location.trim());
      onOpenChange(false);
      setNewName('');
      setLocation('');
    } catch {
      // Error handled by parent
    } finally {
      setCloning(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Copy className="h-5 w-5" />
            {t('wsl.clone')} — {distroName}
          </DialogTitle>
          <DialogDescription>{t('wsl.cloneDesc')}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="wsl-clone-name">{t('wsl.cloneName')}</Label>
            <Input
              id="wsl-clone-name"
              placeholder={`${distroName}-Clone`}
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              autoFocus
            />
            {invalidTarget && (
              <p className="text-xs text-destructive">{t('wsl.cloneNameMustDiffer')}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="wsl-clone-location">{t('wsl.cloneLocation')}</Label>
            <div className="flex gap-2">
              <Input
                id="wsl-clone-location"
                placeholder="D:\\WSL\\Clones"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                className="flex-1"
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
          <Button
            onClick={handleClone}
            disabled={!newName.trim() || !location.trim() || invalidTarget || cloning}
            className="gap-2"
          >
            {cloning && <Loader2 className="h-4 w-4 animate-spin" />}
            {t('wsl.clone')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
