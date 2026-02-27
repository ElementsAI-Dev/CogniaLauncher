'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Users } from 'lucide-react';
import { useLocale } from '@/components/providers/locale-provider';
import type { GitContributorsChartProps } from '@/types/git';

export function GitContributorsChart({ contributors }: GitContributorsChartProps) {
  const { t } = useLocale();
  const totalCommits = contributors.reduce((sum, c) => sum + c.commitCount, 0);
  const maxCount = contributors.length > 0 ? contributors[0].commitCount : 1;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <Users className="h-4 w-4" />
          {t('git.history.contributors')}
          <Badge variant="secondary">{contributors.length}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {contributors.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-4">{t('git.history.noContributors')}</p>
        ) : (
          <div className="space-y-2">
            {contributors.map((contributor) => {
              const percentage = totalCommits > 0
                ? ((contributor.commitCount / totalCommits) * 100).toFixed(1)
                : '0';
              const barWidth = maxCount > 0
                ? (contributor.commitCount / maxCount) * 100
                : 0;

              return (
                <div key={contributor.email} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-medium truncate">{contributor.name}</span>
                    <span className="text-muted-foreground shrink-0 ml-2">
                      {contributor.commitCount} {t('git.history.commits')} ({percentage}%)
                    </span>
                  </div>
                  <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full bg-primary rounded-full transition-all"
                      style={{ width: `${barWidth}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
