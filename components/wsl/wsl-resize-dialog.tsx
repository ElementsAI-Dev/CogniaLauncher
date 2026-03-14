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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { HardDrive, Info } from 'lucide-react';
import type { WslResizeDialogProps } from '@/types/wsl';

export function WslResizeDialog({
  open,
  distroName,
  onOpenChange,
  onConfirm,
  t,
}: WslResizeDialogProps) {
  const [sizeValue, setSizeValue] = useState('');
  const [sizeUnit, setSizeUnit] = useState('GB');

  const handleSubmit = () => {
    const val = sizeValue.trim();
    if (!val || Number(val) <= 0) return;
    onConfirm(`${val}${sizeUnit}`);
    onOpenChange(false);
    setSizeValue('');
    setSizeUnit('GB');
  };

  const numericValue = Number(sizeValue);
  const isValidSize = sizeValue.trim() !== '' && numericValue > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-100">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <HardDrive className="h-5 w-5" />
            {t('wsl.dialog.resize')} — {distroName}
          </DialogTitle>
          <DialogDescription>{t('wsl.dialog.resizeDesc')}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <Alert variant="default" className="bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800">
            <Info className="h-4 w-4 text-blue-600 dark:text-blue-400" />
            <AlertDescription className="text-xs text-blue-700 dark:text-blue-300">
              {t('wsl.dialog.resizeHint')}
            </AlertDescription>
          </Alert>

          <div className="space-y-2">
            <Label htmlFor="wsl-resize-size">{t('wsl.resizeSize')}</Label>
            <div className="flex gap-2">
              <Input
                id="wsl-resize-size"
                type="number"
                min="1"
                placeholder="256"
                value={sizeValue}
                onChange={(e) => setSizeValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && isValidSize) handleSubmit();
                }}
                className="h-9 flex-1"
                autoFocus
              />
              <Select value={sizeUnit} onValueChange={setSizeUnit}>
                <SelectTrigger className="h-9 w-20">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="MB">MB</SelectItem>
                  <SelectItem value="GB">GB</SelectItem>
                  <SelectItem value="TB">TB</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t('common.cancel')}
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!isValidSize}
          >
            {t('wsl.dialog.resize')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
