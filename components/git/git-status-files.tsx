'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { FileText, FilePlus, FileX, FileQuestion, RefreshCw, Plus, Minus, Undo2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useLocale } from '@/components/providers/locale-provider';
import { getStatusLabel, getStatusColor } from '@/lib/utils/git';
import { toast } from 'sonner';
import type { GitStatusFilesProps } from '@/types/git';

function getStatusIcon(indexStatus: string, worktreeStatus: string) {
  if (indexStatus === '?' && worktreeStatus === '?') return <FileQuestion className="h-3 w-3 text-muted-foreground" />;
  if (indexStatus === 'A' || worktreeStatus === 'A') return <FilePlus className="h-3 w-3 text-green-600" />;
  if (indexStatus === 'D' || worktreeStatus === 'D') return <FileX className="h-3 w-3 text-red-600" />;
  return <FileText className="h-3 w-3 text-yellow-600" />;
}

export function GitStatusFiles({
  files,
  loading,
  onRefresh,
  onStage,
  onUnstage,
  onStageAll,
  onDiscard,
  onViewDiff,
}: GitStatusFilesProps) {
  const { t } = useLocale();

  const staged = files.filter((f) => f.indexStatus !== ' ' && f.indexStatus !== '?');
  const modified = files.filter((f) => f.worktreeStatus !== ' ' && f.worktreeStatus !== '?' && (f.indexStatus === ' ' || f.indexStatus === '?'));
  const untracked = files.filter((f) => f.indexStatus === '?' && f.worktreeStatus === '?');

  const handleStage = async (path: string) => {
    if (!onStage) return;
    try {
      await onStage([path]);
    } catch (e) {
      toast.error(String(e));
    }
  };

  const handleUnstage = async (path: string) => {
    if (!onUnstage) return;
    try {
      await onUnstage([path]);
    } catch (e) {
      toast.error(String(e));
    }
  };

  const handleDiscard = async (path: string) => {
    if (!onDiscard) return;
    try {
      await onDiscard([path]);
      toast.success(t('git.actions.discardSuccess'));
    } catch (e) {
      toast.error(String(e));
    }
  };

  const handleStageAll = async () => {
    if (!onStageAll) return;
    try {
      await onStageAll();
    } catch (e) {
      toast.error(String(e));
    }
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm flex items-center gap-2">
            <FileText className="h-4 w-4" />
            {t('git.status.files')}
            <Badge variant="secondary">{files.length}</Badge>
          </CardTitle>
          <div className="flex items-center gap-1">
            {onStageAll && files.length > 0 && (
              <Button variant="ghost" size="sm" className="h-6 text-xs" onClick={handleStageAll} disabled={loading}>
                <Plus className="h-3 w-3 mr-1" />
                {t('git.actions.stageAll')}
              </Button>
            )}
            {onRefresh && (
              <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onRefresh} disabled={loading}>
                <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
              </Button>
            )}
          </div>
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
                    <div key={`s-${f.path}`} className="flex items-center gap-2 text-xs py-0.5 group">
                      {getStatusIcon(f.indexStatus, f.worktreeStatus)}
                      <span
                        className={`font-mono truncate flex-1 ${onViewDiff ? 'cursor-pointer hover:underline' : ''}`}
                        onClick={() => onViewDiff?.(f.path, true)}
                      >
                        {f.path}
                      </span>
                      <Badge variant="outline" className={`text-[10px] h-4 px-1 ${getStatusColor(f.indexStatus, f.worktreeStatus)}`}>
                        {getStatusLabel(f.indexStatus, f.worktreeStatus)}
                      </Badge>
                      {onUnstage && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-4 w-4 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
                          onClick={() => handleUnstage(f.path)}
                          title={t('git.actions.unstage')}
                        >
                          <Minus className="h-3 w-3" />
                        </Button>
                      )}
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
                    <div key={`m-${f.path}`} className="flex items-center gap-2 text-xs py-0.5 group">
                      {getStatusIcon(f.indexStatus, f.worktreeStatus)}
                      <span
                        className={`font-mono truncate flex-1 ${onViewDiff ? 'cursor-pointer hover:underline' : ''}`}
                        onClick={() => onViewDiff?.(f.path, false)}
                      >
                        {f.path}
                      </span>
                      <span className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                        {onStage && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-4 w-4"
                            onClick={() => handleStage(f.path)}
                            title={t('git.actions.stage')}
                          >
                            <Plus className="h-3 w-3" />
                          </Button>
                        )}
                        {onDiscard && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-4 w-4 text-destructive"
                            onClick={() => handleDiscard(f.path)}
                            title={t('git.actions.discard')}
                          >
                            <Undo2 className="h-3 w-3" />
                          </Button>
                        )}
                      </span>
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
                    <div key={`u-${f.path}`} className="flex items-center gap-2 text-xs py-0.5 group">
                      {getStatusIcon(f.indexStatus, f.worktreeStatus)}
                      <span className="font-mono truncate flex-1 text-muted-foreground">{f.path}</span>
                      {onStage && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-4 w-4 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
                          onClick={() => handleStage(f.path)}
                          title={t('git.actions.stage')}
                        >
                          <Plus className="h-3 w-3" />
                        </Button>
                      )}
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
