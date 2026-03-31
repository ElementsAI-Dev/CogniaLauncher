'use client';

import { useMemo, useState } from 'react';
import { AlertTriangle, Network } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { NETWORKING_MODE_INFO } from '@/lib/constants/wsl';
import type { WslNetworkModeCardProps } from '@/types/wsl';

export function WslNetworkModeCard({
  currentMode,
  runningCount,
  onApply,
  disabled = false,
  t,
}: WslNetworkModeCardProps) {
  const normalizedCurrentMode = useMemo(() => (
    currentMode === 'nat' ? 'NAT' : currentMode || 'NAT'
  ), [currentMode]);
  const [selectedMode, setSelectedMode] = useState<'NAT' | 'mirrored' | 'virtioproxy'>(
    normalizedCurrentMode as 'NAT' | 'mirrored' | 'virtioproxy',
  );
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [applying, setApplying] = useState(false);

  const currentMeta = NETWORKING_MODE_INFO[normalizedCurrentMode] ?? NETWORKING_MODE_INFO.NAT;
  const selectedMeta = NETWORKING_MODE_INFO[selectedMode] ?? NETWORKING_MODE_INFO.NAT;
  const hasChanges = selectedMode !== normalizedCurrentMode;

  const handleConfirm = async () => {
    setApplying(true);
    try {
      await onApply(selectedMode);
      setConfirmOpen(false);
    } finally {
      setApplying(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base font-semibold flex items-center gap-2">
          <Network className="h-4 w-4 text-muted-foreground" />
          {t('wsl.detail.networkMode.title')}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-xs text-muted-foreground">{t('wsl.detail.networkMode.desc')}</p>

        <div className="rounded-md border p-3">
          <p className="text-xs text-muted-foreground">{t('wsl.detail.networkMode.current')}</p>
          <div className="mt-2 flex items-center gap-2">
            <Badge variant="secondary">{t(currentMeta.labelKey)}</Badge>
            <span className="text-sm text-muted-foreground">{t(currentMeta.descKey)}</span>
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
          <div className="space-y-2">
            <Select
              value={selectedMode}
              onValueChange={(value) => setSelectedMode(value as 'NAT' | 'mirrored' | 'virtioproxy')}
              disabled={disabled || applying}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="NAT">{t('wsl.netMode.nat')}</SelectItem>
                <SelectItem value="mirrored">{t('wsl.netMode.mirrored')}</SelectItem>
                <SelectItem value="virtioproxy">{t('wsl.netMode.virtioproxy')}</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">{t(selectedMeta.descKey)}</p>
          </div>

          <Button
            onClick={() => setConfirmOpen(true)}
            disabled={!hasChanges || disabled || applying}
          >
            {t('wsl.detail.networkMode.apply')}
          </Button>
        </div>

        <div className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 p-3 text-amber-900 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <p className="text-xs">{t('wsl.detail.networkMode.restartHint')}</p>
        </div>
      </CardContent>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('wsl.detail.networkMode.confirmTitle')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('wsl.detail.networkMode.confirmDesc', { count: runningCount })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={() => { void handleConfirm(); }}>
              {t('common.confirm')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
