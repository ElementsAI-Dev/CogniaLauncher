'use client';

import { GitBranch } from 'lucide-react';
import { useLocale } from '@/components/providers/locale-provider';

export function GitEmptyState() {
  const { t } = useLocale();
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <GitBranch className="h-12 w-12 text-muted-foreground/50 mb-4" />
      <h3 className="text-lg font-medium">{t('git.emptyState')}</h3>
      <p className="text-sm text-muted-foreground mt-1 max-w-md">
        {t('git.emptyStateDesc')}
      </p>
    </div>
  );
}
