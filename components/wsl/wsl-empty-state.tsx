'use client';

import { Card, CardContent } from '@/components/ui/card';
import { Terminal } from 'lucide-react';
import type { WslEmptyStateProps } from '@/types/wsl';

export function WslEmptyState({ t }: WslEmptyStateProps) {
  return (
    <Card className="border-dashed">
      <CardContent className="flex flex-col items-center justify-center py-12 text-center">
        <div className="rounded-full bg-muted p-4 mb-4">
          <Terminal className="h-8 w-8 text-muted-foreground" />
        </div>
        <h3 className="text-lg font-semibold mb-2">{t('wsl.noDistros')}</h3>
        <p className="text-sm text-muted-foreground max-w-sm">
          {t('wsl.noDistrosDesc')}
        </p>
      </CardContent>
    </Card>
  );
}
