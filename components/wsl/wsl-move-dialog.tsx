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
import { Alert, AlertDescription } from '@/components/ui/alert';
import { FolderOpen, AlertTriangle } from 'lucide-react';

interface WslMoveDialogProps {
  open: boolean;
  distroName: string;
  onOpenChange: (open: boolean) => void;
  onConfirm: (location: string) => void;
  t: (key: string, params?: Record<string, string | number>) => string;
}

export function WslMoveDialog({
  open,
  distroName,
  onOpenChange,
  onConfirm,
  t,
}: WslMoveDialogProps) {
  const [location, setLocation] = useState('');

  const handleBrowse = async () => {
    try {
      const { open: openDialog } = await import('@tauri-apps/plugin-dialog');
      const selected = await openDialog({ directory: true });
      if (selected) {
        setLocation(typeof selected === 'string' ? selected : String(selected));
      }
    } catch {
      // Dialog cancelled or not in Tauri
    }
  };

  const handleSubmit = () => {
    if (!location.trim()) return;
    onConfirm(location.trim());
    onOpenChange(false);
    setLocation('');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[440px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FolderOpen className="h-5 w-5" />
            {t('wsl.dialog.move')} — {distroName}
          </DialogTitle>
          <DialogDescription>{t('wsl.dialog.moveDesc')}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <Alert variant="default" className="bg-yellow-50 dark:bg-yellow-950/30 border-yellow-200 dark:border-yellow-800">
            <AlertTriangle className="h-4 w-4 text-yellow-600" />
            <AlertDescription className="text-xs text-yellow-700 dark:text-yellow-400">
              {t('wsl.dialog.moveWarning')}
            </AlertDescription>
          </Alert>

          <div className="space-y-2">
            <Label htmlFor="wsl-move-path">{t('wsl.moveLocation')}</Label>
            <div className="flex gap-2">
              <Input
                id="wsl-move-path"
                placeholder="D:\\WSL\\Distros"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && location.trim()) handleSubmit();
                }}
                className="flex-1"
                autoFocus
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
            onClick={handleSubmit}
            disabled={!location.trim()}
            className="gap-2"
          >
            {t('wsl.dialog.move')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
