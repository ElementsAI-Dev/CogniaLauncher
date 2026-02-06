'use client';

import { Terminal } from 'lucide-react';

interface WslEmptyStateProps {
  t: (key: string, params?: Record<string, string | number>) => string;
}

export function WslEmptyState({ t }: WslEmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted mb-4">
        <Terminal className="h-8 w-8 text-muted-foreground" />
      </div>
      <h3 className="text-lg font-semibold">{t('wsl.noDistros')}</h3>
      <p className="text-sm text-muted-foreground mt-1 max-w-sm">
        {t('wsl.noDistrosDesc')}
      </p>
    </div>
  );
}
