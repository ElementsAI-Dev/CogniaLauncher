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
import { HardDrive } from 'lucide-react';

interface WslResizeDialogProps {
  open: boolean;
  distroName: string;
  onOpenChange: (open: boolean) => void;
  onConfirm: (size: string) => void;
  t: (key: string, params?: Record<string, string | number>) => string;
}

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
    if (!val) return;
    onConfirm(`${val}${sizeUnit}`);
    onOpenChange(false);
    setSizeValue('');
    setSizeUnit('GB');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[400px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <HardDrive className="h-5 w-5" />
            {t('wsl.dialog.resize')} — {distroName}
          </DialogTitle>
          <DialogDescription>{t('wsl.dialog.resizeDesc')}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
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
                  if (e.key === 'Enter' && sizeValue.trim()) handleSubmit();
                }}
                className="flex-1"
                autoFocus
              />
              <Select value={sizeUnit} onValueChange={setSizeUnit}>
                <SelectTrigger className="w-[80px]">
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
            disabled={!sizeValue.trim()}
          >
            {t('wsl.dialog.resize')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
