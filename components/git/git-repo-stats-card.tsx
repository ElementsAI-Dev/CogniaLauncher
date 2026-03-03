'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Database, RefreshCw } from 'lucide-react';
import { useLocale } from '@/components/providers/locale-provider';
import { toast } from 'sonner';
import type { GitRepoStatsCardProps } from '@/types/git';

export function GitRepoStatsCard({
  repoStats,
  loading,
  onRefresh,
  onFsck,
  onDescribe,
  onIsShallow,
  onDeepen,
  onUnshallow,
}: GitRepoStatsCardProps) {
  const { t } = useLocale();
  const [describeResult, setDescribeResult] = useState<string | null>(null);
  const [fsckIssues, setFsckIssues] = useState<string[]>([]);
  const [deepenDepth, setDeepenDepth] = useState('50');
  const [shallowState, setShallowState] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);

  const disabled = loading || busy;

  const refresh = async () => {
    setBusy(true);
    try {
      await onRefresh();
      const shallow = await onIsShallow();
      setShallowState(shallow);
    } catch (e) {
      toast.error(String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <Database className="h-4 w-4" />
          {t('git.repoStats.title')}
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs ml-auto"
            disabled={disabled}
            onClick={() => refresh()}
          >
            <RefreshCw className={`h-3 w-3 mr-1 ${disabled ? 'animate-spin' : ''}`} />
            {t('git.refresh')}
          </Button>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {repoStats ? (
          <div className="grid gap-2 sm:grid-cols-2 text-xs">
            <div>{t('git.repoStats.sizeOnDisk')}: {repoStats.sizeOnDisk}</div>
            <div>{t('git.repoStats.objectCount')}: {repoStats.objectCount}</div>
            <div>{t('git.repoStats.packCount')}: {repoStats.packCount}</div>
            <div>{t('git.repoStats.looseObjects')}: {repoStats.looseObjects}</div>
            <div>{t('git.repoStats.commitCount')}: {repoStats.commitCount}</div>
            <div>{t('git.repoStats.isShallow')}: {repoStats.isShallow ? 'Yes' : 'No'}</div>
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">{t('git.error')}</p>
        )}

        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="h-7 text-xs"
            disabled={disabled}
            onClick={async () => {
              setBusy(true);
              try {
                const issues = await onFsck();
                setFsckIssues(issues);
                if (issues.length === 0) {
                  toast.success(t('git.repoStats.fsckSuccess'));
                } else {
                  toast.success(t('git.repoStats.fsckIssues', { count: String(issues.length) }));
                }
              } catch (e) {
                toast.error(String(e));
              } finally {
                setBusy(false);
              }
            }}
          >
            {t('git.repoStats.fsck')}
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-7 text-xs"
            disabled={disabled}
            onClick={async () => {
              setBusy(true);
              try {
                const describe = await onDescribe();
                setDescribeResult(describe);
              } catch (e) {
                toast.error(String(e));
              } finally {
                setBusy(false);
              }
            }}
          >
            {t('git.describe.label')}
          </Button>
          {shallowState !== null && (
            <Badge variant="outline">
              {t('git.shallow.indicator')}: {shallowState ? 'Yes' : 'No'}
            </Badge>
          )}
        </div>

        <div className="flex items-center gap-2">
          <Input
            value={deepenDepth}
            onChange={(e) => setDeepenDepth(e.target.value)}
            placeholder={t('git.shallow.deepenPlaceholder')}
            className="h-7 text-xs"
            disabled={disabled}
          />
          <Button
            variant="outline"
            size="sm"
            className="h-7 text-xs"
            disabled={disabled || !deepenDepth.trim()}
            onClick={async () => {
              setBusy(true);
              try {
                const msg = await onDeepen(Number(deepenDepth));
                toast.success(t('git.shallow.deepenSuccess'), { description: msg });
                await refresh();
              } catch (e) {
                toast.error(String(e));
              } finally {
                setBusy(false);
              }
            }}
          >
            {t('git.shallow.deepen')}
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-7 text-xs"
            disabled={disabled}
            onClick={async () => {
              setBusy(true);
              try {
                const msg = await onUnshallow();
                toast.success(t('git.shallow.unshallowSuccess'), { description: msg });
                await refresh();
              } catch (e) {
                toast.error(String(e));
              } finally {
                setBusy(false);
              }
            }}
          >
            {t('git.shallow.unshallow')}
          </Button>
        </div>

        {describeResult && (
          <p className="text-xs font-mono text-muted-foreground">
            {t('git.describe.label')}: {describeResult}
          </p>
        )}
        {fsckIssues.length > 0 && (
          <div className="space-y-1">
            {fsckIssues.map((issue, index) => (
              <p key={`${index}-${issue}`} className="text-xs text-muted-foreground font-mono">
                {issue}
              </p>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
