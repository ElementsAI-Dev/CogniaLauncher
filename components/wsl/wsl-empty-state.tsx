'use client';

import { Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyDescription } from '@/components/ui/empty';
import { Terminal } from 'lucide-react';
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
    </Empty>
  );
}
