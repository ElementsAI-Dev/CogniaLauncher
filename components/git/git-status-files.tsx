'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { FileText, FilePlus, FileX, FileQuestion, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useLocale } from '@/components/providers/locale-provider';
import type { GitStatusFile } from '@/types/tauri';

interface GitStatusFilesProps {
  files: GitStatusFile[];
  loading?: boolean;
  onRefresh?: () => void;
}

function getStatusIcon(indexStatus: string, worktreeStatus: string) {
  if (indexStatus === '?' && worktreeStatus === '?') return <FileQuestion className="h-3 w-3 text-muted-foreground" />;
  if (indexStatus === 'A' || worktreeStatus === 'A') return <FilePlus className="h-3 w-3 text-green-600" />;
  if (indexStatus === 'D' || worktreeStatus === 'D') return <FileX className="h-3 w-3 text-red-600" />;
  return <FileText className="h-3 w-3 text-yellow-600" />;
}

function getStatusLabel(indexStatus: string, worktreeStatus: string): string {
  if (indexStatus === '?' && worktreeStatus === '?') return 'Untracked';
  if (indexStatus === 'A') return 'Added';
  if (indexStatus === 'D' || worktreeStatus === 'D') return 'Deleted';
  if (indexStatus === 'R') return 'Renamed';
  if (indexStatus === 'M' || worktreeStatus === 'M') return 'Modified';
  if (indexStatus === 'C') return 'Copied';
  return `${indexStatus}${worktreeStatus}`.trim();
}

function getStatusColor(indexStatus: string, worktreeStatus: string): string {
  if (indexStatus === '?' && worktreeStatus === '?') return 'text-muted-foreground';
  if (indexStatus === 'A') return 'text-green-600';
  if (indexStatus === 'D' || worktreeStatus === 'D') return 'text-red-600';
  return 'text-yellow-600';
}

export function GitStatusFiles({ files, loading, onRefresh }: GitStatusFilesProps) {
  const { t } = useLocale();

  const staged = files.filter((f) => f.indexStatus !== ' ' && f.indexStatus !== '?');
  const modified = files.filter((f) => f.worktreeStatus !== ' ' && f.worktreeStatus !== '?' && (f.indexStatus === ' ' || f.indexStatus === '?'));
  const untracked = files.filter((f) => f.indexStatus === '?' && f.worktreeStatus === '?');

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm flex items-center gap-2">
            <FileText className="h-4 w-4" />
            {t('git.status.files')}
            <Badge variant="secondary">{files.length}</Badge>
          </CardTitle>
          {onRefresh && (
            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onRefresh} disabled={loading}>
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {files.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-4">
            {t('git.status.noChanges')}
          </p>
        ) : (
          <div className="space-y-3">
            {staged.length > 0 && (
              <div>
                <p className="text-xs font-medium text-green-600 mb-1">
                  {t('git.repo.staged')} ({staged.length})
                </p>
                <div className="space-y-0.5">
                  {staged.map((f) => (
                    <div key={`s-${f.path}`} className="flex items-center gap-2 text-xs py-0.5">
                      {getStatusIcon(f.indexStatus, f.worktreeStatus)}
                      <span className="font-mono truncate flex-1">{f.path}</span>
                      <Badge variant="outline" className={`text-[10px] h-4 px-1 ${getStatusColor(f.indexStatus, f.worktreeStatus)}`}>
                        {getStatusLabel(f.indexStatus, f.worktreeStatus)}
                      </Badge>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {modified.length > 0 && (
              <div>
                <p className="text-xs font-medium text-yellow-600 mb-1">
                  {t('git.repo.modified')} ({modified.length})
                </p>
                <div className="space-y-0.5">
                  {modified.map((f) => (
                    <div key={`m-${f.path}`} className="flex items-center gap-2 text-xs py-0.5">
                      {getStatusIcon(f.indexStatus, f.worktreeStatus)}
                      <span className="font-mono truncate flex-1">{f.path}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {untracked.length > 0 && (
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-1">
                  {t('git.repo.untracked')} ({untracked.length})
                </p>
                <div className="space-y-0.5">
                  {untracked.map((f) => (
                    <div key={`u-${f.path}`} className="flex items-center gap-2 text-xs py-0.5">
                      {getStatusIcon(f.indexStatus, f.worktreeStatus)}
                      <span className="font-mono truncate flex-1 text-muted-foreground">{f.path}</span>
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
