'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { GitBranch, CheckCircle2, XCircle } from 'lucide-react';
import { useLocale } from '@/components/providers/locale-provider';
import type { GitRepoInfo } from '@/types/tauri';

interface GitRepoInfoCardProps {
  repoInfo: GitRepoInfo;
}

export function GitRepoInfoCard({ repoInfo }: GitRepoInfoCardProps) {
  const { t } = useLocale();

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <GitBranch className="h-4 w-4" />
          {repoInfo.rootPath.split(/[/\\]/).pop()}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <Badge variant="outline">
            <GitBranch className="h-3 w-3 mr-1" />
            {repoInfo.currentBranch}
          </Badge>
          {repoInfo.isDirty ? (
            <Badge variant="secondary" className="text-yellow-600">
              <XCircle className="h-3 w-3 mr-1" />
              {t('git.repo.dirty')}
            </Badge>
          ) : (
            <Badge variant="secondary" className="text-green-600">
              <CheckCircle2 className="h-3 w-3 mr-1" />
              {t('git.repo.clean')}
            </Badge>
          )}
          {repoInfo.fileCountStaged > 0 && (
            <Badge variant="outline">
              {t('git.repo.staged')}: {repoInfo.fileCountStaged}
            </Badge>
          )}
          {repoInfo.fileCountModified > 0 && (
            <Badge variant="outline">
              {t('git.repo.modified')}: {repoInfo.fileCountModified}
            </Badge>
          )}
          {repoInfo.fileCountUntracked > 0 && (
            <Badge variant="outline">
              {t('git.repo.untracked')}: {repoInfo.fileCountUntracked}
            </Badge>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
