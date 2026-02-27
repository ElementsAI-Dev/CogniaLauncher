'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { GitBranch } from 'lucide-react';
import { useLocale } from '@/components/providers/locale-provider';
import type { GitBranchCardProps } from '@/types/git';

export function GitBranchCard({ branches }: GitBranchCardProps) {
  const { t } = useLocale();
  const localBranches = branches.filter((b) => !b.isRemote);
  const remoteBranches = branches.filter((b) => b.isRemote);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <GitBranch className="h-4 w-4" />
          {t('git.repo.branch')}
          <Badge variant="secondary" className="ml-auto">{branches.length}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {branches.length === 0 ? (
          <p className="text-xs text-muted-foreground">No branches</p>
        ) : (
          <div className="space-y-3">
            {localBranches.length > 0 && (
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-1.5">
                  {t('git.repo.localBranches')} ({localBranches.length})
                </p>
                <div className="space-y-1">
                  {localBranches.map((b) => (
                    <div key={b.name} className="flex items-center gap-2 text-xs">
                      {b.isCurrent && (
                        <span className="h-1.5 w-1.5 rounded-full bg-green-500 shrink-0" />
                      )}
                      <span className={`font-mono ${b.isCurrent ? 'font-semibold' : ''}`}>
                        {b.name}
                      </span>
                      {b.isCurrent && (
                        <Badge variant="outline" className="text-[10px] h-4 px-1 text-green-600 border-green-600">
                          {t('git.repo.currentBranch')}
                        </Badge>
                      )}
                      {b.upstream && (
                        <span className="text-muted-foreground">→ {b.upstream}</span>
                      )}
                      <span className="text-muted-foreground ml-auto font-mono">{b.shortHash}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {remoteBranches.length > 0 && (
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-1.5">
                  {t('git.repo.remoteBranches')} ({remoteBranches.length})
                </p>
                <div className="space-y-1">
                  {remoteBranches.map((b) => (
                    <div key={b.name} className="flex items-center gap-2 text-xs">
                      <span className="font-mono text-muted-foreground">{b.name}</span>
                      <span className="text-muted-foreground ml-auto font-mono">{b.shortHash}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
