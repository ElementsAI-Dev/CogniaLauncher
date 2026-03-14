'use client';

import { Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyDescription } from '@/components/ui/empty';
import { Terminal, Download, Upload, Globe } from 'lucide-react';
import type { WslEmptyStateProps } from '@/types/wsl';

export function WslEmptyState({ t }: WslEmptyStateProps) {
  return (
    <Empty>
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <Terminal />
        </EmptyMedia>
        <EmptyTitle>{t('wsl.noDistros')}</EmptyTitle>
        <EmptyDescription>{t('wsl.noDistrosDesc')}</EmptyDescription>
      </EmptyHeader>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-4 max-w-md mx-auto">
        <div className="flex flex-col items-center gap-1.5 rounded-md border p-3 text-center">
          <Download className="h-4 w-4 text-muted-foreground" />
          <span className="text-xs text-muted-foreground">{t('wsl.emptyHint.install')}</span>
        </div>
        <div className="flex flex-col items-center gap-1.5 rounded-md border p-3 text-center">
          <Upload className="h-4 w-4 text-muted-foreground" />
          <span className="text-xs text-muted-foreground">{t('wsl.emptyHint.import')}</span>
        </div>
        <div className="flex flex-col items-center gap-1.5 rounded-md border p-3 text-center">
          <Globe className="h-4 w-4 text-muted-foreground" />
          <span className="text-xs text-muted-foreground">{t('wsl.emptyHint.online')}</span>
        </div>
      </div>
    </Empty>
  );
}
