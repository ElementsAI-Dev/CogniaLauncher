'use client';

import { useEffect } from 'react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, CheckCircle, XCircle, SkipForward } from 'lucide-react';
import { useLocale } from '@/components/providers/locale-provider';
import type { GitMergeRebaseState } from '@/types/tauri';

export interface GitConflictBannerProps {
  repoPath: string | null;
  mergeRebaseState: GitMergeRebaseState;
  conflictedFiles: string[];
  onRefreshState: () => Promise<void>;
  onRefreshConflicts: () => Promise<void>;
  onResolveOurs: (file: string) => Promise<string>;
  onResolveTheirs: (file: string) => Promise<string>;
  onMarkResolved: (file: string) => Promise<string>;
  onAbort: () => Promise<string>;
  onContinue: () => Promise<string>;
  onSkip?: () => Promise<string>;
}

export function GitConflictBanner({
  repoPath,
  mergeRebaseState,
  conflictedFiles,
  onRefreshState,
  onRefreshConflicts,
  onResolveOurs,
  onResolveTheirs,
  onMarkResolved,
  onAbort,
  onContinue,
  onSkip,
}: GitConflictBannerProps) {
  const { t } = useLocale();

  useEffect(() => {
    if (repoPath) {
      onRefreshState();
      onRefreshConflicts();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [repoPath]);

  if (mergeRebaseState.state === 'none') return null;

  const stateLabels: Record<string, string> = {
    merging: t('git.conflict.merging'),
    rebasing: t('git.conflict.rebasing'),
    cherry_picking: t('git.conflict.cherryPicking'),
    reverting: t('git.conflict.reverting'),
  };

  const stateLabel = stateLabels[mergeRebaseState.state] || mergeRebaseState.state;
  const hasProgress = mergeRebaseState.progress != null && mergeRebaseState.total != null;
  const showSkip = mergeRebaseState.state === 'rebasing' && onSkip;

  return (
    <Alert variant="destructive" className="border-orange-500/50 bg-orange-50 dark:bg-orange-950/20">
      <AlertTriangle className="h-4 w-4" />
      <AlertTitle className="flex items-center gap-2">
        {t('git.conflict.title')}
        <Badge variant="outline" className="text-orange-600 border-orange-400">
          {stateLabel}
        </Badge>
        {hasProgress && (
          <span className="text-xs text-muted-foreground font-normal">
            {t('git.conflict.progress', {
              current: String(mergeRebaseState.progress),
              total: String(mergeRebaseState.total),
            })}
          </span>
        )}
      </AlertTitle>
      <AlertDescription className="space-y-3 mt-2">
        {conflictedFiles.length > 0 && (
          <div className="space-y-1">
            <p className="text-xs font-medium text-muted-foreground">
              {t('git.conflict.conflictedFiles')} ({conflictedFiles.length})
            </p>
            <ul className="space-y-1">
              {conflictedFiles.map((file) => (
                <li key={file} className="flex items-center gap-2 text-xs font-mono bg-background/60 rounded px-2 py-1">
                  <span className="flex-1 truncate">{file}</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-5 px-1.5 text-[10px]"
                    onClick={() => onResolveOurs(file)}
                  >
                    {t('git.conflict.resolveOurs')}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-5 px-1.5 text-[10px]"
                    onClick={() => onResolveTheirs(file)}
                  >
                    {t('git.conflict.resolveTheirs')}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-5 px-1.5 text-[10px]"
                    onClick={() => onMarkResolved(file)}
                  >
                    {t('git.conflict.markResolved')}
                  </Button>
                </li>
              ))}
            </ul>
          </div>
        )}
        {conflictedFiles.length === 0 && (
          <p className="text-xs text-muted-foreground">{t('git.conflict.noConflicts')}</p>
        )}
        <div className="flex gap-2">
          <Button variant="destructive" size="sm" onClick={onAbort}>
            <XCircle className="h-3.5 w-3.5 mr-1" />
            {t('git.conflict.abort')}
          </Button>
          <Button variant="default" size="sm" onClick={onContinue}>
            <CheckCircle className="h-3.5 w-3.5 mr-1" />
            {t('git.conflict.continue')}
          </Button>
          {showSkip && (
            <Button variant="outline" size="sm" onClick={onSkip}>
              <SkipForward className="h-3.5 w-3.5 mr-1" />
              {t('git.conflict.skip')}
            </Button>
          )}
        </div>
      </AlertDescription>
    </Alert>
  );
}
