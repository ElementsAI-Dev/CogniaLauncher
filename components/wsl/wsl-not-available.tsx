'use client';

import { useState } from 'react';
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
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { AlertCircle, Download, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import type { WslNotAvailableProps } from '@/types/wsl';

export function WslNotAvailable({ t, onInstallWsl }: WslNotAvailableProps) {
  const [installing, setInstalling] = useState(false);

  const handleInstall = async () => {
    if (!onInstallWsl) return;
    setInstalling(true);
    try {
      await onInstallWsl();
      toast.success(t('wsl.installWslSuccess'));
    } catch (err) {
      toast.error(String(err));
    } finally {
      setInstalling(false);
    }
  };

  return (
    <Card className="border-destructive/50">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-destructive">
          <AlertCircle className="h-5 w-5" />
          {t('wsl.notAvailable')}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">{t('wsl.notAvailableDesc')}</p>

        <div className="space-y-2">
          <p className="text-xs font-medium">{t('wsl.installSteps.title')}</p>
          <ol className="list-inside space-y-1.5 text-xs text-muted-foreground">
            <li className="flex gap-2">
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-muted text-[10px] font-semibold">1</span>
              <span>{t('wsl.installSteps.step1')}</span>
            </li>
            <li className="flex gap-2">
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-muted text-[10px] font-semibold">2</span>
              <span>{t('wsl.installSteps.step2')}</span>
            </li>
            <li className="flex gap-2">
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-muted text-[10px] font-semibold">3</span>
              <span>{t('wsl.installSteps.step3')}</span>
            </li>
          </ol>
        </div>

        {onInstallWsl && (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="w-fit gap-2"
                disabled={installing}
              >
                {installing ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Download className="h-3.5 w-3.5" />
                )}
                {t('wsl.installWsl')}
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>{t('wsl.installWsl')}</AlertDialogTitle>
                <AlertDialogDescription>
                  {t('wsl.installWslConfirm') ?? 'This will install Windows Subsystem for Linux on your system. Continue?'}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
                <AlertDialogAction onClick={handleInstall}>
                  {t('common.confirm')}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}
      </CardContent>
    </Card>
  );
}
