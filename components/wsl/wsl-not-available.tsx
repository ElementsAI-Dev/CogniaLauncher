'use client';

import { useState } from 'react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
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
    <Alert variant="destructive">
      <AlertCircle className="h-4 w-4" />
      <AlertTitle>{t('wsl.notAvailable')}</AlertTitle>
      <AlertDescription className="flex flex-col gap-3">
        <p>{t('wsl.notAvailableDesc')}</p>
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
      </AlertDescription>
    </Alert>
  );
}
