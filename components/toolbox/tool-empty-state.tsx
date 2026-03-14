'use client';

import type { ReactNode } from 'react';
import { useLocale } from '@/components/providers/locale-provider';
import { SearchX, Star, History } from 'lucide-react';

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
      Icon: SearchX,
    },
    'no-favorites': {
      titleKey: 'toolbox.empty.noFavoritesTitle',
      descKey: 'toolbox.empty.noFavoritesDesc',
      Icon: Star,
    },
    'no-recent': {
      titleKey: 'toolbox.empty.noRecentTitle',
      descKey: 'toolbox.empty.noRecentDesc',
      Icon: History,
    },
  }[type];

  const Icon = config.Icon;

  return (
    <div
      data-testid="tool-empty-state"
      className="flex min-h-full flex-col items-center justify-center px-4 py-16 text-center rounded-xl border border-dashed"
    >
      <Icon className="h-12 w-12 text-muted-foreground/40 mb-4" />
      <h3 className="text-lg font-medium text-muted-foreground">{t(config.titleKey)}</h3>
      <p className="text-sm text-muted-foreground/70 mt-1 max-w-sm">{t(config.descKey)}</p>
      <p className="text-xs text-muted-foreground/60 mt-2">{t('toolbox.empty.tip')}</p>
      {actions ? <div className="mt-4 flex flex-wrap justify-center gap-2">{actions}</div> : null}
    </div>
  );
}
