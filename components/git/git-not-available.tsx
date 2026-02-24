'use client';

import { Monitor } from 'lucide-react';
import { useLocale } from '@/components/providers/locale-provider';

export function GitNotAvailable() {
  const { t } = useLocale();
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <Monitor className="h-12 w-12 text-muted-foreground/50 mb-4" />
      <h3 className="text-lg font-medium">{t('git.notAvailable')}</h3>
    </div>
  );
}
