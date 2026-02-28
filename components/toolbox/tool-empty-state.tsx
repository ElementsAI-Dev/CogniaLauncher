'use client';

import { useLocale } from '@/components/providers/locale-provider';
import { SearchX } from 'lucide-react';

interface ToolEmptyStateProps {
  type: 'no-results' | 'no-favorites' | 'no-recent';
}

export function ToolEmptyState({ type }: ToolEmptyStateProps) {
  const { t } = useLocale();

  const config = {
    'no-results': {
      titleKey: 'toolbox.empty.noResultsTitle',
      descKey: 'toolbox.empty.noResultsDesc',
    },
    'no-favorites': {
      titleKey: 'toolbox.empty.noFavoritesTitle',
      descKey: 'toolbox.empty.noFavoritesDesc',
    },
    'no-recent': {
      titleKey: 'toolbox.empty.noRecentTitle',
      descKey: 'toolbox.empty.noRecentDesc',
    },
  }[type];

  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <SearchX className="h-12 w-12 text-muted-foreground/40 mb-4" />
      <h3 className="text-lg font-medium text-muted-foreground">{t(config.titleKey)}</h3>
      <p className="text-sm text-muted-foreground/70 mt-1 max-w-sm">{t(config.descKey)}</p>
    </div>
  );
}
