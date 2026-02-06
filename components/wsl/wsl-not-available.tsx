'use client';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertCircle } from 'lucide-react';

interface WslNotAvailableProps {
  t: (key: string, params?: Record<string, string | number>) => string;
}

export function WslNotAvailable({ t }: WslNotAvailableProps) {
  return (
    <Alert variant="destructive">
      <AlertCircle className="h-4 w-4" />
      <AlertTitle>{t('wsl.notAvailable')}</AlertTitle>
      <AlertDescription>{t('wsl.notAvailableDesc')}</AlertDescription>
    </Alert>
  );
}
