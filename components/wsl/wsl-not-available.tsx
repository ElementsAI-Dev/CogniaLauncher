'use client';

import { useState } from 'react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { AlertCircle, Download, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

interface WslNotAvailableProps {
  t: (key: string, params?: Record<string, string | number>) => string;
  onInstallWsl?: () => Promise<string>;
}

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
          <Button
            variant="outline"
            size="sm"
            className="w-fit gap-2"
            onClick={handleInstall}
            disabled={installing}
          >
            {installing ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Download className="h-3.5 w-3.5" />
            )}
            {t('wsl.installWsl')}
          </Button>
        )}
      </AlertDescription>
    </Alert>
  );
}
