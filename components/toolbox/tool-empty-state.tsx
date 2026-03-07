'use client';

import type { ReactNode } from 'react';
import { useLocale } from '@/components/providers/locale-provider';
import { SearchX } from 'lucide-react';

interface ToolEmptyStateProps {
  type: 'no-results' | 'no-favorites' | 'no-recent';
  actions?: ReactNode;
}

export function ToolEmptyState({ type, actions }: ToolEmptyStateProps) {
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
    <div
      data-testid="tool-empty-state"
      className="flex min-h-full flex-col items-center justify-center px-4 py-16 text-center"
    >
      <SearchX className="h-12 w-12 text-muted-foreground/40 mb-4" />
      <h3 className="text-lg font-medium text-muted-foreground">{t(config.titleKey)}</h3>
      <p className="text-sm text-muted-foreground/70 mt-1 max-w-sm">{t(config.descKey)}</p>
      {actions ? <div className="mt-4 flex flex-wrap justify-center gap-2">{actions}</div> : null}
    </div>
  );
}
