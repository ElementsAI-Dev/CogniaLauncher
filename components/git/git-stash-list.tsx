'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Archive } from 'lucide-react';
import { useLocale } from '@/components/providers/locale-provider';
import type { GitStashListProps } from '@/types/git';

export function GitStashList({ stashes }: GitStashListProps) {
  const { t } = useLocale();

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <Archive className="h-4 w-4" />
          {t('git.repo.stash')}
          <Badge variant="secondary" className="ml-auto">{stashes.length}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {stashes.length === 0 ? (
          <p className="text-xs text-muted-foreground">{t('git.repo.noStashes')}</p>
        ) : (
          <div className="space-y-2">
            {stashes.map((s) => (
              <div key={s.id} className="flex items-start gap-2 text-xs">
                <code className="font-mono text-muted-foreground shrink-0">{s.id}</code>
                <span className="truncate flex-1">{s.message}</span>
                <span className="text-muted-foreground shrink-0">{s.date.split('T')[0]}</span>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
